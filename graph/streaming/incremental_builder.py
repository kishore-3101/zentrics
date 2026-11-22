"""
Incremental Graph Builder (Module 12a Deliverable).
Ingests streaming transactions in real-time, incrementally updating node degrees,
adjacency structures, and temporal boundaries without rebuilding the graph.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple
import networkx as nx

from graph.construction.edge_manager import EdgeManager
from graph.construction.node_manager import NodeManager
from graph.shared.utilities import parse_timestamp

logger = logging.getLogger(__name__)


class IncrementalBuilder:
    """Manages continuous ingestion of live streaming transactions."""

    def __init__(self, G: Optional[nx.MultiDiGraph] = None):
        self.G = G if G is not None else nx.MultiDiGraph()
        self.node_manager = NodeManager(self.G)
        self.edge_manager = EdgeManager(self.G)
        self.touched_accounts: Set[str] = set()
        self.latest_watermark: Optional[datetime] = None

    def ingest_transaction(
        self,
        transaction_id: str,
        src_account: str,
        dst_account: str,
        amount: float,
        timestamp: Any,
        **extra_attrs
    ) -> Tuple[bool, Set[str]]:
        """
        Ingests a single transaction event into the live graph.
        Returns:
            is_new: True if edge was newly inserted, False if duplicate.
            affected_neighborhood: Set of touched accounts and their immediate 1-hop counterparties.
        """
        dt = parse_timestamp(timestamp)
        if dt is None:
            return False, set()

        # Update watermark
        if self.latest_watermark is None or dt > self.latest_watermark:
            self.latest_watermark = dt

        # Insert edge
        key = self.edge_manager.add_transaction_edge(
            transaction_id=transaction_id,
            src_account=src_account,
            dst_account=dst_account,
            amount=amount,
            timestamp=dt,
            **extra_attrs
        )

        if key is None:
            # Duplicate transaction ID
            return False, set()

        # Update node balances and flow statistics incrementally
        src_data = self.G.nodes[src_account]
        src_data["total_outgoing"] = round(src_data.get("total_outgoing", 0.0) + amount, 2)
        src_data["out_degree"] = self.G.out_degree(src_account)
        src_data["transaction_count"] = self.G.in_degree(src_account) + src_data["out_degree"]

        dst_data = self.G.nodes[dst_account]
        dst_data["total_incoming"] = round(dst_data.get("total_incoming", 0.0) + amount, 2)
        dst_data["in_degree"] = self.G.in_degree(dst_account)
        dst_data["transaction_count"] = dst_data["in_degree"] + self.G.out_degree(dst_account)

        # Record affected 1-hop neighborhood for targeted re-evaluation
        affected = {src_account, dst_account}
        # Add 1-hop neighbors
        for pred, _ in self.G.in_edges(src_account):
            affected.add(pred)
        for _, succ in self.G.out_edges(src_account):
            affected.add(succ)
        for pred, _ in self.G.in_edges(dst_account):
            affected.add(pred)
        for _, succ in self.G.out_edges(dst_account):
            affected.add(succ)

        self.touched_accounts.update(affected)
        return True, affected

    def clear_touched(self) -> Set[str]:
        """Returns and resets currently touched accounts."""
        touched = set(self.touched_accounts)
        self.touched_accounts.clear()
        return touched
