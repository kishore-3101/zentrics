"""Detector 2: Fan-out Split."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List
import networkx as nx

from shared.models import Hit


def detect_fan_out_split(graph: nx.MultiDiGraph, config: Dict[str, Any]) -> List[Hit]:
    """Identify accounts distributing money to many unique recipient accounts within a short time window."""
    cfg = config.get("detectors", {}).get("fan_out_split", {})
    if not cfg.get("enabled", True):
        return []

    window_minutes = int(cfg.get("window_minutes", 60))
    min_recipients = int(cfg.get("min_recipients", 4))
    min_amount = float(cfg.get("min_amount", 1000.0))
    inflow_lookback = timedelta(minutes=int(cfg.get("inflow_lookback_minutes", 60)))
    window_delta = timedelta(minutes=window_minutes)

    hits: List[Hit] = []

    for account_id in sorted(graph.nodes):
        out_edges = graph.out_edges(account_id, keys=True, data=True)
        if len(out_edges) < min_recipients:
            continue

        sorted_out = sorted(out_edges, key=lambda e: e[3]["timestamp"])
        n = len(sorted_out)
        right = 0
        reported_windows = []

        in_edges = sorted(graph.in_edges(account_id, keys=True, data=True), key=lambda e: e[3]["timestamp"])

        for left in range(n):
            w_start = sorted_out[left][3]["timestamp"]
            w_end = w_start + window_delta

            while right < n and sorted_out[right][3]["timestamp"] <= w_end:
                right += 1

            window_edges = sorted_out[left:right]
            recipients = {e[1] for e in window_edges}
            total_amount = sum(e[3]["amount"] for e in window_edges)

            if len(recipients) >= min_recipients and total_amount >= min_amount:
                overlap = False
                for r_start, r_end in reported_windows:
                    if abs((w_start - r_start).total_seconds()) < window_minutes * 30:
                        overlap = True
                        break
                if overlap:
                    continue

                actual_end = window_edges[-1][3]["timestamp"]

                # Check preceding inflow
                lookback_start = w_start - inflow_lookback
                prior_inflows = [
                    e[3]["amount"] for e in in_edges
                    if lookback_start <= e[3]["timestamp"] <= w_start
                ]
                preceding_inflow = sum(prior_inflows)

                severity = "critical" if (preceding_inflow > 0 and len(recipients) >= 2 * min_recipients) else "high"
                evidence = {
                    "unique_recipients": len(recipients),
                    "total_outflow": round(total_amount, 2),
                    "window_minutes": window_minutes,
                    "preceding_inflow": round(preceding_inflow, 2),
                    "recipient_sample": sorted(list(recipients))[:5],
                }
                detail = (
                    f"Fan-out split: distributed INR {total_amount:,.2f} to {len(recipients)} recipients "
                    f"across {len(window_edges)} transfers within {window_minutes} minutes"
                    f"{f' following INR {preceding_inflow:,.2f} inbound' if preceding_inflow > 0 else ''}."
                )

                hits.append(Hit(
                    account_id=str(account_id),
                    code="fan_out_split",
                    window_start=w_start,
                    window_end=actual_end,
                    severity=severity,
                    evidence=evidence,
                    detail=detail,
                ))
                reported_windows.append((w_start, actual_end))

    return hits
