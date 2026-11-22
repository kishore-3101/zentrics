"""
TraceMesh Node Manager.
Handles account node lifecycle, attribute enrichment, degree management, and sink identification.
Optimized for high-throughput batch operations.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Set
import pandas as pd
import networkx as nx

logger = logging.getLogger(__name__)


class NodeManager:
    """Manages node properties, risk scores, features, and metadata inside a NetworkX graph."""

    def __init__(self, G: nx.MultiDiGraph):
        self.G = G
        self.sink_accounts: Set[str] = set()

    def add_or_update_node(self, account_id: str, **attrs) -> None:
        """Adds a node if missing or updates its attributes."""
        default_attrs = {
            "account_id": account_id,
            "in_degree": 0,
            "out_degree": 0,
            "total_incoming": 0.0,
            "total_outgoing": 0.0,
            "transaction_count": 0,
            "risk_score": 0.0,
            "role": "mule",
            "kyc_status": "minimal",
            "account_type": "savings",
            "is_sink": False,
            "is_frozen": False,
            "reason_codes": [],
        }

        if not self.G.has_node(account_id):
            default_attrs.update(attrs)
            self.G.add_node(account_id, **default_attrs)
        else:
            self.G.nodes[account_id].update(attrs)

        node_dict = self.G.nodes[account_id]
        if node_dict.get("is_sink", False) or node_dict.get("account_type") in ("sink", "atm", "merchant"):
            self.sink_accounts.add(account_id)

    def load_accounts_dataframe(self, accounts_df: pd.DataFrame) -> None:
        """Loads account metadata from pandas DataFrame into the graph using fast batch iteration."""
        if accounts_df is None or accounts_df.empty:
            return

        records = accounts_df.to_dict("records")
        nodes_to_add = []
        for row in records:
            acct_id = str(row["account_id"]).strip()
            acct_type = str(row.get("account_type", "savings")).lower()
            is_sink = acct_type in ("sink", "atm", "merchant", "crypto_exchange")
            if is_sink:
                self.sink_accounts.add(acct_id)

            attrs = {
                "account_id": acct_id,
                "customer_id": str(row.get("customer_id", "")),
                "age": int(row["age"]) if pd.notna(row.get("age")) else None,
                "account_type": acct_type,
                "account_open_date": str(row.get("account_open_date", "")),
                "account_age_days": int(row["account_age_days"]) if pd.notna(row.get("account_age_days")) else None,
                "kyc_status": str(row.get("kyc_status", "minimal")),
                "occupation": str(row.get("occupation", "")),
                "city": str(row.get("city", "")),
                "branch_id": str(row.get("branch_id", "")),
                "initial_balance": float(row.get("initial_balance", 0.0)),
                "is_sink": is_sink,
                "in_degree": 0,
                "out_degree": 0,
                "total_incoming": 0.0,
                "total_outgoing": 0.0,
                "transaction_count": 0,
                "risk_score": 0.0,
                "role": "mule",
                "is_frozen": False,
                "reason_codes": [],
            }
            nodes_to_add.append((acct_id, attrs))

        self.G.add_nodes_from(nodes_to_add)

    def get_node(self, account_id: str) -> Optional[Dict[str, Any]]:
        """Returns node attribute dictionary or None."""
        if self.G.has_node(account_id):
            return dict(self.G.nodes[account_id])
        return None

    def update_flow_metrics(self) -> None:
        """Calculates total in/out volumes and degrees for every node in the graph in linear time."""
        in_amounts: Dict[str, float] = {}
        out_amounts: Dict[str, float] = {}

        for u, v, d in self.G.edges(data=True):
            amt = d.get("amount", 0.0)
            out_amounts[u] = out_amounts.get(u, 0.0) + amt
            in_amounts[v] = in_amounts.get(v, 0.0) + amt

        for n, data in self.G.nodes(data=True):
            in_amt = in_amounts.get(n, 0.0)
            out_amt = out_amounts.get(n, 0.0)
            in_deg = self.G.in_degree(n)
            out_deg = self.G.out_degree(n)

            data["total_incoming"] = round(in_amt, 2)
            data["total_outgoing"] = round(out_amt, 2)
            data["in_degree"] = in_deg
            data["out_degree"] = out_deg
            data["transaction_count"] = in_deg + out_deg
