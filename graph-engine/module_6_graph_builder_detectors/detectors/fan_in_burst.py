"""Detector 1: Fan-in Burst."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List
import networkx as nx

from shared.models import Hit


def detect_fan_in_burst(graph: nx.MultiDiGraph, config: Dict[str, Any]) -> List[Hit]:
    """Identify accounts receiving money from many unique accounts within a short time window."""
    cfg = config.get("detectors", {}).get("fan_in_burst", {})
    if not cfg.get("enabled", True):
        return []

    window_minutes = int(cfg.get("window_minutes", 60))
    min_senders = int(cfg.get("min_senders", 5))
    min_amount = float(cfg.get("min_amount", 1000.0))
    window_delta = timedelta(minutes=window_minutes)

    hits: List[Hit] = []

    for account_id in sorted(graph.nodes):
        in_edges = graph.in_edges(account_id, keys=True, data=True)
        if len(in_edges) < min_senders:
            continue

        sorted_in = sorted(in_edges, key=lambda e: e[3]["timestamp"])
        n = len(sorted_in)

        # Sliding window check
        right = 0
        reported_windows = []

        for left in range(n):
            w_start = sorted_in[left][3]["timestamp"]
            w_end = w_start + window_delta

            while right < n and sorted_in[right][3]["timestamp"] <= w_end:
                right += 1

            window_edges = sorted_in[left:right]
            senders = {e[0] for e in window_edges}
            total_amount = sum(e[3]["amount"] for e in window_edges)

            if len(senders) >= min_senders and total_amount >= min_amount:
                # Check for overlap with already reported windows for this account
                overlap = False
                for r_start, r_end in reported_windows:
                    if abs((w_start - r_start).total_seconds()) < window_minutes * 30:  # half-window deduplication
                        overlap = True
                        break
                if overlap:
                    continue

                actual_end = window_edges[-1][3]["timestamp"]
                severity = "critical" if len(senders) >= 2 * min_senders or total_amount >= 5 * min_amount else "high"
                evidence = {
                    "unique_senders": len(senders),
                    "total_inflow": round(total_amount, 2),
                    "window_minutes": window_minutes,
                    "transaction_count": len(window_edges),
                    "sender_sample": sorted(list(senders))[:5],
                }
                detail = (
                    f"Fan-in burst: received INR {total_amount:,.2f} from {len(senders)} unique senders "
                    f"across {len(window_edges)} transfers within {window_minutes} minutes."
                )

                hits.append(Hit(
                    account_id=str(account_id),
                    code="fan_in_burst",
                    window_start=w_start,
                    window_end=actual_end,
                    severity=severity,
                    evidence=evidence,
                    detail=detail,
                ))
                reported_windows.append((w_start, actual_end))

    return hits
