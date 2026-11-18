"""Directed multigraph builder for transaction networks."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple, Union

import networkx as nx
import pandas as pd

from shared.utils import parse_timestamp

REQUIRED_ACCOUNT_COLUMNS = {"account_id"}
REQUIRED_TRANSACTION_COLUMNS = {
    "transaction_id",
    "sender_account",
    "receiver_account",
    "amount",
    "timestamp",
    "transaction_status",
    "channel",
}

ACCOUNT_ATTRIBUTES = [
    "account_type",
    "account_open_date",
    "account_age_days",
    "kyc_status",
    "occupation",
    "city",
    "branch_id",
]


def build_graph(
    accounts_df: pd.DataFrame,
    txns_df: pd.DataFrame,
    window: Optional[Tuple[Any, Any]] = None,
    sink_accounts: Optional[Iterable[str]] = None,
) -> nx.MultiDiGraph:
    """Build a MultiDiGraph from account and transaction DataFrames.

    Only successful transactions are added as money-movement edges.
    If supplied, ``window`` must be a (start, end) timestamp pair; both
    endpoints are included. Sinks are marked when reliable sink_accounts
    are provided; otherwise is_sink is set to None.

    Ground-truth fields (is_mule, is_fraud, ring_id, fraud_pattern)
    are deliberately not copied into graph nodes or edges.
    """
    missing_accounts = REQUIRED_ACCOUNT_COLUMNS - set(accounts_df.columns)
    missing_txns = REQUIRED_TRANSACTION_COLUMNS - set(txns_df.columns)
    if missing_accounts:
        raise ValueError(f"accounts_df is missing columns: {sorted(missing_accounts)}")
    if missing_txns:
        raise ValueError(f"txns_df is missing columns: {sorted(missing_txns)}")

    if accounts_df["account_id"].duplicated().any():
        raise ValueError("accounts_df contains duplicate account_id values")
    if txns_df["transaction_id"].duplicated().any():
        raise ValueError("txns_df contains duplicate transaction_id values")

    graph = nx.MultiDiGraph()

    sink_set: Set[str] = set(sink_accounts) if sink_accounts else set()

    # Add every known account as a node, including accounts with no transfers.
    for row in accounts_df.to_dict(orient="records"):
        account_id = str(row["account_id"])
        attrs = {col: row.get(col) for col in ACCOUNT_ATTRIBUTES if col in row}
        if sink_accounts is not None:
            attrs["is_sink"] = account_id in sink_set
        else:
            attrs["is_sink"] = None
        graph.add_node(account_id, **attrs)

    # Successful transfers represent completed money movement.
    successful = txns_df.loc[txns_df["transaction_status"].eq("Success")].copy()
    if not successful.empty:
        successful["timestamp"] = pd.to_datetime(successful["timestamp"], errors="raise")
        successful["amount"] = pd.to_numeric(successful["amount"], errors="raise")

        if (successful["amount"] <= 0).any():
            raise ValueError("Successful transactions must have positive amounts")

        if window is not None:
            if not isinstance(window, (tuple, list)) or len(window) != 2:
                raise ValueError("window must be a (start_timestamp, end_timestamp) tuple")
            start, end = pd.to_datetime(window[0]), pd.to_datetime(window[1])
            if start > end:
                raise ValueError("window start must be earlier than or equal to window end")
            successful = successful.loc[successful["timestamp"].between(start, end, inclusive="both")]

        known_accounts = set(graph.nodes)
        unknown_senders = set(successful["sender_account"].astype(str)) - known_accounts
        unknown_receivers = set(successful["receiver_account"].astype(str)) - known_accounts
        if unknown_senders or unknown_receivers:
            raise ValueError(
                "Transactions reference unknown accounts: "
                f"senders={len(unknown_senders)}, receivers={len(unknown_receivers)}"
            )

        # Use transaction_id as the edge key so parallel transfers are preserved.
        for row in successful.to_dict(orient="records"):
            s_acc = str(row["sender_account"])
            r_acc = str(row["receiver_account"])
            t_id = str(row["transaction_id"])
            ts = parse_timestamp(row["timestamp"])
            graph.add_edge(
                s_acc,
                r_acc,
                key=t_id,
                transaction_id=t_id,
                amount=float(row["amount"]),
                timestamp=ts,
                channel=row.get("channel", "Unknown"),
                transaction_type=row.get("transaction_type"),
            )

    graph.graph["successful_transaction_count"] = graph.number_of_edges()
    graph.graph["sink_status_source"] = "provided" if sink_accounts is not None else "not provided; is_sink is None"
    return graph


def get_window_view(
    graph: nx.MultiDiGraph,
    view: str = "1h",
    reference_time: Optional[datetime] = None,
) -> nx.MultiDiGraph:
    """Return an edge-filtered subgraph for a configured temporal window preset.

    Supported presets: '10m', '1h', '24h', '7d'.
    """
    preset_deltas = {
        "10m": timedelta(minutes=10),
        "1h": timedelta(hours=1),
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
    }
    if view not in preset_deltas:
        raise ValueError(f"Unsupported window view '{view}'. Choose from {list(preset_deltas.keys())}")

    delta = preset_deltas[view]

    if graph.number_of_edges() == 0:
        return graph.copy()

    # Find max edge timestamp if reference_time is not provided
    if reference_time is None:
        all_timestamps = [data["timestamp"] for _, _, data in graph.edges(data=True) if "timestamp" in data]
        if not all_timestamps:
            return graph.copy()
        reference_time = max(all_timestamps)

    cutoff = reference_time - delta

    subgraph = graph.copy()
    edges_to_remove = [
        (u, v, k)
        for u, v, k, data in graph.edges(keys=True, data=True)
        if "timestamp" in data and not (cutoff <= data["timestamp"] <= reference_time)
    ]
    subgraph.remove_edges_from(edges_to_remove)
    subgraph.graph["window_view"] = view
    subgraph.graph["window_start"] = cutoff
    subgraph.graph["window_end"] = reference_time
    return subgraph
