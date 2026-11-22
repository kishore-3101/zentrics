"""Module 8 baselines (docs/feature_list.md Section 7). No ML, no labels."""
import pandas as pd


def baseline_a(feats: pd.DataFrame) -> pd.Series:
    """Per-account rules, no graph. Score = rules hit / 4, indexed by account_id."""
    hits = (
        (feats["account_age_days"] < 30).astype(int)
        + (feats["kyc_level_ord"] == 0).astype(int)
        + (feats["volume_to_income_ratio"] > 3).astype(int)
        + ((feats["pass_through_ratio"] > 0.9)
           & (feats["median_forward_time_min"] < 60)).astype(int)
    )
    return pd.Series((hits / 4).to_numpy(), index=feats["account_id"], name="baseline_a")


def baseline_b(txns: pd.DataFrame, account_ids) -> pd.Series:
    """Volume threshold. Score = max daily outgoing amount per account."""
    t = txns[["src_account", "amount", "ts"]].copy()
    t["day"] = pd.to_datetime(t["ts"], utc=True).dt.floor("D")
    daily = t.groupby(["src_account", "day"])["amount"].sum()
    score = daily.groupby(level=0).max().reindex(account_ids).fillna(0.0)
    score.name = "baseline_b"
    return score


def flag_top_n(score: pd.Series, n: int) -> pd.Series:
    """Alert budget: flag the n highest scores (ties broken by order)."""
    flags = pd.Series(False, index=score.index)
    flags[score.sort_values(ascending=False, kind="stable").index[:n]] = True
    return flags
