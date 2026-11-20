"""
feature_engineering.py – Account-level feature engineering combining
transaction statistics, time-based patterns, and account profile data.
Graph-based features are merged separately via graph_builder.py.
"""
import logging

import numpy as np
import pandas as pd

from src.config import ACCOUNT_FEATURES_CSV

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# A. Transaction volume and flow features
# ---------------------------------------------------------------------------

def _volume_flow_features(txn: pd.DataFrame) -> pd.DataFrame:
    """Per-account incoming/outgoing volume and flow metrics."""
    successful = txn.copy()
    if "transaction_status" in txn.columns:
        successful = txn[txn["transaction_status"] != "Failed"]

    # Incoming aggregations
    inc = (
        successful.groupby("dst_account")["amount"]
        .agg(
            total_incoming="sum",
            incoming_count="count",
            avg_incoming="mean",
            max_incoming="max",
        )
        .rename_axis("account_id")
        .reset_index()
    )

    # Outgoing aggregations
    out = (
        successful.groupby("src_account")["amount"]
        .agg(
            total_outgoing="sum",
            outgoing_count="count",
            avg_outgoing="mean",
            max_outgoing="max",
        )
        .rename_axis("account_id")
        .reset_index()
    )

    feat = pd.merge(inc, out, on="account_id", how="outer").fillna(0)

    feat["net_amount"]          = feat["total_incoming"] - feat["total_outgoing"]
    feat["total_txn_count"]     = feat["incoming_count"] + feat["outgoing_count"]
    feat["passthrough_ratio"]   = np.where(
        feat["total_incoming"] > 0,
        feat["total_outgoing"] / feat["total_incoming"],
        0.0,
    )
    feat["net_retained_ratio"]  = np.where(
        feat["total_incoming"] > 0,
        feat["net_amount"] / feat["total_incoming"].clip(lower=1e-9),
        0.0,
    )
    # Clip passthrough_ratio to avoid > 1 due to initial balance draws
    feat["passthrough_ratio"]   = feat["passthrough_ratio"].clip(0, 10)

    logger.info("Volume/flow features: %d accounts", len(feat))
    return feat


# ---------------------------------------------------------------------------
# B. Time-based features (High-performance vectorized implementation)
# ---------------------------------------------------------------------------

def _time_features(txn: pd.DataFrame) -> pd.DataFrame:
    """
    Per-account time-behavioural features.
    Uses pre-grouped dictionaries for high performance on large datasets.
    """
    if "ts" not in txn.columns:
        logger.warning("No 'ts' column – skipping time features.")
        return pd.DataFrame(columns=["account_id"])

    df = txn.copy()
    df["ts"] = pd.to_datetime(df["ts"], errors="coerce")
    df = df.dropna(subset=["ts"])

    if "transaction_status" in df.columns:
        df = df[df["transaction_status"] != "Failed"]

    df = df.sort_values("ts")

    outgoing_dict = {}
    for acct, grp in df.groupby("src_account"):
        outgoing_dict[acct] = grp["ts"].values

    incoming_dict = {}
    for acct, grp in df.groupby("dst_account"):
        incoming_dict[acct] = grp["ts"].values

    all_accounts = set(outgoing_dict.keys()) | set(incoming_dict.keys())
    rows = []

    for acct in all_accounts:
        out_ts = outgoing_dict.get(acct, np.array([], dtype="datetime64[ns]"))
        in_ts  = incoming_dict.get(acct, np.array([], dtype="datetime64[ns]"))

        n_out = len(out_ts)
        n_in  = len(in_ts)
        total_t = n_out + n_in

        if total_t > 0:
            if n_out > 0 and n_in > 0:
                all_ts = np.sort(np.concatenate([out_ts, in_ts]))
            elif n_out > 0:
                all_ts = out_ts
            else:
                all_ts = in_ts

            hours = pd.DatetimeIndex(all_ts).hour
            night_pct = float(((hours >= 22) | (hours < 6)).mean())
        else:
            night_pct = 0.0
            all_ts = np.array([], dtype="datetime64[ns]")

        ttf_median = -1.0
        ttf_mean   = -1.0
        if n_in > 0 and n_out > 0:
            first_in  = in_ts[0]
            first_out = out_ts[0]
            if first_out >= first_in:
                diff_min = float((first_out - first_in) / np.timedelta64(1, "s") / 60.0)
                ttf_median = diff_min
                ttf_mean   = diff_min

        txn_10min = txn_1hr = txn_24hr = txn_7day = 0
        burstiness = 0.0
        gap_mean = -1.0
        long_inactivity = 0

        if len(all_ts) >= 2:
            t_start = all_ts[0]
            diff_s = (all_ts - t_start) / np.timedelta64(1, "s")
            txn_10min = int((diff_s <= 600).sum())
            txn_1hr   = int((diff_s <= 3600).sum())
            txn_24hr  = int((diff_s <= 86400).sum())
            txn_7day  = int((diff_s <= 86400 * 7).sum())

            gaps_s = np.diff(all_ts) / np.timedelta64(1, "s")
            long_inactivity = int((gaps_s > 90 * 86400).any())
            m = float(gaps_s.mean())
            s = float(gaps_s.std())
            burstiness = float(s / m) if m > 0 else 0.0
            gap_mean = m

        rows.append({
            "account_id"           : acct,
            "night_txn_pct"        : night_pct,
            "ttf_median_minutes"   : ttf_median,
            "ttf_mean_minutes"     : ttf_mean,
            "txn_in_10min"         : txn_10min,
            "txn_in_1hr"           : txn_1hr,
            "txn_in_24hr"          : txn_24hr,
            "txn_in_7day"          : txn_7day,
            "long_inactivity_flag" : long_inactivity,
            "txn_burstiness"       : burstiness,
            "avg_gap_seconds"      : gap_mean,
        })

    feat = pd.DataFrame(rows)
    logger.info("Time features: %d accounts", len(feat))
    return feat


