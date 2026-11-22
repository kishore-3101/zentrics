"""
ring_detection.py – Identifies connected fraudulent transaction rings
from suspicious high-risk accounts.
"""
import logging
from uuid import uuid4

import numpy as np
import pandas as pd
import networkx as nx

from src.config import RING_CFG, OUTPUTS_DIR

logger = logging.getLogger(__name__)


def detect_rings(
    risk_scores: pd.DataFrame,
    transactions: pd.DataFrame,
    cfg: dict | None = None,
) -> pd.DataFrame:
    """
    1. Select accounts above risk threshold.
    2. Build a subgraph of their transactions.
    3. Find connected components ≥ min_accounts_per_ring.
    4. Generate ring-level statistics.
    Returns ring summary DataFrame.
    """
    cfg             = cfg or RING_CFG
    risk_thr        = cfg["risk_threshold"]
    min_per_ring    = cfg["min_accounts_per_ring"]

    # Suspicious accounts
    suspicious = risk_scores[risk_scores["account_risk_score"] >= risk_thr]
    susp_set   = set(suspicious["account_id"])
    logger.info("Suspicious accounts above threshold %d: %d", risk_thr, len(susp_set))

    if len(susp_set) < min_per_ring:
        logger.warning("Not enough suspicious accounts to form rings.")
        return pd.DataFrame()

    # Build undirected subgraph among suspicious accounts
    G = nx.Graph()
    G.add_nodes_from(susp_set)

    txn_sub = transactions[
        transactions["src_account"].isin(susp_set) &
        transactions["dst_account"].isin(susp_set)
    ]
    for _, row in txn_sub.iterrows():
        src, dst, amt = row["src_account"], row["dst_account"], row["amount"]
        if G.has_edge(src, dst):
            G[src][dst]["weight"] += amt
            G[src][dst]["count"]  += 1
        else:
            G.add_edge(src, dst, weight=amt, count=1)

    # Connected components
    components = list(nx.connected_components(G))
    candidate_rings = [c for c in components if len(c) >= min_per_ring]
    logger.info("Candidate rings (connected components ≥ %d accounts): %d",
                min_per_ring, len(candidate_rings))

    # Louvain via greedy modularity (optional enrichment)
    try:
        louvain_comms = nx.community.greedy_modularity_communities(G)
        louvain_map   = {}
        for cid, comm in enumerate(louvain_comms):
            for node in comm:
                louvain_map[node] = cid
    except Exception:
        louvain_map = {}

    ring_rows = []
    for ring_idx, component in enumerate(candidate_rings):
        ring_id  = f"DETECTED_RING_{ring_idx+1:04d}"
        accounts = list(component)

        acct_risk = risk_scores[risk_scores["account_id"].isin(accounts)]
        ring_txns = transactions[
            transactions["src_account"].isin(accounts) |
            transactions["dst_account"].isin(accounts)
        ]

        # Money moved within ring
        ring_internal = ring_txns[
            ring_txns["src_account"].isin(accounts) &
            ring_txns["dst_account"].isin(accounts)
        ]

        if "ts" in ring_txns.columns:
            ring_txns_ts = pd.to_datetime(ring_txns["ts"], errors="coerce").dropna()
            time_span_hours = (
                (ring_txns_ts.max() - ring_txns_ts.min()).total_seconds() / 3600
                if len(ring_txns_ts) > 1 else 0
            )
        else:
            time_span_hours = np.nan

        distinct_in  = ring_txns[~ring_txns["src_account"].isin(accounts)]["src_account"].nunique()
        distinct_out = ring_txns[~ring_txns["dst_account"].isin(accounts)]["dst_account"].nunique()

        # Detector flags
        flag_cols = [c for c in acct_risk.columns if c.endswith("_flag")]
        detectors_triggered = acct_risk[flag_cols].any().sum() if flag_cols else 0

        # Pattern diversity
        patterns = set()
        if "fraud_pattern" in ring_txns.columns:
            patterns = set(ring_txns["fraud_pattern"].dropna().unique())

        # Priority score
        mean_risk = acct_risk["account_risk_score"].mean() if "account_risk_score" in acct_risk.columns else 0
        amt_at_risk = ring_internal["amount"].sum() if not ring_internal.empty else 0
        priority_score = (mean_risk / 100) * 0.6 + min(amt_at_risk / 1e7, 1.0) * 0.4

        ring_rows.append({
            "ring_id"                  : ring_id,
            "account_count"            : len(accounts),
            "accounts"                 : str(accounts[:10]) + ("…" if len(accounts) > 10 else ""),
            "member_accounts"          : accounts,
            "mean_risk_score"          : round(mean_risk, 2),
            "max_risk_score"           : round(acct_risk["account_risk_score"].max(), 2) if "account_risk_score" in acct_risk.columns else 0,
            "total_money_moved"        : round(ring_txns["amount"].sum(), 2),
            "amount_at_risk"           : round(amt_at_risk, 2),
            "time_span_hours"          : round(time_span_hours, 2) if not np.isnan(time_span_hours) else -1,
            "distinct_in_counterparties": distinct_in,
            "distinct_out_counterparties": distinct_out,
            "pattern_diversity"        : len(patterns),
            "patterns"                 : str(list(patterns)),
            "detectors_triggered"      : int(detectors_triggered),
            "ring_priority_score"      : round(priority_score, 4),
        })

    rings_df = pd.DataFrame(ring_rows).sort_values("ring_priority_score", ascending=False)

    out_path = OUTPUTS_DIR / "fraud_rings.csv"
    rings_df.to_csv(out_path, index=False)
    logger.info("Fraud rings saved → %s  (%d rings)", out_path, len(rings_df))

    return rings_df
