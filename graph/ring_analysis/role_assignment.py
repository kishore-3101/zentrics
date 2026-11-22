"""
Role Assignment Engine (Module 7 Deliverable).
Assigns explicit roles (victim, collector, mule, cash_out) to ring accounts
based on graph topology, flow directionality, degrees, and detector evidence.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Set
import networkx as nx

from graph.shared.constants import (
    DETECTOR_CIRCULAR,
    DETECTOR_FAN_IN,
    DETECTOR_FAN_OUT,
    ROLE_CASH_OUT,
    ROLE_COLLECTOR,
    ROLE_MULE,
    ROLE_VICTIM,
)
from graph.shared.schemas import DetectorHit

logger = logging.getLogger(__name__)


def assign_account_roles(
    cluster_nodes: Set[str],
    G: nx.MultiDiGraph,
    hits: List[DetectorHit],
    account_risks: Dict[str, float],
    sink_accounts: Optional[Set[str]] = None
) -> Dict[str, str]:
    """
    Assigns professional forensic roles:
    - victim: Inflow source from outside ring or high out-degree to ring, low risk score (<35), zero incoming from mules.
    - collector: Aggregation hub receiving funds from multiple victims/senders, high in-degree, fan_in hit.
    - cash_out: Terminal node (ATM, merchant, foreign bank, or zero outgoing inside the ring with high incoming).
    - mule: Intermediary transit node forwarding funds between collector and cash-out, or participating in cycles/layering.
    """
    sinks = sink_accounts or set()
    roles: Dict[str, str] = {}
    hits_by_acct = {h.account_id: h for h in hits}

    # Extract cluster-induced subgraph to analyze internal flow
    sub_G = G.subgraph(cluster_nodes)

    for acct in cluster_nodes:
        # Check 1: Explicit Sink (ATM, Merchant, Crypto exchange, or marked sink)
        node_data = G.nodes[acct] if G.has_node(acct) else {}
        acct_type = str(node_data.get("account_type", "")).lower()
        if acct in sinks or acct_type in ("sink", "atm", "merchant", "crypto_exchange"):
            roles[acct] = ROLE_CASH_OUT
            continue

        # Check 2: Low-risk entry victim (e.g. risk < 35, high internal out-degree, zero internal in-degree)
        risk = account_risks.get(acct, 0.0)
        internal_in = sub_G.in_degree(acct) if sub_G.has_node(acct) else 0
        internal_out = sub_G.out_degree(acct) if sub_G.has_node(acct) else 0

        if risk < 35.0 and internal_in == 0 and internal_out > 0:
            roles[acct] = ROLE_VICTIM
            continue

        # Check 3: Terminal cash-out inside the ring (internal_out == 0, internal_in > 0)
        if internal_out == 0 and internal_in > 0:
            roles[acct] = ROLE_CASH_OUT
            continue

        # Check 4: Collector Hub (has Fan-in hit or high internal/external in-degree ratio)
        has_fan_in = any(h.code == DETECTOR_FAN_IN for h in hits if h.account_id == acct)
        if has_fan_in or (internal_in >= 2 and internal_out >= 1 and internal_in >= internal_out):
            roles[acct] = ROLE_COLLECTOR
            continue

        # Default: Intermediary Mule (participates in chains, cycles, pass-throughs)
        roles[acct] = ROLE_MULE

    # Fallback sanity check: Ensure ring has at least one collector or mule
    mule_or_col = [a for a, r in roles.items() if r in (ROLE_MULE, ROLE_COLLECTOR)]
    if not mule_or_col and cluster_nodes:
        # Pick the node with highest out-flow as collector
        top_node = max(cluster_nodes, key=lambda a: sub_G.out_degree(a) if sub_G.has_node(a) else 0)
        roles[top_node] = ROLE_COLLECTOR

    return roles