# ---------------------------------------------------------------------------
# C. Account profile features (from accounts DataFrame)
# ---------------------------------------------------------------------------

def _account_profile_features(accounts: pd.DataFrame) -> pd.DataFrame:
    feat_cols = ["account_id"]
    available = []

    for col in ["account_age_days", "initial_balance", "age",
                "kyc_level_enc", "account_type_enc", "occupation_enc", "city_enc"]:
        if col in accounts.columns:
            available.append(col)

    feat = accounts[feat_cols + available].copy()

    # Volume vs income band proxy (use initial_balance as declared income proxy)
    if "initial_balance" in feat.columns and "account_age_days" in feat.columns:
        feat["balance_per_age_day"] = feat["initial_balance"] / feat["account_age_days"].clip(lower=1)

    # Dormant flag: account age very recent (<=30 days)
    if "account_age_days" in feat.columns:
        feat["new_account_flag"] = (feat["account_age_days"] <= 30).astype(int)

    logger.info("Account profile features: %d accounts, %d feature cols",
                len(feat), len(feat.columns) - 1)
    return feat


# ---------------------------------------------------------------------------
# D. Daily summary features (from account_daily_summary)
# ---------------------------------------------------------------------------

def _daily_summary_features(daily: pd.DataFrame) -> pd.DataFrame:
    if daily.empty:
        return pd.DataFrame(columns=["account_id"])

    agg = daily.groupby("account_id").agg(
        ds_total_days_active      =("total_transactions", lambda x: (x > 0).sum()),
        ds_avg_daily_txns         =("total_transactions", "mean"),
        ds_max_daily_txns         =("total_transactions", "max"),
        ds_avg_unique_senders     =("unique_senders", "mean"),
        ds_avg_unique_receivers   =("unique_receivers", "mean"),
        ds_avg_incoming           =("total_incoming", "mean"),
        ds_avg_outgoing           =("total_outgoing", "mean"),
        ds_max_incoming           =("total_incoming", "max"),
        ds_max_outgoing           =("total_outgoing", "max"),
        ds_avg_failed_txns        =("failed_transactions", "mean"),
        ds_total_failed_txns      =("failed_transactions", "sum"),
    ).reset_index()

    logger.info("Daily summary features: %d accounts", len(agg))
    return agg


# ---------------------------------------------------------------------------
# Master feature builder
# ---------------------------------------------------------------------------

def build_account_features(
    accounts: pd.DataFrame,
    transactions: pd.DataFrame,
    graph_features: pd.DataFrame | None = None,
    daily_summary: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """
    Merge all feature groups into one account-level feature table.
    Returns DataFrame indexed by account_id (column, not index).
    """
    logger.info("Building account features…")

    base = accounts[["account_id"]].copy()

    # A – Volume / flow
    vol  = _volume_flow_features(transactions)
    base = base.merge(vol, on="account_id", how="left")

    # B – Time-based
    time = _time_features(transactions)
    if not time.empty and "account_id" in time.columns:
        base = base.merge(time, on="account_id", how="left")

    # C – Account profile
    prof = _account_profile_features(accounts)
    base = base.merge(prof, on="account_id", how="left")

    # D – Daily summary
    if daily_summary is not None and not daily_summary.empty:
        ds = _daily_summary_features(daily_summary)
        base = base.merge(ds, on="account_id", how="left")

    # Graph features (computed separately)
    if graph_features is not None and not graph_features.empty:
        if "account_id" in graph_features.columns:
            base = base.merge(graph_features, on="account_id", how="left")

    numeric_cols = base.select_dtypes(include=[np.number]).columns
    base[numeric_cols] = base[numeric_cols].fillna(0)
    if "txn_burstiness" in base.columns:
        base["txn_burstiness"] = base["txn_burstiness"].fillna(0.0)

    label_cols = [c for c in ["is_mule", "ring_id"] if c in accounts.columns]
    for lc in label_cols:
        if lc not in base.columns:
            base = base.merge(accounts[["account_id", lc]], on="account_id", how="left")

    logger.info("Account feature table: %d rows × %d cols", *base.shape)

    ACCOUNT_FEATURES_CSV.parent.mkdir(parents=True, exist_ok=True)
    base.to_csv(ACCOUNT_FEATURES_CSV, index=False)
    logger.info("Saved account features → %s", ACCOUNT_FEATURES_CSV)

    return base
