"""
Fan-In Burst Detector (Module 6 Deliverable).
Identifies accounts receiving funds from multiple distinct senders within a rolling time window.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import networkx as nx

from graph.shared.constants import DETECTOR_FAN_IN, SEVERITY_HIGH, SEVERITY_MEDIUM
from graph.shared.schemas import DetectorHit

logger = logging.getLogger(__name__)


class FanInDetector:
    """Detects sudden aggregation of incoming funds from multiple victims/senders."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        cfg = config or {}
        self.min_unique_senders = cfg.get("min_unique_senders", 5)
        self.time_window_hours = cfg.get("time_window_hours", 24)
        self.min_amount = cfg.get("min_amount", 100.0)
        self.min_burst_volume = cfg.get("min_burst_volume", 1000.0)

    def detect(self, G: nx.MultiDiGraph) -> List[DetectorHit]:
        hits: List[DetectorHit] = []
        window_delta = timedelta(hours=self.time_window_hours)

        for node in G.nodes:
            in_edges = []
            for u, v, key, data in G.in_edges(node, keys=True, data=True):
                amt = data.get("amount", 0.0)
                ts = data.get("timestamp")
                if amt >= self.min_amount and ts is not None:
                    in_edges.append((ts, u, amt, data.get("transaction_id", key)))

            if len(in_edges) < self.min_unique_senders:
                continue

            # Sort incoming edges by timestamp
            in_edges.sort(key=lambda x: x[0])

            # Sliding window over incoming edges
            n = len(in_edges)
            start_idx = 0
            best_window_senders = set()
            best_window_txns = []
            best_window_vol = 0.0
            best_start_ts = None
            best_end_ts = None

            for end_idx in range(n):
                cur_end_ts = in_edges[end_idx][0]
                while cur_end_ts - in_edges[start_idx][0] > window_delta and start_idx < end_idx:
                    start_idx += 1

                window_slice = in_edges[start_idx : end_idx + 1]
                senders = {item[1] for item in window_slice}

                if len(senders) >= self.min_unique_senders:
                    vol = sum(item[2] for item in window_slice)
                    if vol >= self.min_burst_volume and len(senders) > len(best_window_senders):
                        best_window_senders = senders
                        best_window_txns = [item[3] for item in window_slice]
                        best_window_vol = vol
                        best_start_ts = window_slice[0][0]
                        best_end_ts = cur_end_ts

            if len(best_window_senders) >= self.min_unique_senders:
                severity = SEVERITY_HIGH if len(best_window_senders) >= self.min_unique_senders * 2 else SEVERITY_MEDIUM
                display = (
                    f"Fan-In Burst: {len(best_window_senders)} distinct senders aggregated "
                    f"₹{best_window_vol:,.2f} into account within {self.time_window_hours}h window."
                )
                hit = DetectorHit(
                    account_id=node,
                    code=DETECTOR_FAN_IN,
                    window_start=best_start_ts,
                    window_end=best_end_ts,
                    severity=severity,
                    evidence={
                        "unique_senders_count": len(best_window_senders),
                        "total_volume": round(best_window_vol, 2),
                        "time_window_hours": self.time_window_hours,
                        "senders": list(best_window_senders)[:20],
                    },
                    display_text=display,
                    supporting_txns=best_window_txns,
                    counterparties=list(best_window_senders),
                )
                hits.append(hit)

        return hits
