"""Sliding-window transaction graph manager for streaming incremental processing.

Maintains an in-memory temporal transaction graph over a sliding time window.
Handles transaction ingestion, out-of-order events, duplicate prevention with
bounded historical retention, and automatic edge expiration with affected-account tracking.
"""

from __future__ import annotations

from collections import deque
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple
import networkx as nx

from shared.config import load_config
from shared.utils import parse_timestamp


class SlidingWindowGraphManager:
    """Manages an in-memory sliding-window transaction graph.

    Duplicate Retention Policy:
    ---------------------------
    - active_window_txn_ids: Set of transaction IDs currently present in the active window.
      Edges are removed when transactions expire.
    - historical_seen_txn_ids: Bounded FIFO set of all historically processed transaction IDs
      (default capacity: 200,000 IDs). Prevents replay attacks even after transactions expire.
    """

    def __init__(
        self,
        window_minutes: int = 60,
        accounts_df: Optional[Any] = None,
        sink_accounts: Optional[Iterable[str]] = None,
        config: Optional[Dict[str, Any]] = None,
        max_historical_txns: int = 200_000,
    ):
        self.cfg = load_config(config)
        self.window_minutes = window_minutes or int(self.cfg.get("streaming", {}).get("window_minutes", 60))
        self.window_delta = timedelta(minutes=self.window_minutes)

        self.graph = nx.MultiDiGraph()
        self.sink_set: Set[str] = set(sink_accounts) if sink_accounts else set()

        # Active-window transaction IDs (cleared upon expiration)
        self.active_window_txn_ids: Set[str] = set()

        # Historical processed IDs (bounded FIFO to prevent replay attacks across window boundaries)
        self.max_historical_txns = max_historical_txns
        self.historical_seen_txn_ids: Set[str] = set()
        self.historical_queue: deque = deque()

        # Chronologically sorted transaction records in active window
        self.active_transactions: List[Dict[str, Any]] = []

        # Monotonically advancing virtual clock watermark
        self.watermark: Optional[datetime] = None
        self.last_expired_accounts: Set[str] = set()
        self.last_reason: str = ''

        if accounts_df is not None:
            self.init_accounts(accounts_df)

    def init_accounts(self, accounts_df: Any) -> None:
        """Initialize accounts in the graph without transactions."""
        import pandas as pd
        if isinstance(accounts_df, pd.DataFrame):
            for row in accounts_df.to_dict(orient="records"):
                acc_id = str(row["account_id"])
                attrs = {k: v for k, v in row.items() if k not in ["is_mule", "is_fraud"]}
                attrs["is_sink"] = acc_id in self.sink_set
                self.graph.add_node(acc_id, **attrs)

    def add_transaction(self, txn: Dict[str, Any]) -> Tuple[bool, Set[str]]:
        """Add an incoming transaction event to the sliding window graph.

        Returns:
            (is_added, touched_accounts, expired_accounts, reason)
        """
        txn_id = str(txn.get("transaction_id", ""))
        if not txn_id:
            self.last_expired_accounts = set()
            self.last_reason = "missing_txn_id"
            return False, set()

        # Check duplicates in active window or historical tracking
        if txn_id in self.active_window_txn_ids or txn_id in self.historical_seen_txn_ids:
            self.last_expired_accounts = set()
            self.last_reason = "duplicate_transaction"
            return False, set()

        status = txn.get("transaction_status", "Success")
        if status != "Success":
            self.last_expired_accounts = set()
            self.last_reason = "non_successful_status"
            return False, set()

        sender = str(txn.get("sender_account", ""))
        receiver = str(txn.get("receiver_account", ""))
        if not sender or not receiver:
            self.last_expired_accounts = set()
            self.last_reason = "missing_accounts"
            return False, set()

        amount = float(txn.get("amount", 0.0))
        if amount <= 0.0:
            self.last_expired_accounts = set()
            self.last_reason = "non_positive_amount"
            return False, set()

        ts = parse_timestamp(txn["timestamp"])

        expired_accounts: Set[str] = set()

        # Advance watermark and expire older transactions if event advances time
        if self.watermark is None or ts > self.watermark:
            self.watermark = ts
            _, expired_accounts = self.expire_transactions(self.watermark)

        # Check if transaction is out-of-order and already outside the active window
        if self.watermark is not None and ts < (self.watermark - self.window_delta):
            self.last_expired_accounts = expired_accounts
            self.last_reason = "expired_out_of_order"
            return False, set()

        # Ensure nodes exist in graph
        if sender not in self.graph:
            self.graph.add_node(sender, is_sink=sender in self.sink_set)
        if receiver not in self.graph:
            self.graph.add_node(receiver, is_sink=receiver in self.sink_set)

        # Add directed edge
        self.graph.add_edge(
            sender,
            receiver,
            key=txn_id,
            transaction_id=txn_id,
            amount=amount,
            timestamp=ts,
            channel=txn.get("channel", "Unknown"),
            transaction_type=txn.get("transaction_type"),
        )
        self.active_window_txn_ids.add(txn_id)

        # Add to historical tracking with bounded capacity
        self.historical_seen_txn_ids.add(txn_id)
        self.historical_queue.append(txn_id)
        if len(self.historical_queue) > self.max_historical_txns:
            oldest = self.historical_queue.popleft()
            self.historical_seen_txn_ids.discard(oldest)

        txn_record = {
            "txn_id": txn_id,
            "sender": sender,
            "receiver": receiver,
            "amount": amount,
            "timestamp": ts,
        }
        self.active_transactions.append(txn_record)
        self.active_transactions.sort(key=lambda x: (x["timestamp"], x["txn_id"]))

        self.last_expired_accounts = expired_accounts
        self.last_reason = "added"
        return True, {sender, receiver}

    def expire_transactions(self, current_ts: datetime) -> Tuple[int, Set[str]]:
        """Evict transactions falling outside the sliding window relative to current_ts.

        Returns:
            (expired_count, expired_accounts)
        """
        cutoff = current_ts - self.window_delta
        expired = [t for t in self.active_transactions if t["timestamp"] < cutoff]
        if not expired:
            return 0, set()

        expired_accounts: Set[str] = set()
        for t in expired:
            sender = t["sender"]
            receiver = t["receiver"]
            k = t["txn_id"]
            if self.graph.has_edge(sender, receiver, key=k):
                self.graph.remove_edge(sender, receiver, key=k)
            self.active_window_txn_ids.discard(k)
            expired_accounts.add(sender)
            expired_accounts.add(receiver)

        self.active_transactions = [t for t in self.active_transactions if t["timestamp"] >= cutoff]
        return len(expired), expired_accounts

    def get_neighborhood(self, accounts: Iterable[str], hops: int = 1) -> Set[str]:
        """Return the expanded k-hop undirected neighborhood around given accounts."""
        neighborhood: Set[str] = set(accounts) & set(self.graph.nodes)
        current_layer: Set[str] = set(neighborhood)

        for _ in range(hops):
            next_layer: Set[str] = set()
            for node in current_layer:
                next_layer.update(self.graph.predecessors(node))
                next_layer.update(self.graph.successors(node))
            neighborhood.update(next_layer)
            current_layer = next_layer

        return neighborhood

    def get_neighborhood_subgraph(self, accounts: Iterable[str], hops: int = 1) -> nx.MultiDiGraph:
        """Extract the induced directed multigraph for the k-hop neighborhood."""
        nodes = self.get_neighborhood(accounts, hops=hops)
        return self.graph.subgraph(nodes).copy()

    def get_active_transactions_df(self) -> Any:
        """Return the active window transactions as a pandas DataFrame for batch comparison."""
        import pandas as pd
        if not self.active_transactions:
            return pd.DataFrame(columns=["transaction_id", "sender_account", "receiver_account", "amount", "timestamp", "transaction_status", "channel"])
        records = []
        for t in self.active_transactions:
            records.append({
                "transaction_id": t["txn_id"],
                "sender_account": t["sender"],
                "receiver_account": t["receiver"],
                "amount": t["amount"],
                "timestamp": t["timestamp"].isoformat(),
                "transaction_status": "Success",
                "channel": "Online",
            })
        return pd.DataFrame(records)

    def stats(self) -> Dict[str, Any]:
        """Return current sliding-window statistics."""
        return {
            "window_minutes": self.window_minutes,
            "watermark": self.watermark.isoformat() if self.watermark else None,
            "active_nodes": self.graph.number_of_nodes(),
            "active_edges": self.graph.number_of_edges(),
            "active_transactions": len(self.active_transactions),
            "historical_seen_count": len(self.historical_seen_txn_ids),
        }
