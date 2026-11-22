"""
rule_detectors.py – Six independent rule-based fraud detectors.
Each detector returns per-account flag columns.
Optimized for high performance on medium-to-large transaction datasets.
"""
import logging
from datetime import timedelta

import numpy as np
import pandas as pd

from src.config import RULE_CFG, RULE_DETECTION_CSV

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1. FAN-IN BURST
# ---------------------------------------------------------------------------

def rule_fan_in(txn: pd.DataFrame, cfg: dict | None = None) -> pd.DataFrame:
    """
    Flag accounts receiving funds from ≥ min_unique_senders distinct
    senders within a rolling time_window_hours window.
    """
    cfg = cfg or RULE_CFG["fan_in"]
    min_senders = cfg["min_unique_senders"]
    window_h    = cfg["time_window_hours"]
    min_amount  = cfg["min_amount"]

    df = txn.dropna(subset=["dst_account", "src_account", "ts", "amount"]).copy()
    df = df[df["amount"] >= min_amount]
    df["ts"] = pd.to_datetime(df["ts"], errors="coerce")
    df = df.dropna(subset=["ts"]).sort_values("ts")

    flags = {}
    delta = timedelta(hours=window_h)

    for acct, grp in df.groupby("dst_account"):
        triggered = False
        ts_arr = grp["ts"].values
        src_arr = grp["src_account"].values
        n = len(ts_arr)

        # Sliding window using searchsorted
        for i in range(n):
            t_win_start = ts_arr[i] - np.timedelta64(window_h, "h")
            left_idx = np.searchsorted(ts_arr, t_win_start, side="left")
            unique_s = len(set(src_arr[left_idx:i+1]))
            if unique_s >= min_senders:
                triggered = True
                break
        flags[acct] = int(triggered)

    result = pd.DataFrame.from_dict(flags, orient="index", columns=["fan_in_flag"])
    result.index.name = "account_id"
    result = result.reset_index()
    result["fan_in_explanation"] = result["fan_in_flag"].map(
        {1: f"Received from ≥{min_senders} unique senders within {window_h}h",
         0: ""}
    )
    logger.info("Fan-in burst: %d accounts flagged", result["fan_in_flag"].sum())
    return result


# ---------------------------------------------------------------------------
# 2. RAPID PASS-THROUGH
# ---------------------------------------------------------------------------

def rule_rapid_passthrough(txn: pd.DataFrame, cfg: dict | None = None) -> pd.DataFrame:
    """
    Flag accounts that forward ≥ passthrough_ratio of incoming money
    within time_window_minutes of receiving it.
    """
    cfg         = cfg or RULE_CFG["rapid_passthrough"]
    ratio_thr   = cfg["passthrough_ratio"]
    window_min  = cfg["time_window_minutes"]

    df = txn.dropna(subset=["src_account", "dst_account", "ts", "amount"]).copy()
    df["ts"] = pd.to_datetime(df["ts"], errors="coerce")
    df = df.dropna(subset=["ts"]).sort_values("ts")

    incoming_map = {}
    for acct, grp in df.groupby("dst_account"):
        incoming_map[acct] = (grp["ts"].values, grp["amount"].values)

    outgoing_map = {}
    for acct, grp in df.groupby("src_account"):
        outgoing_map[acct] = (grp["ts"].values, grp["amount"].values)

    all_accts = set(incoming_map.keys()) | set(outgoing_map.keys())
    flags = {}
    win_delta = np.timedelta64(window_min, "m")

    for acct in all_accts:
        if acct not in incoming_map or acct not in outgoing_map:
            flags[acct] = 0
            continue

        in_ts, in_amt = incoming_map[acct]
        out_ts, out_amt = outgoing_map[acct]

        triggered = False
        for t_in, amt_in in zip(in_ts, in_amt):
            if amt_in <= 0:
                continue
            t_win_end = t_in + win_delta
            # Find outgoing in [t_in, t_win_end]
            i_left = np.searchsorted(out_ts, t_in, side="left")
            i_right = np.searchsorted(out_ts, t_win_end, side="right")
            if i_right > i_left:
                forwarded = float(out_amt[i_left:i_right].sum())
                if forwarded / amt_in >= ratio_thr:
                    triggered = True
                    break
        flags[acct] = int(triggered)

    result = pd.DataFrame.from_dict(flags, orient="index", columns=["passthrough_flag"])
    result.index.name = "account_id"
    result = result.reset_index()
    result["passthrough_explanation"] = result["passthrough_flag"].map(
        {1: f"Forwarded ≥{ratio_thr*100:.0f}% of incoming within {window_min}min",
         0: ""}
    )
    logger.info("Rapid pass-through: %d accounts flagged", result["passthrough_flag"].sum())
    return result


