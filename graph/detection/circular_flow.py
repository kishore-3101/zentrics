"""
Circular Flow Detector (Module 6 Deliverable).
Identifies money movement cycles (length 3-5) involving connected accounts within a 24-hour window.
Preserves directed cycles without inappropriately converting to a DAG.
Bounded cycle search prevents combinatorial explosion on large giant components.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple
import networkx as nx

from graph.shared.constants import DETECTOR_CIRCULAR, SEVERITY_CRITICAL
from graph.shared.schemas import DetectorHit

logger = logging.getLogger(__name__)


class CircularFlowDetector:
    """Detects directed transaction cycles (length 3-5) within 24 hours with amount consistency."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        cfg = config or {}
        self.min_cycle_len = cfg.get("min_cycle_len", 3)
        self.max_cycle_len = cfg.get("max_cycle_len", 5)
        self.time_window_hours = cfg.get("time_window_hours", 24)
        self.amount_similarity_pct = cfg.get("amount_similarity_pct", 0.35)

    def detect(self, G: nx.MultiDiGraph) -> List[DetectorHit]:
        hits: List[DetectorHit] = []
        max_duration = timedelta(hours=self.time_window_hours)
        tolerance = self.amount_similarity_pct

        # Convert to simple DiGraph to find elementary cycles efficiently
        simple_di = nx.DiGraph()
        for u, v in G.edges():
            if u != v:
                simple_di.add_edge(u, v)

        # Restrict cycle search to strongly connected components with at least min_cycle_len nodes
        sccs = [scc for scc in nx.strongly_connected_components(simple_di) if len(scc) >= self.min_cycle_len]
        flagged_nodes: Set[str] = set()

        for scc in sccs:
            subgraph = simple_di.subgraph(scc)

            # If SCC is very small (<= 20 nodes), use exact simple_cycles
            if len(scc) <= 25:
                cycle_iter = nx.simple_cycles(subgraph)
            else:
                # Bounded length cycle search for large components to prevent exponential blowup
                cycle_iter = self._bounded_simple_cycles(subgraph, self.min_cycle_len, self.max_cycle_len)

            for cycle in cycle_iter:
                cycle_len = len(cycle)
                if cycle_len < self.min_cycle_len or cycle_len > self.max_cycle_len:
                    continue

                # Check all rotations of the cycle to find chronological start
                valid_seq = None
                for rot_idx in range(cycle_len):
                    rotated_cycle = cycle[rot_idx:] + cycle[:rot_idx]
                    cycle_edges_data = []
                    valid_cycle = True

                    for i in range(cycle_len):
                        u = rotated_cycle[i]
                        v = rotated_cycle[(i + 1) % cycle_len]
                        if G.has_edge(u, v):
                            edges = list(G[u][v].values())
                        else:
                            edges = []
                        if not edges:
                            valid_cycle = False
                            break
                        cycle_edges_data.append(edges)

                    if not valid_cycle:
                        continue

                    seq = self._find_temporal_cycle_seq(cycle_edges_data, max_duration, tolerance)
                    if seq is not None:
                        valid_seq = seq
                        break

                if valid_seq is not None:
                    cycle_txns, initial_amt, start_ts, end_ts = valid_seq
                    duration_hours = max(0.1, (end_ts - start_ts).total_seconds() / 3600.0)

                    for node in cycle:
                        if node not in flagged_nodes:
                            flagged_nodes.add(node)
                            display = (
                                f"Circular Flow: {cycle_len}-node circular money routing detected "
                                f"moving ₹{initial_amt:,.2f} through {' -> '.join(cycle + [cycle[0]])} "
                                f"within {duration_hours:.1f} hours."
                            )
                            hit = DetectorHit(
                                account_id=node,
                                code=DETECTOR_CIRCULAR,
                                window_start=start_ts,
                                window_end=end_ts,
                                severity=SEVERITY_CRITICAL,
                                evidence={
                                    "cycle_length": cycle_len,
                                    "cycle_nodes": cycle,
                                    "amount_moved": round(initial_amt, 2),
                                    "duration_hours": round(duration_hours, 2),
                                },
                                display_text=display,
                                supporting_txns=cycle_txns,
                                counterparties=[c for c in cycle if c != node],
                            )
                            hits.append(hit)

        return hits

    def _bounded_simple_cycles(self, G: nx.DiGraph, min_len: int, max_len: int):
        """Depth-bounded cycle generator (length min_len to max_len)."""
        nodes = list(G.nodes)
        visited_cycles = set()

        for start in nodes:
            # stack: (current_node, path)
            stack = [(start, [start])]
            while stack:
                curr, path = stack.pop()
                if len(path) > max_len:
                    continue

                for succ in G.successors(curr):
                    if succ == start and len(path) >= min_len:
                        cycle_key = tuple(sorted(path))
                        if cycle_key not in visited_cycles:
                            visited_cycles.add(cycle_key)
                            yield list(path)
                    elif succ not in path and len(path) < max_len:
                        stack.append((succ, path + [succ]))

    def _find_temporal_cycle_seq(
        self,
        cycle_edges_data: List[List[Dict[str, Any]]],
        max_duration: timedelta,
        tolerance: float
    ) -> Optional[Tuple[List[str], float, datetime, datetime]]:
        """Finds at least one temporally ordered, amount-decay-consistent transaction path around the cycle."""
        for edge_0 in cycle_edges_data[0]:
            ts_0 = edge_0.get("timestamp")
            amt_0 = edge_0.get("amount", 0.0)
            txn_0 = edge_0.get("transaction_id", "")
            if ts_0 is None or amt_0 <= 0:
                continue

            current_seq = [(txn_0, amt_0, ts_0)]
            curr_ts = ts_0
            curr_amt = amt_0
            matched = True

            for hop_idx in range(1, len(cycle_edges_data)):
                hop_edges = cycle_edges_data[hop_idx]
                found_next = False
                for edge_next in hop_edges:
                    ts_next = edge_next.get("timestamp")
                    amt_next = edge_next.get("amount", 0.0)
                    txn_next = edge_next.get("transaction_id", "")
                    if ts_next is not None and ts_next >= curr_ts and (ts_next - ts_0) <= max_duration:
                        if (1.0 - tolerance) * curr_amt <= amt_next <= (1.0 + tolerance) * curr_amt:
                            current_seq.append((txn_next, amt_next, ts_next))
                            curr_ts = ts_next
                            curr_amt = amt_next
                            found_next = True
                            break
                if not found_next:
                    matched = False
                    break

            if matched and len(current_seq) == len(cycle_edges_data):
                return (
                    [item[0] for item in current_seq],
                    amt_0,
                    ts_0,
                    current_seq[-1][2]
                )

        return None
