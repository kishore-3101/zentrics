"""
TraceMesh Edge Manager.
Handles multi-edge transaction insertion, deduplication, timestamp ordering, and edge filtering.
Optimized for high-throughput batch operations.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, Iterator, List, Optional, Tuple
import pandas as pd
import networkx as nx

from graph.shared.schemas import TransactionEdge
from graph.shared.utilities import parse_timestamp

logger = logging.getLogger(__name__)


class EdgeManager:
    """Manages transaction edges inside a NetworkX MultiDiGraph."""

    def __init__(self, G: nx.MultiDiGraph):
        self.G = G
        self.txn_index: Dict[str, Tuple[str, str, Any]] = {} # txn_id -> (u, v, key)

    def add_transaction_edge(
        self,
        transaction_id: str,
        src_account: str,
        dst_account: str,
        amount: float,
        timestamp: Any,
        transaction_type: str = "P2P",
        transaction_status: str = "SUCCESS",
        channel: str = "UPI",
        **extra_attrs
    ) -> Optional[Any]:
        """
        Adds a single transaction edge to the MultiDiGraph.
        Prevents duplicate txn_id overwrite.
        Returns the edge key, or None if transaction_id was already present.
        """
        if transaction_id in self.txn_index:
            return None

        dt = parse_timestamp(timestamp)
        if dt is None:
            return None

        # Ensure nodes exist
        if not self.G.has_node(src_account):
            self.G.add_node(src_account, account_id=src_account)
        if not self.G.has_node(dst_account):
            self.G.add_node(dst_account, account_id=dst_account)

        key = self.G.add_edge(
            src_account,
            dst_account,
            key=transaction_id,
            transaction_id=transaction_id,
            src_account=src_account,
            dst_account=dst_account,
            amount=float(amount),
            timestamp=dt,
            ts=dt.isoformat(),
            transaction_type=transaction_type,
            transaction_status=transaction_status,
            channel=channel,
            is_suspicious=extra_attrs.get("is_suspicious", False),
            **extra_attrs
        )

        self.txn_index[transaction_id] = (src_account, dst_account, key)
        return key

    def load_transactions_dataframe(self, transactions_df: pd.DataFrame) -> int:
        """Loads transaction records from a DataFrame using fast batch dictionary iteration."""
        if transactions_df is None or transactions_df.empty:
            return 0

        cols = transactions_df.columns
        src_col = "src_account" if "src_account" in cols else "sender_account"
        dst_col = "dst_account" if "dst_account" in cols else "receiver_account"
        amt_col = "amount"
        ts_col = "timestamp" if "timestamp" in cols else "ts"
        txn_id_col = "transaction_id" if "transaction_id" in cols else "txn_id"

        records = transactions_df.to_dict("records")
        count = 0
        nodes_to_add = set()
        edges_to_add = []

        for row in records:
            status = str(row.get("transaction_status", "SUCCESS"))
            if status.lower() == "failed":
                continue

            src = str(row[src_col]).strip()
            dst = str(row[dst_col]).strip()
            if not src or not dst or src == dst:
                continue

            amt = float(row[amt_col]) if pd.notna(row[amt_col]) else 0.0
            dt = parse_timestamp(row[ts_col])
            if dt is None:
                continue

            txn_id = str(row[txn_id_col]).strip() if txn_id_col in cols and pd.notna(row[txn_id_col]) else f"TXN_{count+1:07d}"
            if txn_id in self.txn_index:
                continue

            ttype = str(row.get("transaction_type", "P2P"))
            chan = str(row.get("channel", "UPI"))

            nodes_to_add.add(src)
            nodes_to_add.add(dst)

            attrs = {
                "transaction_id": txn_id,
                "src_account": src,
                "dst_account": dst,
                "amount": amt,
                "timestamp": dt,
                "ts": dt.isoformat(),
                "transaction_type": ttype,
                "transaction_status": status,
                "channel": chan,
                "device_id": str(row.get("device_id", "")),
                "ip_address": str(row.get("ip_address", "")),
                "location": str(row.get("location", "")),
                "is_suspicious": False,
            }
            edges_to_add.append((src, dst, txn_id, attrs))
            self.txn_index[txn_id] = (src, dst, txn_id)
            count += 1

        # Add missing nodes in batch
        missing_nodes = [n for n in nodes_to_add if not self.G.has_node(n)]
        if missing_nodes:
            self.G.add_nodes_from(missing_nodes)

        # Add edges in batch
        for src, dst, key, attrs in edges_to_add:
            self.G.add_edge(src, dst, key=key, **attrs)

        return count

    def get_edge_data(self, transaction_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves edge data by transaction ID."""
        if transaction_id in self.txn_index:
            u, v, key = self.txn_index[transaction_id]
            if self.G.has_edge(u, v, key):
                return dict(self.G.edges[u, v, key])
        return None