# ---------------------------------------------------------------------------
# 3. FAN-OUT SPLIT
# ---------------------------------------------------------------------------

def rule_fan_out_split(txn: pd.DataFrame, cfg: dict | None = None) -> pd.DataFrame:
    """
    Flag accounts distributing funds to ≥ min_new_beneficiaries distinct
    receivers within time_window_minutes.
    """
    cfg         = cfg or RULE_CFG["fan_out_split"]
    min_bene    = cfg["min_new_beneficiaries"]
    window_min  = cfg["time_window_minutes"]

    df = txn.dropna(subset=["src_account", "dst_account", "ts", "amount"]).copy()
    df["ts"] = pd.to_datetime(df["ts"], errors="coerce")
    df = df.dropna(subset=["ts"]).sort_values("ts")

    flags = {}
    for acct, grp in df.groupby("src_account"):
        ts_arr = grp["ts"].values
        dst_arr = grp["dst_account"].values
        n = len(ts_arr)
        triggered = False

        for i in range(n):
            t_win_end = ts_arr[i] + np.timedelta64(window_min, "m")
            right_idx = np.searchsorted(ts_arr, t_win_end, side="right")
            unique_rx = len(set(dst_arr[i:right_idx]))
            if unique_rx >= min_bene:
                triggered = True
                break
        flags[acct] = int(triggered)

    result = pd.DataFrame.from_dict(flags, orient="index", columns=["fan_out_flag"])
    result.index.name = "account_id"
    result = result.reset_index()
    result["fan_out_explanation"] = result["fan_out_flag"].map(
        {1: f"Distributed to ≥{min_bene} unique receivers within {window_min}min",
         0: ""}
    )
    logger.info("Fan-out split: %d accounts flagged", result["fan_out_flag"].sum())
    return result


# ---------------------------------------------------------------------------
# 4. LAYERING CHAIN
# ---------------------------------------------------------------------------

def rule_layering_chain(txn: pd.DataFrame, cfg: dict | None = None) -> pd.DataFrame:
    """
    Flag accounts in multi-hop layering chains of ≥ min_hops where:
    - consecutive amount differences are within amount_similarity_pct
    - delays between hops are ≤ max_delay_minutes
    """
    cfg         = cfg or RULE_CFG["layering_chain"]
    min_hops    = cfg["min_hops"]
    sim_pct     = cfg["amount_similarity_pct"]
    max_delay   = cfg["max_delay_minutes"]

    df = txn.dropna(subset=["src_account", "dst_account", "ts", "amount"]).copy()
    df["ts"] = pd.to_datetime(df["ts"], errors="coerce")
    df = df.dropna(subset=["ts"]).sort_values("ts")

    flagged = set()

    # Build adjacency: src → list of (dst, amount, ts)
    adj = {}
    for s, d, a, t in zip(df["src_account"], df["dst_account"], df["amount"], df["ts"]):
        adj.setdefault(s, []).append((d, a, t))

    def dfs(node, path, amounts, last_ts, depth):
        if depth >= min_hops:
            for n in path:
                flagged.add(n)
            return
        for (nxt, amt, ts) in adj.get(node, []):
            if ts < last_ts:
                continue
            delay = (ts - last_ts).total_seconds() / 60
            if delay > max_delay:
                continue
            if amounts and abs(amt - amounts[-1]) / max(amounts[-1], 1e-9) > sim_pct:
                continue
            if nxt not in path:
                dfs(nxt, path + [nxt], amounts + [amt], ts, depth + 1)

    for src in list(adj.keys()):
        for (dst, amt, ts) in adj[src]:
            dfs(dst, [src, dst], [amt], ts, 1)

    all_accounts = set(df["src_account"]) | set(df["dst_account"])
    result = pd.DataFrame({
        "account_id"           : list(all_accounts),
        "layering_flag"        : [int(a in flagged) for a in all_accounts],
    })
    result["layering_explanation"] = result["layering_flag"].map(
        {1: f"Participant in layering chain ≥{min_hops} hops within {max_delay}min",
         0: ""}
    )
    logger.info("Layering chain: %d accounts flagged", result["layering_flag"].sum())
    return result


