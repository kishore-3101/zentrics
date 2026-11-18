"""Detector 6: Dormant Activation.

Detects accounts that were idle for a prolonged period and then suddenly exhibited
a surge of transaction activity.

Distinguishes between:
1. Confirmed Dormancy: Continuous daily summary records confirming zero transactions
   for >= dormant_days_threshold consecutive days without missing calendar dates.
2. Inactivity Gap: Gaps between transactions in observed logs or account open date,
   where continuous daily coverage is unavailable. Missing dates are not treated as
   confirmed zero-activity days.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set
import networkx as nx
import pandas as pd

from shared.models import Hit
from shared.utils import parse_timestamp


def detect_dormant_activation(
    graph: nx.MultiDiGraph,
    config: Dict[str, Any],
    daily_summary_df: Optional[pd.DataFrame] = None,
) -> List[Hit]:
    """Identify accounts that become active after a prolonged dormant period."""
    cfg = config.get("detectors", {}).get("dormant_activation", {})
    if not cfg.get("enabled", True):
        return []

    dormant_days_thresh = float(cfg.get("dormant_days_threshold", 30))
    min_recent_txns = int(cfg.get("min_recent_txns", 3))

    hits: List[Hit] = []

    # Path A: Continuous daily summary coverage (Confirmed Dormancy)
    if daily_summary_df is not None and not daily_summary_df.empty:
        # Sort accounts deterministically
        sorted_nodes = sorted(list(graph.nodes))
        node_set = set(sorted_nodes)

        summary_accs = daily_summary_df.groupby("account_id")
        for acc_id in sorted(summary_accs.groups.keys()):
            if str(acc_id) not in node_set:
                continue

            group = summary_accs.get_group(acc_id).copy()
            group["date_dt"] = pd.to_datetime(group["date"]).dt.date
            sorted_grp = group.sort_values("date_dt").reset_index(drop=True)

            consecutive_zero_days = 0
            max_zero_streak = 0
            spike_row = None
            streak_start_date = None
            prev_date = None

            for i, row in sorted_grp.iterrows():
                curr_date = row["date_dt"]
                txns = int(row.get("total_transactions", 0))

                # Check strict calendar-day continuity: must be exactly 1 day after prev_date
                if prev_date is not None:
                    day_gap = (curr_date - prev_date).days
                    if day_gap > 1:
                        # Missing calendar dates detected! Missing dates cannot be assumed idle.
                        # Break consecutive zero-day streak.
                        consecutive_zero_days = 0
                        streak_start_date = None

                if txns == 0:
                    if consecutive_zero_days == 0:
                        streak_start_date = curr_date
                    consecutive_zero_days += 1
                    if consecutive_zero_days > max_zero_streak:
                        max_zero_streak = consecutive_zero_days
                else:
                    if consecutive_zero_days >= dormant_days_thresh and txns >= min_recent_txns:
                        spike_row = row
                        break
                    # Transaction occurred; reset zero streak
                    consecutive_zero_days = 0
                    streak_start_date = None

                prev_date = curr_date

            if spike_row is not None:
                spike_date = parse_timestamp(str(spike_row["date"]))
                vol = float(spike_row.get("total_incoming", 0)) + float(spike_row.get("total_outgoing", 0))
                evidence = {
                    "dormant_days": max_zero_streak,
                    "active_txn_count": int(spike_row.get("total_transactions", 0)),
                    "active_volume": round(vol, 2),
                    "activation_date": spike_date.isoformat(),
                    "dormancy_type": "confirmed_dormancy",
                    "is_confirmed": True,
                    "coverage_source": "continuous_daily_summary",
                }
                detail = (
                    f"Confirmed dormant activation: account verified idle for {max_zero_streak} continuous days "
                    f"in daily summaries, then transacted {spike_row['total_transactions']} times moving INR {vol:,.2f}."
                )
                hits.append(Hit(
                    account_id=str(acc_id),
                    code="dormant_active",
                    window_start=spike_date - timedelta(days=max_zero_streak),
                    window_end=spike_date,
                    severity="high" if max_zero_streak >= 60 else "medium",
                    evidence=evidence,
                    detail=detail,
                ))

    # Track accounts that already produced confirmed dormancy hits
    confirmed_account_ids: Set[str] = {h.account_id for h in hits}

    # Path B: Transaction log coverage (Inactivity Gap within Observed Dataset)
    # Evaluates all eligible graph accounts, collecting unconfirmed inactivity gaps
    # while skipping accounts that already have confirmed dormancy hits to avoid duplicates.
    for account_id in sorted(graph.nodes):
        if str(account_id) in confirmed_account_ids:
            continue

        if graph.degree(account_id) < min_recent_txns:
            continue

        node_data = graph.nodes[account_id]
        all_edges = list(graph.in_edges(account_id, data=True)) + list(graph.out_edges(account_id, data=True))
        if len(all_edges) < min_recent_txns:
            continue

        sorted_txns = sorted(all_edges, key=lambda e: (e[2]["timestamp"], str(e[2].get("transaction_id", ""))))
        timestamps = [e[2]["timestamp"] for e in sorted_txns]

        # Check internal transaction gaps between observed transactions (inactivity within observed data)
        gap_hit_found = False
        for i in range(len(timestamps) - 1):
            gap_days = (timestamps[i + 1] - timestamps[i]).total_seconds() / 86400.0
            if gap_days >= dormant_days_thresh:
                activation_ts = timestamps[i + 1]
                subsequent = [e for e in sorted_txns if activation_ts <= e[2]["timestamp"] <= activation_ts + timedelta(hours=48)]
                if len(subsequent) >= min_recent_txns:
                    vol = sum(e[2]["amount"] for e in subsequent)
                    hits.append(Hit(
                        account_id=str(account_id),
                        code="dormant_active",
                        window_start=timestamps[i],
                        window_end=subsequent[-1][2]["timestamp"],
                        severity="medium",
                        evidence={
                            "dormant_days": round(gap_days, 1),
                            "active_txn_count": len(subsequent),
                            "active_volume": round(vol, 2),
                            "activation_date": activation_ts.isoformat(),
                            "dormancy_type": "observed_inactivity_gap",
                            "is_confirmed": False,
                            "coverage_source": "transaction_log_gap",
                        },
                        detail=(
                            f"Possible inactivity gap: account had an unobserved gap of {gap_days:.0f} days "
                            f"between transactions, then executed {len(subsequent)} transfers moving INR {vol:,.2f}."
                        ),
                    ))
                    gap_hit_found = True
                    break

        if gap_hit_found:
            continue

        # Fallback: account opening date vs first transaction (mark as possible inactivity gap, not confirmed)
        open_date_str = node_data.get("account_open_date")
        if open_date_str:
            try:
                open_date = parse_timestamp(open_date_str)
                first_ts = timestamps[0]
                gap_days = (first_ts - open_date).total_seconds() / 86400.0
                if gap_days >= dormant_days_thresh:
                    burst_txns = [e for e in sorted_txns if e[2]["timestamp"] <= first_ts + timedelta(hours=48)]
                    if len(burst_txns) >= min_recent_txns:
                        vol = sum(e[2]["amount"] for e in burst_txns)
                        hits.append(Hit(
                            account_id=str(account_id),
                            code="dormant_active",
                            window_start=open_date,
                            window_end=burst_txns[-1][2]["timestamp"],
                            severity="low",
                            evidence={
                                "dormant_days": round(gap_days, 1),
                                "active_txn_count": len(burst_txns),
                                "active_volume": round(vol, 2),
                                "activation_date": first_ts.isoformat(),
                                "dormancy_type": "possible_inactivity_gap",
                                "is_confirmed": False,
                                "coverage_source": "account_open_date_gap",
                            },
                            detail=(
                                f"Possible inactivity gap (unconfirmed dormancy): account opened {gap_days:.0f} days "
                                f"prior to first observed transaction, followed by {len(burst_txns)} transfers moving INR {vol:,.2f}."
                            ),
                        ))
            except Exception:
                pass

    return hits
