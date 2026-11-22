"""
Layering Chain Detector (Module 6 Deliverable).
Identifies directed multi-hop transaction paths moving funds through sequential intermediary accounts.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set
import networkx as nx

from graph.shared.constants import DETECTOR_LAYERING, SEVERITY_HIGH, SEVERITY_CRITICAL
from graph.shared.schemas import DetectorHit

logger = logging.getLogger(__name__)


class LayeringChainDetector:
    """Detects multi-hop layering paths with amount continuity and timestamp ordering."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        cfg = config or {}
        self.min_hops = cfg.get("min_hops", 3)
        self.max_hops = cfg.get("max_hops", 6)
        self.amount_similarity_pct = cfg.get("amount_similarity_pct", 0.20)
        self.max_hop_delay_minutes = cfg.get("max_hop_delay_minutes", 120)
        self.min_amount = cfg.get("min_amount", 500.0)

    def detect(self, G: nx.MultiDiGraph) -> List[DetectorHit]:
        hits: List[DetectorHit] = []
        max_delay = timedelta(minutes=self.max_hop_delay_minutes)
        tolerance = self.amount_similarity_pct

        # Find potential starting nodes: accounts with out-edges >= min_amount
        # We perform DFS paths up to max_hops
        flagged_nodes: Set[str] = set()

        for start_node in G.nodes:
            # Look at outgoing edges from start_node
            for _, v1, k1, d1 in G.out_edges(start_node, keys=True, data=True):
                amt1 = d1.get("amount", 0.0)
                ts1 = d1.get("timestamp")
                if amt1 < self.min_amount or ts1 is None:
                    continue

                # Stack for DFS: (current_node, current_path_nodes, current_edges, current_amt, current_ts)
                stack = [(v1, [start_node, v1], [(d1.get("transaction_id", k1), amt1, ts1)])]

                while stack:
                    curr_node, path_nodes, path_edges = stack.pop()
                    hop_count = len(path_nodes) - 1

                    if hop_count >= self.min_hops:
                        # Found a valid layering chain!
                        intermediaries = path_nodes[1:-1]
                        for inter_node in intermediaries:
                            if inter_node not in flagged_nodes:
                                flagged_nodes.add(inter_node)
                                total_amt = path_edges[0][1]
                                start_ts = path_edges[0][2]
                                end_ts = path_edges[-1][2]
                                txns = [e[0] for e in path_edges]

                                display = (
                                    f"Layering Chain: Part of a {hop_count}-hop money laundering chain "
                                    f"routing ₹{total_amt:,.2f} across accounts: {' -> '.join(path_nodes)}."
                                )
                                hit = DetectorHit(
                                    account_id=inter_node,
                                    code=DETECTOR_LAYERING,
                                    window_start=start_ts,
                                    window_end=end_ts,
                                    severity=SEVERITY_CRITICAL if hop_count >= 4 else SEVERITY_HIGH,
                                    evidence={
                                        "hop_count": hop_count,
                                        "chain_accounts": path_nodes,
                                        "initial_amount": round(total_amt, 2),
                                        "final_amount": round(path_edges[-1][1], 2),
                                        "duration_minutes": round((end_ts - start_ts).total_seconds() / 60.0, 1),
                                    },
                                    display_text=display,
                                    supporting_txns=txns,
                                    counterparties=[p for p in path_nodes if p != inter_node],
                                )
                                hits.append(hit)

                    if hop_count < self.max_hops:
                        last_txn, last_amt, last_ts = path_edges[-1]
                        # Expand next hop
                        for _, nxt, k2, d2 in G.out_edges(curr_node, keys=True, data=True):
                            if nxt in path_nodes:
                                continue # Avoid looping back in pure layering chain
                            amt2 = d2.get("amount", 0.0)
                            ts2 = d2.get("timestamp")
                            if ts2 is None:
                                continue

                            # Check timestamp order and delay
                            if last_ts <= ts2 <= last_ts + max_delay:
                                # Check amount decay/similarity
                                if (1.0 - tolerance) * last_amt <= amt2 <= (1.0 + tolerance) * last_amt:
                                    nxt_txn = d2.get("transaction_id", k2)
                                    stack.append((
                                        nxt,
                                        path_nodes + [nxt],
                                        path_edges + [(nxt_txn, amt2, ts2)]
                                    ))

        return hits
