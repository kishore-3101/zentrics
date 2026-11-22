"""
Ring Extraction and Shared Mule Disambiguation (Module 7 Deliverable).
Partitions suspicious subgraphs into distinct fraud rings using Louvain community detection
and articulation-point separation.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Set, Tuple
import networkx as nx

from graph.config.graph_config import GRAPH_CONFIG
from graph.ring_analysis.community_detection import detect_communities
from graph.ring_analysis.financial_exposure import calculate_financial_exposure
from graph.ring_analysis.role_assignment import assign_account_roles
from graph.ring_analysis.ring_scoring import compute_ring_score
from graph.shared.constants import (
    DETECTOR_CIRCULAR,
    DETECTOR_DORMANT,
    DETECTOR_FAN_IN,
    DETECTOR_FAN_OUT,
    DETECTOR_LAYERING,
    DETECTOR_PASS_THROUGH,
    ROLE_MULE,
    TYPOLOGY_CIRCULAR_FLOW,
    TYPOLOGY_COMPLEX_HYBRID,
    TYPOLOGY_DORMANT_ACTIVATION,
    TYPOLOGY_FAN_IN_FAN_OUT,
    TYPOLOGY_LAYERING_CHAIN,
    TYPOLOGY_RAPID_PASS_THROUGH,
)
from graph.shared.schemas import DetectorHit, RingCandidate
from graph.shared.utilities import compute_ring_fingerprint

logger = logging.getLogger(__name__)


class RingExtractor:
    """Extracts, separates shared-mule components, assigns roles, and scores suspicious rings."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        cfg = config or GRAPH_CONFIG.get("ring_analysis", {})
        self.min_ring_size = cfg.get("min_ring_size", 3)
        self.max_ring_size = cfg.get("max_ring_size", 50)
        self.separate_shared_mules = cfg.get("separate_shared_mules", True)

    def extract_rings(
        self,
        G: nx.MultiDiGraph,
        suspicious_accounts: Set[str],
        hits: List[DetectorHit],
        account_risks: Dict[str, float],
        sink_accounts: Optional[Set[str]] = None,
        run_prefix: str = "R-100"
    ) -> List[RingCandidate]:
        """
        Full extraction pipeline:
        1. Construct suspicious subgraph on suspicious accounts and their connected sinks.
        2. Detect connected components.
        3. For large mega-components, apply Louvain modularity clustering to uncover constituent rings.
        4. For moderate components, apply articulation point analysis to isolate shared mules.
        5. Classify typology and assign roles.
        6. Calculate financial exposure and composite score.
        """
        logger.info("Extracting suspicious rings from %d suspicious accounts...", len(suspicious_accounts))
        sinks = sink_accounts or set()

        if not suspicious_accounts:
            return []

        # Build induced or 1-hop connected subgraph
        candidate_nodes = set(suspicious_accounts)
        for node in list(suspicious_accounts):
            if G.has_node(node):
                for _, succ in G.out_edges(node):
                    if succ in sinks:
                        candidate_nodes.add(succ)

        sub_G = G.subgraph(candidate_nodes).copy()

        # Undirected projection for component & community analysis
        undirected_proj = nx.Graph()
        for u, v in sub_G.edges():
            if u != v:
                undirected_proj.add_edge(u, v)

        initial_components = list(nx.connected_components(undirected_proj))
        refined_clusters: List[Set[str]] = []

        for comp in initial_components:
            if len(comp) < self.min_ring_size:
                continue

            # Case A: Mega-component (e.g. > max_ring_size nodes) -> Louvain modularity partition
            if len(comp) > self.max_ring_size:
                comp_sub = undirected_proj.subgraph(comp)
                try:
                    comms = nx.community.louvain_communities(comp_sub, seed=42)
                    for c in comms:
                        if len(c) >= self.min_ring_size:
                            refined_clusters.append(set(c))
                except Exception:
                    # Fallback to articulation point separation
                    refined_clusters.append(comp)
                continue

            # Case B: Shared Mule articulation point separation
            if self.separate_shared_mules and len(comp) >= self.min_ring_size * 2:
                comp_sub = undirected_proj.subgraph(comp).copy()
                art_points = list(nx.articulation_points(comp_sub))

                if art_points:
                    pivot = art_points[0]
                    comp_sub.remove_node(pivot)
                    sub_comps = [c for c in nx.connected_components(comp_sub) if len(c) >= 2]

                    if len(sub_comps) >= 2:
                        for sc in sub_comps:
                            cluster_with_pivot = sc.union({pivot})
                            if len(cluster_with_pivot) >= self.min_ring_size:
                                refined_clusters.append(cluster_with_pivot)
                        continue

            refined_clusters.append(comp)

        # Build RingCandidate objects
        ring_candidates: List[RingCandidate] = []
        hits_by_acct = {h.account_id: h for h in hits}

        for idx, cluster in enumerate(refined_clusters, 1):
            ring_id = f"{run_prefix}-{idx:02d}"
            fingerprint = compute_ring_fingerprint(cluster)

            # Assign roles
            roles = assign_account_roles(cluster, G, hits, account_risks, sinks)

            # Calculate financial exposure
            fin_metrics = calculate_financial_exposure(cluster, G, roles, sinks)

            # Detector codes present in cluster
            cluster_hits = [h for h in hits if h.account_id in cluster]
            cluster_hit_codes = {h.code for h in cluster_hits}

            # Classify Typology
            typology = self._determine_typology(cluster_hit_codes)

            # Compute score and priority
            score, priority = compute_ring_score(roles, account_risks, fin_metrics, cluster_hit_codes)

            # Generate compliance narrative explanation
            explanation = self._generate_explanation(
                ring_id, typology, fin_metrics, len(cluster), roles, cluster_hit_codes
            )

            # Collect pattern tags
            pattern_tags = list(cluster_hit_codes)
            if typology not in pattern_tags:
                pattern_tags.insert(0, typology)

            # Collect internal nodes and edges
            node_dicts, edge_dicts = self._serialize_cluster_graph(cluster, G, roles, account_risks)

            candidate = RingCandidate(
                ring_id=ring_id,
                fingerprint=fingerprint,
                ring_type=typology,
                score=score,
                priority=priority,
                amount_moved=fin_metrics["amount_moved"],
                amount_cashed=fin_metrics["amount_cashed"],
                amount_at_risk=fin_metrics["amount_at_risk"],
                duration_min=fin_metrics["duration_min"],
                status="new",
                detected_at="2026-03-10T10:45:00Z",
                pattern_tags=pattern_tags,
                explanation=explanation,
                member_roles=roles,
                members=list(cluster),
                transaction_ids=fin_metrics["internal_transaction_ids"],
                nodes=node_dicts,
                edges=edge_dicts,
                metrics=fin_metrics,
            )
            ring_candidates.append(candidate)

        # Sort rings by priority descending
        ring_candidates.sort(key=lambda r: r.priority, reverse=True)
        logger.info("Successfully extracted and ranked %d fraud rings.", len(ring_candidates))
        return ring_candidates

    def _determine_typology(self, hit_codes: Set[str]) -> str:
        """Determines predominant typology of the ring."""
        if DETECTOR_CIRCULAR in hit_codes:
            return TYPOLOGY_CIRCULAR_FLOW
        if DETECTOR_PASS_THROUGH in hit_codes:
            return TYPOLOGY_RAPID_PASS_THROUGH
        if DETECTOR_LAYERING in hit_codes:
            return TYPOLOGY_LAYERING_CHAIN
        if DETECTOR_FAN_IN in hit_codes or DETECTOR_FAN_OUT in hit_codes:
            return TYPOLOGY_FAN_IN_FAN_OUT
        if DETECTOR_DORMANT in hit_codes:
            return TYPOLOGY_DORMANT_ACTIVATION
        return TYPOLOGY_COMPLEX_HYBRID

    def _generate_explanation(
        self,
        ring_id: str,
        typology: str,
        fin: Dict[str, Any],
        member_count: int,
        roles: Dict[str, str],
        codes: Set[str]
    ) -> str:
        """Constructs human-readable, regulatory-compliant narrative."""
        amt = fin["amount_moved"]
        cashed = fin["amount_cashed"]
        at_risk = fin["amount_at_risk"]
        dur = fin["duration_min"]

        num_mules = sum(1 for r in roles.values() if r == ROLE_MULE)

        if typology == TYPOLOGY_CIRCULAR_FLOW:
            return (
                f"Closed circular routing detected: ₹{amt:,.2f} circulated across {num_mules} intermediary mule accounts "
                f"within {dur:.1f} minutes, with partial cash-out of ₹{cashed:,.2f} leaving ₹{at_risk:,.2f} at risk."
            )
        elif typology == TYPOLOGY_RAPID_PASS_THROUGH:
            return (
                f"Rapid pass-through hub network: ₹{amt:,.2f} aggregated and immediately forwarded onward with "
                f"high-velocity transit times (median {dur:.1f} min)."
            )
        elif typology == TYPOLOGY_LAYERING_CHAIN:
            return (
                f"Multi-hop layering chain: ₹{amt:,.2f} routed through {member_count} sequential intermediary accounts "
                f"to obscure transactional provenance."
            )
        else:
            return (
                f"Suspicious transaction network ({typology}): ₹{amt:,.2f} transacted across {member_count} accounts "
                f"with evidence of {', '.join(codes) if codes else 'coordinated mule movement'}."
            )

    def _serialize_cluster_graph(
        self,
        cluster: Set[str],
        G: nx.MultiDiGraph,
        roles: Dict[str, str],
        account_risks: Dict[str, float]
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Serializes nodes and edges in the exact format consumed by frontend SceneContainer and API."""
        node_list = []
        for acct_id in cluster:
            nd = G.nodes[acct_id] if G.has_node(acct_id) else {}
            node_list.append({
                "account_id": acct_id,
                "role": roles.get(acct_id, "mule"),
                "risk_score": round(account_risks.get(acct_id, 65.0), 1),
                "ml_prob": round(nd.get("ml_prob", 0.70), 2),
                "rule_score": round(nd.get("rule_score", 0.80), 2),
                "neighbor_risk": round(nd.get("neighbor_risk", 0.60), 2),
                "open_date": nd.get("account_open_date", "2021-01-01"),
                "kyc_level": nd.get("kyc_status", "minimal"),
                "account_type": nd.get("account_type", "savings"),
                "city_cluster": nd.get("city", "MUMBAI"),
                "declared_income_band": "mid",
                "bank_id": nd.get("branch_id", "TRACE_BANK"),
                "total_incoming": nd.get("total_incoming", 0.0),
                "total_outgoing": nd.get("total_outgoing", 0.0),
                "transaction_count": nd.get("transaction_count", 0),
                "reason_codes": nd.get("reason_codes", []),
                "is_frozen": nd.get("is_frozen", False),
            })

        edge_list = []
        for u, v, k, d in G.edges(keys=True, data=True):
            if u in cluster and v in cluster:
                edge_list.append({
                    "txn_id": d.get("transaction_id", k),
                    "src_account": u,
                    "dst_account": v,
                    "amount": round(float(d.get("amount", 0.0)), 2),
                    "channel": d.get("channel", "UPI"),
                    "ts": d.get("ts", "2026-03-10T10:15:00Z"),
                    "hop_index": d.get("hop_index", 1),
                    "is_suspicious": True,
                })

        return node_list, edge_list
