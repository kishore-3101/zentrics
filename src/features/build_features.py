"""Module 8 feature pipeline. Spec: docs/feature_list.md.

Never reads gt_* tables or any label column. Same code path for batch and
windowed (streaming) use.
"""
import numpy as np
import pandas as pd

INCOME_MIDPOINT = {  # INR per month, proposed in docs/feature_list.md Section 5
    "low": 12_000, "lower_mid": 25_000, "mid": 50_000,
    "upper_mid": 100_000, "high": 250_000,
}
KYC_ORD = {"minimal": 0, "full": 1}
CASH_CHANNEL = "ATM_WITHDRAWAL"
IST = "Asia/Kolkata"  # open question 7: switch to UTC if the generator draws hours in UTC
FAST_FORWARD_MIN = 30

FEATURES = [
    # volume and flow
    "in_amount_total", "out_amount_total", "in_txn_count", "out_txn_count",
    "pass_through_ratio", "net_retention", "median_forward_time_min",
    "fast_forward_share", "max_in_1h", "max_out_1h", "burstiness", "amount_cv",
    # graph, stage 1 (table operations)
    "unique_senders", "unique_receivers", "degree_asymmetry",
    "top_counterparty_share", "reciprocal_share",
    # graph, stage 2 (needs Module 6 graph; NaN until wired in)
    "relay_count", "cycle_count_le4", "pagerank_amount", "two_hop_reach",
    "clustering_coef",
    # profile
    "account_age_days", "txn_per_age_day", "volume_to_income_ratio",
    "cash_out_share", "night_share", "new_beneficiary_rate",
    "dormancy_gap_days", "kyc_level_ord",
]
STAGE2 = ["relay_count", "cycle_count_le4", "pagerank_amount", "two_hop_reach",
          "clustering_coef"]


def _rolling_max_count(df: pd.DataFrame, key: str) -> pd.Series:
    """Max number of txns in any rolling 1 h window, per account."""
    if df.empty:
        return pd.Series(dtype="float64")
    r = df.sort_values("ts").set_index("ts").groupby(key)["amount"].rolling("1h").count()
    return r.groupby(level=0).max()


