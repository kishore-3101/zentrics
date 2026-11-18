"""Detector 4: Layering Chain."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Set, Tuple
import networkx as nx

from shared.models import Hit


def detect_layering_chain(graph: nx.MultiDiGraph, config: Dict[str, Any]) -> List[Hit]:
    """Identify suspicious multi-account transaction chains where money moves through intermediary accounts."""
    cfg = config.get("detectors", {}).get("layering_chain", {})
    if not cfg.get("enabled", True):
        return []

    min_hops = int(cfg.get("min_hops", 3))
    max_hops = int(cfg.get("max_hops", 6))
    max_hop_delay = timedelta(minutes=int(cfg.get("max_hop_delay_minutes", 60)))
    amount_tol = float(cfg.get("amount_tolerance", 0.20))
    min_amount = float(cfg.get("min_amount", 500.0))

    hits: List[Hit] = []
    seen_chains: Set[Tuple[str, ...]] = set()
    reported_account_hits: Dict[str, Hit] = {}

    candidate_intermediaries = {
        n for n in graph.nodes if graph.in_degree(n) >= 1 and graph.out_degree(n) >= 1
    }
    if not candidate_intermediaries:
        return []

    out_edges_map: Dict[str, List[Tuple[str, float, datetime, str]]] = {}
    for u in sorted(graph.nodes):
        edges = []
        for _, v, k, d in graph.out_edges(u, keys=True, data=True):
            amt = float(d["amount"])
            if amt >= min_amount and v != u:
                edges.append((v, amt, d["timestamp"], str(d["transaction_id"])))
        if edges:
            out_edges_map[u] = sorted(edges, key=lambda x: x[2])

    def dfs_chain(current_path, current_txns, current_amounts, current_times):
        hops = len(current_path) - 1
        if hops >= min_hops:
            chain_tuple = tuple(current_path)
            if chain_tuple not in seen_chains:
                seen_chains.add(chain_tuple)
                total_duration = (current_times[-1] - current_times[0]).total_seconds() / 60.0

                for i in range(1, len(current_path) - 1):
                    node = current_path[i]
                    hit = Hit(
                        account_id=str(node),
                        code="layering_chain",
                        window_start=current_times[0],
                        window_end=current_times[-1],
                        severity="high" if hops >= 4 else "medium",
                        evidence={
                            "chain_hops": hops,
                            "path_accounts": current_path,
                            "amounts": [round(a, 2) for a in current_amounts],
                            "total_duration_minutes": round(total_duration, 2),
                            "hop_index": i,
                        },
                        detail=(
                            f"Layering chain: account is hop {i} of {hops} "
                            f"moving INR {current_amounts[0]:,.2f} along path {' -> '.join(current_path[:5])} "
                            f"within {total_duration:.1f} minutes."
                        ),
                    )
                    if node not in reported_account_hits or hops > reported_account_hits[node].evidence.get("chain_hops", 0):
                        reported_account_hits[node] = hit

        if hops >= max_hops:
            return

        last_node = current_path[-1]
        last_amt = current_amounts[-1]
        last_time = current_times[-1]

        for nxt, nxt_amt, nxt_time, t_id in out_edges_map.get(last_node, []):
            if nxt in current_path:
                continue
            if last_time <= nxt_time <= last_time + max_hop_delay:
                if abs(nxt_amt - last_amt) / max(last_amt, 1e-9) <= amount_tol:
                    dfs_chain(
                        current_path + [nxt],
                        current_txns + [t_id],
                        current_amounts + [nxt_amt],
                        current_times + [nxt_time],
                    )

    for start_node in sorted(graph.nodes):
        for nxt, amt, ts, t_id in out_edges_map.get(start_node, []):
            if nxt in candidate_intermediaries:
                dfs_chain([start_node, nxt], [t_id], [amt], [ts])

    hits.extend(reported_account_hits.values())
    return hits
