"""
risk_scoring.py – Unified account risk score fusion.
Combines ML probability, rule score, and neighbour risk.
"""
import logging

import numpy as np
import pandas as pd

from src.config import RISK_WEIGHTS, RISK_THRESHOLDS, OUTPUTS_DIR

logger = logging.getLogger(__name__)


def compute_neighbor_risk(
    account_features: pd.DataFrame,
    ml_probabilities: pd.Series,
    transactions: pd.DataFrame,
) -> dict:
    """
    Compute neighbor risk for each account as the mean ML probability
    of its direct transaction counterparts (no ground-truth used).
    Uses dictionary lookups for high performance.
    """
    prob_map = ml_probabilities.to_dict() if hasattr(ml_probabilities, 'to_dict') else dict(ml_probabilities)
    prob_map = {str(k): float(v) for k, v in prob_map.items()}

    in_counterparts = transactions.groupby("dst_account")["src_account"].unique().to_dict()
    out_counterparts = transactions.groupby("src_account")["dst_account"].unique().to_dict()

    nbr_risk = {}
    for acct in account_features["account_id"]:
        acct_str = str(acct)
        srcs = in_counterparts.get(acct_str, [])
        dsts = out_counterparts.get(acct_str, [])
        counterparts = set(srcs) | set(dsts)

        probs = [prob_map.get(str(c), 0.0) for c in counterparts]
        nbr_risk[acct_str] = float(np.mean(probs)) if probs else 0.0

    return nbr_risk


def compute_risk_scores(
    account_features: pd.DataFrame,
    ml_probabilities: pd.Series | dict,       # account_id -> P(mule)
    rule_results: pd.DataFrame,               # contains account_id + rule_score_raw
    transactions: pd.DataFrame,
    weights: dict | None = None,
    thresholds: dict | None = None,
) -> pd.DataFrame:
    """
    Fuse ML, rule, and neighbor scores into a unified risk score.
    Formula: 0.5 * ml_prob + 0.3 * rule_score + 0.2 * neighbor_risk
    Returns a DataFrame with one row per account.
    """
    weights    = weights    or RISK_WEIGHTS
    thresholds = thresholds or RISK_THRESHOLDS

    df = account_features[["account_id"]].copy()
    df["account_id"] = df["account_id"].astype(str)

    # --- ML probability ---
    if isinstance(ml_probabilities, pd.Series):
        if set(account_features["account_id"].astype(str)[:10]).issubset(set(str(k) for k in ml_probabilities.index[:20])):
            prob_dict = {str(k): float(v) for k, v in ml_probabilities.items()}
        elif len(ml_probabilities) == len(account_features):
            prob_dict = dict(zip(account_features["account_id"].astype(str), ml_probabilities.values))
        else:
            prob_dict = {str(k): float(v) for k, v in ml_probabilities.items()}
    elif isinstance(ml_probabilities, dict):
        prob_dict = {str(k): float(v) for k, v in ml_probabilities.items()}
    else:
        prob_dict = dict(ml_probabilities)

    df["ml_prob"] = df["account_id"].map(prob_dict).fillna(0.0)

    # --- Rule score ---
    if "rule_score_raw" in rule_results.columns:
        rule_map = dict(zip(rule_results["account_id"].astype(str), rule_results["rule_score_raw"]))
    elif "rule_detector_count" in rule_results.columns:
        rule_map = dict(zip(rule_results["account_id"].astype(str), rule_results["rule_detector_count"] / 6.0))
    else:
        rule_map = {}
    df["rule_score_raw"] = df["account_id"].map(rule_map).fillna(0.0)

    # --- Neighbor risk ---
    logger.info("Computing neighbor risk…")
    prob_series = df.set_index("account_id")["ml_prob"]
    nbr_risk_dict = compute_neighbor_risk(df, prob_series, transactions)
    df["neighbor_risk_raw"] = df["account_id"].map(nbr_risk_dict).fillna(0.0)

    # --- Normalization (all components are naturally bounded in [0, 1]) ---
    df["ml_prob_norm"]       = df["ml_prob"].clip(0.0, 1.0)
    df["rule_score_norm"]    = df["rule_score_raw"].clip(0.0, 1.0)
    df["neighbor_risk_norm"] = df["neighbor_risk_raw"].clip(0.0, 1.0)

    # --- Fused score (0–1) ---
    df["account_risk_01"] = (
        weights["ml_probability"] * df["ml_prob_norm"] +
        weights["rule_score"]     * df["rule_score_norm"] +
        weights["neighbor_risk"]  * df["neighbor_risk_norm"]
    )

    # --- Scale to 0–100 ---
    df["account_risk_score"] = (df["account_risk_01"] * 100).round(2)

    # --- Risk category ---
    def categorize(score):
        if score >= thresholds["high"]:
            return "High Risk"
        elif score >= thresholds["medium"]:
            return "Medium Risk"
        else:
            return "Low Risk"

    df["risk_category"] = df["account_risk_score"].apply(categorize)

    logger.info("Risk score distribution:\n%s",
                df["risk_category"].value_counts().to_string())

    # --- Save suspicious accounts (Medium and High risk) ---
    susp = df[df["risk_category"].isin(["High Risk", "Medium Risk"])].sort_values("account_risk_score", ascending=False)
    susp_path = OUTPUTS_DIR / "suspicious_accounts.csv"
    susp.to_csv(susp_path, index=False)
    logger.info("Suspicious accounts saved → %s  (%d flagged)", susp_path, len(susp))

    return df
