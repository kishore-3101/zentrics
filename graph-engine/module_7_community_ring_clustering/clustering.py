"""Community detection, ring candidate clustering, role assignment, and ring scoring.

Provides deterministic graph clustering, articulation-point shared-mule separation,
robust two-pass forensic role assignment (source, victim, collector, intermediary, mule, cash_out),
financial amount-at-risk calculation, and calibrated ring risk scoring.
"""

from __future__ import annotations

from datetime import datetime
import math
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple
import networkx as nx

from shared.config import load_config
from shared.models import Hit, RingCandidate
from shared.utils import compute_fingerprint, parse_timestamp


def cluster_rings(
    graph: nx.MultiDiGraph,
    account_scores: Dict[str, float],
    hits: List[Hit],
    config: Optional[Dict[str, Any]] = None,
    sink_accounts: Optional[Iterable[str]] = None,
) -> List[RingCandidate]:
    """Identify, cluster, separate shared-mules, score, and assign roles for suspicious rings.

    Execution is strictly deterministic: all node, component, edge, and ring iterations
    are lexicographically sorted and tie-broken by fingerprint, ensuring identical results
    regardless of input node insertion order.
    """
    cfg = load_config(config)
    clustering_cfg = cfg.get("clustering", {})
    score_thresh = float(clustering_cfg.get("suspicious_score_threshold", 0.30))
    min_size = int(clustering_cfg.get("min_ring_size", 3))
    max_size = int(clustering_cfg.get("max_ring_size", 50))
    separate_mules = bool(clustering_cfg.get("separate_shared_mules", True))

    sink_set: Set[str] = set(sink_accounts) if sink_accounts else set()
    for n, data in sorted(graph.nodes(data=True)):
        if data.get("is_sink") is True:
            sink_set.add(n)

    # 1. Identify suspicious accounts from scores or detector hits
    hit_accounts = {h.account_id for h in hits}
    scored_suspicious = {acc for acc, s in account_scores.items() if s >= score_thresh}
    suspicious_nodes = sorted(list((hit_accounts | scored_suspicious) & set(graph.nodes)))

    if not suspicious_nodes:
        return []

    # Map hits by account for quick lookup
    hits_by_account: Dict[str, List[Hit]] = {}
    for h in hits:
        hits_by_account.setdefault(h.account_id, []).append(h)

    # 2. Build suspicious subgraph
    susp_subgraph = nx.MultiDiGraph()
    for u in suspicious_nodes:
        susp_subgraph.add_node(u, **graph.nodes[u])

    for u in suspicious_nodes:
        for _, v, k, data in graph.out_edges(u, keys=True, data=True):
            if v in suspicious_nodes or v in sink_set or graph.in_degree(v) == 0 or graph.out_degree(v) == 0:
                susp_subgraph.add_edge(u, v, key=k, **data)
        for v, _, k, data in graph.in_edges(u, keys=True, data=True):
            if v in suspicious_nodes or graph.in_degree(v) == 0:
                susp_subgraph.add_edge(v, u, key=k, **data)

    # Also add boundary nodes and exact edges directly connected to hit transactions
    for h in hits:
        ev = h.evidence
        s = ev.get("sender")
        r = ev.get("recipient")
        if s and s in graph.nodes and graph.has_edge(s, h.account_id):
            for k, d in graph.get_edge_data(s, h.account_id).items():
                susp_subgraph.add_edge(s, h.account_id, key=k, **d)
        if r and r in graph.nodes and graph.has_edge(h.account_id, r):
            for k, d in graph.get_edge_data(h.account_id, r).items():
                susp_subgraph.add_edge(h.account_id, r, key=k, **d)

        for s_sample in ev.get("sender_sample", []):
            if s_sample in graph.nodes and graph.has_edge(s_sample, h.account_id):
                for k, d in graph.get_edge_data(s_sample, h.account_id).items():
                    susp_subgraph.add_edge(s_sample, h.account_id, key=k, **d)
        for r_sample in ev.get("recipient_sample", []):
            if r_sample in graph.nodes and graph.has_edge(h.account_id, r_sample):
                for k, d in graph.get_edge_data(h.account_id, r_sample).items():
                    susp_subgraph.add_edge(h.account_id, r_sample, key=k, **d)

        path = ev.get("path_accounts", [])
        for i in range(len(path) - 1):
            u_p, v_p = path[i], path[i + 1]
            if u_p in graph.nodes and v_p in graph.nodes and graph.has_edge(u_p, v_p):
                for k, d in graph.get_edge_data(u_p, v_p).items():
                    susp_subgraph.add_edge(u_p, v_p, key=k, **d)

        cycle = ev.get("cycle_accounts", [])
        for i in range(len(cycle)):
            u_c, v_c = cycle[i], cycle[(i + 1) % len(cycle)]
            if u_c in graph.nodes and v_c in graph.nodes and graph.has_edge(u_c, v_c):
                for k, d in graph.get_edge_data(u_c, v_c).items():
                    susp_subgraph.add_edge(u_c, v_c, key=k, **d)

    # 3. Community detection via connected components on undirected projection
    undirected = susp_subgraph.to_undirected()

    # Sort components deterministically by (-size, min_node)
    raw_clusters = [sorted(list(c)) for c in nx.connected_components(undirected)]
    raw_clusters.sort(key=lambda c: (-len(c), c[0]))

    # 4. Shared-Mule Separation using Articulation Points
    refined_clusters: List[List[str]] = []

    for cluster in raw_clusters:
        if len(cluster) < min_size:
            continue

        if len(cluster) > max_size:
            # Subgraph too large: keep top accounts by risk score deterministically
            cluster = sorted(cluster, key=lambda a: (-account_scores.get(a, 0.0), a))[:max_size]
            cluster = sorted(cluster)

        if not separate_mules or len(cluster) < 2 * min_size - 1:
            refined_clusters.append(cluster)
            continue

        comp_g = undirected.subgraph(cluster).copy()
        art_points = sorted(list(nx.articulation_points(comp_g)))

        best_art = None
        best_balance = -1
        best_branches: List[List[str]] = []

        for art in art_points:
            test_g = comp_g.copy()
            test_g.remove_node(art)
            sub_comps = [sorted(list(sc)) for sc in nx.connected_components(test_g)]
            sub_comps.sort(key=lambda sc: (-len(sc), sc[0]))

            valid_branches = [sorted(sc + [art]) for sc in sub_comps if len(sc) + 1 >= min_size]
            if len(valid_branches) >= 2:
                balance = min(len(b) for b in valid_branches)
                if balance > best_balance:
                    best_balance = balance
                    best_art = art
                    best_branches = valid_branches

        if best_art is not None:
            refined_clusters.extend(best_branches)
        else:
            refined_clusters.append(cluster)

    # 5. Process and score candidate rings
    candidate_rings: List[RingCandidate] = []
    seen_fingerprints: Set[str] = set()

    # Sort clusters deterministically before evaluation
    refined_clusters.sort(key=lambda c: (-len(c), c[0]))

    for cluster_nodes in refined_clusters:
        sorted_members = sorted(list(cluster_nodes))
        fp = compute_fingerprint(sorted_members)
        if fp in seen_fingerprints:
            continue
        seen_fingerprints.add(fp)

        # Induced directed subgraph for this ring
        sub_di = graph.subgraph(sorted_members)

        # Collect internal transfers
        ring_txns = []
        for u in sorted_members:
            for _, v, k, d in sub_di.out_edges(u, keys=True, data=True):
                ring_txns.append({
                    "transaction_id": str(d.get("transaction_id", k)),
                    "sender_account": str(u),
                    "receiver_account": str(v),
                    "amount": float(d["amount"]),
                    "timestamp": d["timestamp"],
                    "channel": d.get("channel", "Unknown"),
                    "transaction_type": d.get("transaction_type"),
                })

        sorted_txns = sorted(ring_txns, key=lambda t: (t["timestamp"], t["transaction_id"]))

        first_inflow_ts = sorted_txns[0]["timestamp"] if sorted_txns else None
        last_outflow_ts = sorted_txns[-1]["timestamp"] if sorted_txns else None

        # 6. Two-Pass Deterministic Forensic Role Assignment
        # Roles: source, victim, collector, intermediary, mule, cash_out
        roles: Dict[str, str] = {}

        # Pass 1: Boundary nodes (in_degree == 0, out_degree == 0, or sinks)
        for u in sorted_members:
            in_deg = sub_di.in_degree(u)
            out_deg = sub_di.out_degree(u)
            u_score = account_scores.get(u, 0.0)

            if u in sink_set or (out_deg == 0 and in_deg > 0):
                roles[u] = "cash_out"
            elif in_deg == 0 and out_deg > 0:
                if u_score < 0.25 and u not in hit_accounts:
                    roles[u] = "victim"
                else:
                    roles[u] = "collector"

        # Pass 2: Interior and transit accounts (in_deg > 0 and out_deg > 0)
        for u in sorted_members:
            if u in roles:
                continue

            in_deg = sub_di.in_degree(u)
            out_deg = sub_di.out_degree(u)

            if in_deg > 0 and out_deg > 0:
                preds = sorted(list(sub_di.predecessors(u)))
                if any(roles.get(src) in ["victim", "source"] for src in preds):
                    roles[u] = "collector"
                else:
                    roles[u] = "mule"
            else:
                # Fallback for isolated singletons
                roles[u] = "mule"

        # 7. Amount Moved, Amount Cashed, and Amount at Risk
        amount_moved = sum(t["amount"] for t in sorted_txns)

        victim_accounts = {u for u, r in roles.items() if r in ["victim", "source"]}
        external_inflow = sum(
            t["amount"] for t in sorted_txns
            if t["sender_account"] in victim_accounts or sub_di.in_degree(t["sender_account"]) == 0
        )
        if external_inflow == 0.0:
            external_inflow = amount_moved

        cash_out_accounts = {u for u, r in roles.items() if r == "cash_out"} | sink_set
        amount_cashed = sum(
            t["amount"] for t in sorted_txns
            if t["receiver_account"] in cash_out_accounts
        )

        amount_at_risk = max(0.0, external_inflow - amount_cashed)

        # 8. Pattern Tags & Ring Type
        ring_hits = [h for u in sorted_members for h in hits_by_account.get(u, [])]
        pattern_tags = sorted(list({h.code for h in ring_hits}))

        if "circular_flow" in pattern_tags:
            ring_type = "circular_flow"
        elif "layering_chain" in pattern_tags:
            ring_type = "layering_chain"
        elif "fan_in_burst" in pattern_tags and "fan_out_split" in pattern_tags:
            ring_type = "fan_in_fan_out"
        elif "rapid_pass_through" in pattern_tags:
            ring_type = "pass_through_hub"
        elif "dormant_active" in pattern_tags:
            ring_type = "dormant_active"
        else:
            ring_type = "mixed"

        # 9. Ring Scoring and Priority
        member_scores = [account_scores.get(u, 0.0) for u in sorted_members]
        mean_risk = sum(member_scores) / max(len(member_scores), 1)
        max_risk = max(member_scores) if member_scores else 0.0

        if first_inflow_ts and last_outflow_ts:
            duration_min = max(1.0, (last_outflow_ts - first_inflow_ts).total_seconds() / 60.0)
        else:
            duration_min = 60.0

        speed_factor = min(1.0, 120.0 / duration_min)
        amt_factor = min(1.0, math.log10(max(100.0, amount_moved)) / 6.0)
        pattern_div_factor = min(1.0, len(pattern_tags) / 3.0)

        ring_weights = cfg.get("ring_scoring", {}).get("weights", {})
        w_mean = float(ring_weights.get("mean_risk", 0.35))
        w_max = float(ring_weights.get("max_risk", 0.20))
        w_amt = float(ring_weights.get("amount_factor", 0.15))
        w_speed = float(ring_weights.get("speed_factor", 0.15))
        w_pattern = float(ring_weights.get("pattern_diversity", 0.15))

        raw_score = (
            w_mean * (mean_risk * 100.0) +
            w_max * (max_risk * 100.0) +
            w_amt * (amt_factor * 100.0) +
            w_speed * (speed_factor * 100.0) +
            w_pattern * (pattern_div_factor * 100.0)
        )
        final_score = round(max(0.0, min(100.0, raw_score)), 2)
        priority = round(final_score * amount_at_risk, 2)

        action_thresholds = cfg.get("ring_scoring", {}).get("action_thresholds", {})
        thresh_freeze = float(action_thresholds.get("freeze_and_escalate", 80.0))
        thresh_watchlist = float(action_thresholds.get("watchlist_review", 50.0))

        if final_score >= thresh_freeze:
            recommended_action = "freeze_and_escalate"
        elif final_score >= thresh_watchlist:
            recommended_action = "watchlist_review"
        else:
            recommended_action = "monitor"

        ring_obj = RingCandidate(
            ring_id="TEMP_ID",
            member_account_ids=sorted_members,
            community_id=0,
            roles=roles,
            score=final_score,
            priority=priority,
            amount_moved=round(amount_moved, 2),
            amount_cashed=round(amount_cashed, 2),
            amount_at_risk=round(amount_at_risk, 2),
            first_inflow_ts=first_inflow_ts,
            last_outflow_ts=last_outflow_ts,
            ring_transactions=sorted_txns,
            pattern_tags=pattern_tags,
            ring_type=ring_type,
            detector_evidence=[h.to_dict() for h in ring_hits],
            recommended_action=recommended_action,
            fingerprint=fp,
        )
        candidate_rings.append(ring_obj)

    # 10. Final Deterministic Ranking and Stable ID Assignment
    # Sort by descending priority, descending score, then ascending fingerprint
    candidate_rings.sort(key=lambda r: (-r.priority, -r.score, r.fingerprint))

    for idx, r in enumerate(candidate_rings):
        r.ring_id = f"RING_{idx + 1:04d}"
        r.community_id = idx + 1

    return candidate_rings
