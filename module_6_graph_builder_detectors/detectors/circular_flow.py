"""Detector 5: Circular Flow."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Set, Tuple
import networkx as nx

from shared.models import Hit


def detect_circular_flow(graph: nx.MultiDiGraph, config: Dict[str, Any]) -> List[Hit]:
    """Identify directed transaction cycles involving 3 to 5 accounts within 24 hours.
    
    Optimized to search only cycles of length 3-5 within the time window directly,
    avoiding unbounded simple cycle enumeration.
    """
    cfg = config.get("detectors", {}).get("circular_flow", {})
    if not cfg.get("enabled", True):
        return []

    min_len = int(cfg.get("min_cycle_length", 3))
    max_len = int(cfg.get("max_cycle_length", 5))
    max_duration = timedelta(hours=float(cfg.get("max_cycle_duration_hours", 24)))
    amount_tol = float(cfg.get("amount_tolerance", 0.25))

    hits: List[Hit] = []

    # Only consider nodes with both in-degree >= 1 and out-degree >= 1
    candidate_nodes = sorted([n for n in graph.nodes if graph.in_degree(n) >= 1 and graph.out_degree(n) >= 1])
    if len(candidate_nodes) < min_len:
        return []

    candidate_set = set(candidate_nodes)
    reported_cycles: Set[Tuple[str, ...]] = set()

    # Pre-index outgoing edges within candidate set
    out_map: Dict[str, List[Tuple[str, float, datetime, str]]] = {}
    for u in candidate_nodes:
        out_edges = []
        for _, v, k, d in graph.out_edges(u, keys=True, data=True):
            if v in candidate_set and v != u:
                out_edges.append((v, float(d["amount"]), d["timestamp"], str(d["transaction_id"])))
        out_map[u] = out_edges

    # Length-bounded DFS cycle search
    def dfs_cycle(start_node: str, current_node: str, path: List[str], amounts: List[float], times: List[datetime], txn_ids: List[str]):
        depth = len(path)
        if depth > max_len:
            return

        min_time = min(times)
        max_time = max(times)
        if (max_time - min_time) > max_duration:
            return

        for next_node, amt, ts, t_id in out_map.get(current_node, []):
            new_times = times + [ts]
            if (max(new_times) - min(new_times)) > max_duration:
                continue

            # Check if cycle completes
            if next_node == start_node and depth >= min_len:
                all_amts = amounts + [amt]
                avg_amt = sum(all_amts) / len(all_amts)
                if all(abs(a - avg_amt) / max(avg_amt, 1e-9) <= amount_tol for a in all_amts):
                    min_idx = path.index(min(path))
                    canon_cycle = tuple(path[min_idx:] + path[:min_idx])
                    if canon_cycle not in reported_cycles:
                        reported_cycles.add(canon_cycle)
                        duration_h = (max(new_times) - min(new_times)).total_seconds() / 3600.0
                        sev = "critical" if duration_h <= 6.0 else "high"
                        all_txns = txn_ids + [t_id]

                        for member in canon_cycle:
                            hits.append(Hit(
                                account_id=str(member),
                                code="circular_flow",
                                window_start=min(new_times),
                                window_end=max(new_times),
                                severity=sev,
                                evidence={
                                    "cycle_length": len(canon_cycle),
                                    "cycle_accounts": list(canon_cycle),
                                    "avg_amount": round(avg_amt, 2),
                                    "cycle_duration_hours": round(duration_h, 2),
                                    "cycle_txns": all_txns,
                                },
                                detail=(
                                    f"Circular flow: participating in a {len(canon_cycle)}-account cycle "
                                    f"routing INR {avg_amt:,.2f} returning in {duration_h:.1f} hours: "
                                    f"{' -> '.join(canon_cycle)} -> {canon_cycle[0]}."
                                ),
                            ))
                continue

            if next_node not in path and depth < max_len:
                dfs_cycle(start_node, next_node, path + [next_node], amounts + [amt], new_times, txn_ids + [t_id])

    for start_node in candidate_nodes:
        for v, amt, ts, t_id in out_map.get(start_node, []):
            dfs_cycle(start_node, v, [start_node, v], [amt], [ts], [t_id])

    return hits
