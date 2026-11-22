"""
Financial Exposure and Metric Calculator (Module 7 Deliverable).
Calculates total amount moved, amount cashed, and dynamic amount at risk.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Set, Tuple
import networkx as nx

from graph.shared.constants import ROLE_CASH_OUT, ROLE_VICTIM

logger = logging.getLogger(__name__)


def calculate_financial_exposure(
    cluster_nodes: Set[str],
    G: nx.MultiDiGraph,
    roles: Dict[str, str],
    sink_accounts: Optional[Set[str]] = None
) -> Dict[str, Any]:
    """
    Computes rigorous financial exposure:
    - amount_moved: Total volume transacted internally or out of victim/collector accounts in the ring.
    - amount_cashed: Total volume withdrawn at dedicated cash-out sinks (ATMs, external merchants, sinks).
    - amount_at_risk: Dynamic actionable uncashed balance remaining in transit (amount_moved - amount_cashed).
    - velocity: Flow velocity (total volume / active hours).
    """
    sinks = sink_accounts or set()
    internal_txns = []
    total_moved = 0.0
    total_cashed = 0.0

    timestamps = []

    for u, v, k, d in G.edges(keys=True, data=True):
        if u in cluster_nodes and v in cluster_nodes:
            amt = float(d.get("amount", 0.0))
            txn_id = d.get("transaction_id", k)
            ts = d.get("timestamp")
            if ts:
                timestamps.append(ts)

            total_moved += amt
            internal_txns.append(txn_id)

            # Check if destination is an explicit sink account or marked sink in node attributes
            v_type = str(G.nodes[v].get("account_type", "")).lower() if G.has_node(v) else ""
            if v in sinks or v_type in ("sink", "atm", "merchant", "crypto_exchange"):
                total_cashed += amt

    # Amount at risk is strictly non-negative uncashed money
    amount_at_risk = max(0.0, total_moved - total_cashed)

    # Calculate duration
    duration_min = 0.0
    if len(timestamps) >= 2:
        timestamps.sort()
        duration_sec = (timestamps[-1] - timestamps[0]).total_seconds()
        duration_min = max(1.0, duration_sec / 60.0)

    # Velocity in INR/hour
    velocity = (total_moved / (duration_min / 60.0)) if duration_min > 0 else total_moved

    return {
        "amount_moved": round(total_moved, 2),
        "amount_cashed": round(total_cashed, 2),
        "amount_at_risk": round(amount_at_risk, 2),
        "duration_min": round(duration_min, 1),
        "flow_velocity_inr_hr": round(velocity, 2),
        "transaction_count": len(internal_txns),
        "internal_transaction_ids": internal_txns,
    }