# ---------------------------------------------------------------------------
# 5. CIRCULAR FLOW
# ---------------------------------------------------------------------------

def rule_circular_flow(txn: pd.DataFrame, cfg: dict | None = None) -> pd.DataFrame:
    """
    Detect directed cycles of length min_cycle_len..max_cycle_len
    occurring within time_window_hours.
    """
    cfg         = cfg or RULE_CFG["circular_flow"]
    min_len     = cfg["min_cycle_len"]
    max_len     = cfg["max_cycle_len"]
    window_h    = cfg["time_window_hours"]

    df = txn.dropna(subset=["src_account", "dst_account", "ts"]).copy()
    df["ts"] = pd.to_datetime(df["ts"], errors="coerce")
    df = df.dropna(subset=["ts"]).sort_values("ts")

    flagged = set()

    t_min = df["ts"].min()
    t_max = df["ts"].max()
    total_hours = max((t_max - t_min).total_seconds() / 3600, 1)
    n_windows   = max(int(total_hours // window_h) + 1, 1)

    for w in range(n_windows):
        w_start = t_min + timedelta(hours=w * window_h)
        w_end   = w_start + timedelta(hours=window_h)
        win     = df[(df["ts"] >= w_start) & (df["ts"] < w_end)]
        if win.empty:
            continue

        adj_w = {}
        for s, d in zip(win["src_account"], win["dst_account"]):
            adj_w.setdefault(s, set()).add(d)

        def find_cycles(start, node, path, depth):
            if depth > max_len:
                return
            for nxt in adj_w.get(node, set()):
                if nxt == start and depth >= min_len:
                    for n in path:
                        flagged.add(n)
                elif nxt not in path:
                    find_cycles(start, nxt, path | {nxt}, depth + 1)

        for node in adj_w:
            find_cycles(node, node, {node}, 1)

    all_accounts = set(df["src_account"]) | set(df["dst_account"])
    result = pd.DataFrame({
        "account_id"           : list(all_accounts),
        "circular_flag"        : [int(a in flagged) for a in all_accounts],
    })
    result["circular_explanation"] = result["circular_flag"].map(
        {1: f"Participant in directed cycle of length {min_len}–{max_len} within {window_h}h",
         0: ""}
    )
    logger.info("Circular flow: %d accounts flagged", result["circular_flag"].sum())
    return result


# ---------------------------------------------------------------------------
# 6. DORMANT ACTIVATION
# ---------------------------------------------------------------------------

def rule_dormant_activation(txn: pd.DataFrame, accounts: pd.DataFrame,
                             cfg: dict | None = None) -> pd.DataFrame:
    """
    Flag accounts inactive for > inactivity_days days that suddenly process
    volume ≥ volume_multiplier × their typical daily volume.
    Also flags brand-new accounts (account_age_days <= 30).
    """
    cfg             = cfg or RULE_CFG["dormant_activation"]
    inact_days      = cfg["inactivity_days"]
    vol_mult        = cfg["volume_multiplier"]

    df = txn.dropna(subset=["src_account", "dst_account", "ts", "amount"]).copy()
    df["ts"] = pd.to_datetime(df["ts"], errors="coerce")
    df = df.dropna(subset=["ts"]).sort_values("ts")

    flagged = set()

    # Build transaction lists per account
    acct_txns_map = {}
    for s, d, t, a in zip(df["src_account"], df["dst_account"], df["ts"], df["amount"]):
        acct_txns_map.setdefault(s, []).append((t, a))
        acct_txns_map.setdefault(d, []).append((t, a))

    for acct, txns in acct_txns_map.items():
        if len(txns) < 2:
            continue
        txns.sort(key=lambda x: x[0])
        gaps = [(txns[i][0] - txns[i-1][0]).total_seconds() / 86400 for i in range(1, len(txns))]
        if any(g > inact_days for g in gaps):
            gap_idx = next(i for i, g in enumerate(gaps) if g > inact_days)
            pre = txns[:gap_idx + 1]
            post = txns[gap_idx + 1:]
            if pre and post:
                pre_days  = max((pre[-1][0] - pre[0][0]).days, 1)
                post_days = max((post[-1][0] - post[0][0]).days, 1)
                pre_vol  = sum(x[1] for x in pre) / pre_days
                post_vol = sum(x[1] for x in post) / post_days
                if post_vol >= vol_mult * max(pre_vol, 1.0):
                    flagged.add(acct)

    new_accts = set()
    if "account_age_days" in accounts.columns and "account_id" in accounts.columns:
        new_accts = set(accounts[accounts["account_age_days"] <= 30]["account_id"])

    all_accts = set(df["src_account"]) | set(df["dst_account"])
    all_known = all_accts | set(accounts["account_id"]) if "account_id" in accounts.columns else all_accts
    result = pd.DataFrame({
        "account_id"             : list(all_known),
        "dormant_flag"           : [int(a in flagged or a in new_accts) for a in all_known],
    })
    result["dormant_explanation"] = result["dormant_flag"].map(
        {1: f"Dormant >{inact_days}d reactivated with ≥{vol_mult}× volume OR new account",
         0: ""}
    )
    logger.info("Dormant activation: %d accounts flagged", result["dormant_flag"].sum())
    return result


# ---------------------------------------------------------------------------
# Master rule runner
# ---------------------------------------------------------------------------

def run_all_rules(txn: pd.DataFrame, accounts: pd.DataFrame) -> pd.DataFrame:
    """
    Run all six detectors and merge results into a single per-account DataFrame.
    Returns a DataFrame with one row per account and all rule flag columns.
    """
    logger.info("Running all rule-based detectors…")

    r1 = rule_fan_in(txn)
    r2 = rule_rapid_passthrough(txn)
    r3 = rule_fan_out_split(txn)
    r4 = rule_layering_chain(txn)
    r5 = rule_circular_flow(txn)
    r6 = rule_dormant_activation(txn, accounts)

    all_accounts = pd.DataFrame({
        "account_id": list(
            set(txn["src_account"].dropna()) |
            set(txn["dst_account"].dropna()) |
            set(accounts["account_id"].dropna())
        )
    })

    merged = all_accounts
    for r in [r1, r2, r3, r4, r5, r6]:
        if not r.empty and "account_id" in r.columns:
            merged = merged.merge(r, on="account_id", how="left")

    flag_cols = [c for c in merged.columns if c.endswith("_flag")]
    merged[flag_cols] = merged[flag_cols].fillna(0).astype(int)

    merged["rule_detector_count"] = merged[flag_cols].sum(axis=1)
    merged["rule_score_raw"]      = merged["rule_detector_count"] / max(len(flag_cols), 1)

    exp_cols = [c for c in merged.columns if c.endswith("_explanation")]
    merged[exp_cols] = merged[exp_cols].fillna("")
    merged["rule_explanation"] = merged[exp_cols].apply(
        lambda row: " | ".join(str(v) for v in row if v and str(v).strip()), axis=1
    )

    RULE_DETECTION_CSV.parent.mkdir(parents=True, exist_ok=True)
    merged.to_csv(RULE_DETECTION_CSV, index=False)
    logger.info("Rule detection results saved → %s", RULE_DETECTION_CSV)
    logger.info("Rules complete: %d accounts evaluated.", len(merged))
    return merged