def build_features(
    txns: pd.DataFrame,
    accounts: pd.DataFrame,
    window_start: pd.Timestamp,
    window_end: pd.Timestamp,
    account_ids: list[str] | None = None,
    lookback_days: int = 30,
) -> pd.DataFrame:
    ws, we = pd.Timestamp(window_start), pd.Timestamp(window_end)
    if ws.tzinfo is None:
        ws, we = ws.tz_localize("UTC"), we.tz_localize("UTC")
    win_min = (we - ws).total_seconds() / 60

    t = txns[["src_account", "dst_account", "amount", "ts", "channel"]].copy()
    t["ts"] = pd.to_datetime(t["ts"], utc=True)
    t = t[t["ts"] < we]  # rule 4: nothing at or after window_end
    hist = t[(t["ts"] >= ws - pd.Timedelta(days=lookback_days)) & (t["ts"] < ws)]
    w = t[t["ts"] >= ws]

    acc = accounts[accounts["account_type"] != "sink"].copy()  # sinks are never scored
    if account_ids is not None:
        acc = acc[acc["account_id"].isin(account_ids)]
    acc["open_date"] = pd.to_datetime(acc["open_date"], utc=True)
    bad = acc["open_date"] > we
    if bad.any():  # data bug, spec Section 6
        print(f"WARN: dropping {bad.sum()} accounts with open_date after window_end")
        acc = acc[~bad]
    out = acc.set_index("account_id")[[]].copy()

    ins = w.rename(columns={"dst_account": "acct", "src_account": "cp"})
    outs = w.rename(columns={"src_account": "acct", "dst_account": "cp"})

    # --- volume and flow -------------------------------------------------
    out["in_amount_total"] = ins.groupby("acct")["amount"].sum()
    out["out_amount_total"] = outs.groupby("acct")["amount"].sum()
    out["in_txn_count"] = ins.groupby("acct")["amount"].size()
    out["out_txn_count"] = outs.groupby("acct")["amount"].size()
    for c in ["in_amount_total", "out_amount_total", "in_txn_count", "out_txn_count"]:
        out[c] = out[c].fillna(0.0)
    i, o = out["in_amount_total"], out["out_amount_total"]
    out["pass_through_ratio"] = (o / (i + 1)).clip(0, 5)
    out["net_retention"] = (i - o) / (i + o + 1)

    # time since the latest earlier credit, for every debit
    fwd = pd.merge_asof(
        outs.sort_values("ts")[["acct", "ts", "amount"]],
        ins.sort_values("ts")[["acct", "ts"]].rename(columns={"ts": "in_ts"}),
        left_on="ts", right_on="in_ts", by="acct", direction="backward",
    )
    fwd["delay_min"] = (fwd["ts"] - fwd["in_ts"]).dt.total_seconds() / 60
    med = fwd.dropna(subset=["delay_min"]).groupby("acct")["delay_min"].median()
    out["has_forward"] = out.index.isin(med.index).astype("float32")
    out["median_forward_time_min"] = med.reindex(out.index).fillna(win_min)
    fast = fwd[fwd["delay_min"] <= FAST_FORWARD_MIN].groupby("acct")["amount"].sum()
    out["fast_forward_share"] = (fast.reindex(out.index).fillna(0) / o.where(o > 0)).fillna(0)

    out["max_in_1h"] = _rolling_max_count(ins, "acct").reindex(out.index).fillna(0)
    out["max_out_1h"] = _rolling_max_count(outs, "acct").reindex(out.index).fillna(0)

    both = pd.concat([ins, outs])[["acct", "cp", "amount", "ts"]].sort_values("ts")
    gap_s = both.groupby("acct")["ts"].diff().dt.total_seconds()
    gstat = gap_s.groupby(both["acct"]).agg(["mean", "std"])
    n_both = both.groupby("acct").size()
    burst = ((gstat["std"] - gstat["mean"]) / (gstat["std"] + gstat["mean"])).where(n_both >= 3)
    out["burstiness"] = burst.reindex(out.index).fillna(0)
    amt = both.groupby("acct")["amount"].agg(["mean", "std"])
    cv = (amt["std"] / amt["mean"]).where(n_both >= 3)
    out["amount_cv"] = cv.reindex(out.index).fillna(0)

    # --- graph, stage 1 --------------------------------------------------
    out["unique_senders"] = ins.groupby("acct")["cp"].nunique().reindex(out.index).fillna(0)
    out["unique_receivers"] = outs.groupby("acct")["cp"].nunique().reindex(out.index).fillna(0)
    us, ur = out["unique_senders"], out["unique_receivers"]
    out["degree_asymmetry"] = (us - ur) / (us + ur + 1)

    pair = both.groupby(["acct", "cp"])["amount"].sum()
    top = pair.groupby(level=0).max() / pair.groupby(level=0).sum()
    out["top_counterparty_share"] = top.reindex(out.index).fillna(0)

    sent_to = set(map(tuple, outs[["acct", "cp"]].drop_duplicates().to_numpy()))
    got_from = set(map(tuple, ins[["acct", "cp"]].drop_duplicates().to_numpy()))
    n_cp = pair.groupby(level=0).size()
    n_recip = pd.Series(
        pd.Series([a for a, _ in sent_to & got_from], dtype="object").value_counts()
    ) if sent_to & got_from else pd.Series(dtype="float64")
    out["reciprocal_share"] = (n_recip.reindex(out.index).fillna(0)
                               / n_cp.reindex(out.index)).fillna(0)

    for c in STAGE2:  # TODO(Module 6): fill from GR's graph
        out[c] = np.nan

    # --- profile -----------------------------------------------------------
    a = acc.set_index("account_id").loc[out.index]
    out["account_age_days"] = (we - a["open_date"]).dt.total_seconds() / 86400
    out["txn_per_age_day"] = (out["in_txn_count"] + out["out_txn_count"]) / out["account_age_days"].clip(lower=1)
    mid = a["declared_income_band"].map(INCOME_MIDPOINT)
    out["volume_to_income_ratio"] = (i * 30 / (win_min / 1440)) / mid

    cash = outs[outs["channel"] == CASH_CHANNEL].groupby("acct")["amount"].sum()
    out["cash_out_share"] = (cash.reindex(out.index).fillna(0) / o.where(o > 0)).fillna(0)

    hours = both["ts"].dt.tz_convert(IST).dt.hour
    night = (hours >= 1) & (hours < 5)
    out["night_share"] = (night.groupby(both["acct"]).mean()).reindex(out.index).fillna(0)

    prior = pd.concat([hist.rename(columns={"src_account": "acct", "dst_account": "cp"}), outs])
    prior = prior.sort_values("ts")
    prior["first_time"] = ~prior.duplicated(["acct", "cp"])
    new_n = prior[(prior["ts"] >= ws) & prior["first_time"]].groupby("acct").size()
    out["new_beneficiary_rate"] = (new_n.reindex(out.index).fillna(0)
                                   / out["out_txn_count"].where(out["out_txn_count"] > 0)).fillna(0)

    last_before = pd.concat([
        hist.rename(columns={"src_account": "acct"})[["acct", "ts"]],
        hist.rename(columns={"dst_account": "acct"})[["acct", "ts"]],
    ]).groupby("acct")["ts"].max()
    first_in_w = both.groupby("acct")["ts"].min()
    gap = (first_in_w - last_before.reindex(first_in_w.index)).dt.total_seconds() / 86400
    gap = gap.fillna(lookback_days)  # no prior txn in the lookback
    out["dormancy_gap_days"] = gap.reindex(out.index).fillna(0)  # no txn in W: not waking up

    out["kyc_level_ord"] = a["kyc_level"].map(KYC_ORD)

    res = out[FEATURES + ["has_forward"]].astype("float32").reset_index()
    res.insert(1, "window_start", ws)
    res.insert(2, "window_end", we)
    return res
