"""
Fan-Out Split Detector (Module 6 Deliverable).
Identifies accounts distributing funds to multiple distinct receiving accounts within a short window.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import networkx as nx

from graph.shared.constants import DETECTOR_FAN_OUT, SEVERITY_HIGH, SEVERITY_MEDIUM
from graph.shared.schemas import DetectorHit

logger = logging.getLogger(__name__)


class FanOutDetector:
    """Detects rapid dispersion of funds across multiple receivers/mules/cash-outs."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        cfg = config or {}
        self.min_unique_receivers = cfg.get("min_unique_receivers", 4)
        self.time_window_hours = cfg.get("time_window_hours", 24)
        self.min_amount = cfg.get("min_amount", 100.0)
        self.min_burst_volume = cfg.get("min_burst_volume", 1000.0)

    def detect(self, G: nx.MultiDiGraph) -> List[DetectorHit]:
        hits: List[DetectorHit] = []
        window_delta = timedelta(hours=self.time_window_hours)

        for node in G.nodes:
            out_edges = []
            for u, v, key, data in G.out_edges(node, keys=True, data=True):
                amt = data.get("amount", 0.0)
                ts = data.get("timestamp")
                if amt >= self.min_amount and ts is not None:
                    out_edges.append((ts, v, amt, data.get("transaction_id", key)))

            if len(out_edges) < self.min_unique_receivers:
                continue

            out_edges.sort(key=lambda x: x[0])
            n = len(out_edges)
            start_idx = 0
            best_window_receivers = set()
            best_window_txns = []
            best_window_vol = 0.0
            best_start_ts = None
            best_end_ts = None

            for end_idx in range(n):
                cur_end_ts = out_edges[end_idx][0]
                while cur_end_ts - out_edges[start_idx][0] > window_delta and start_idx < end_idx:
                    start_idx += 1

                window_slice = out_edges[start_idx : end_idx + 1]
                receivers = {item[1] for item in window_slice}

                if len(receivers) >= self.min_unique_receivers:
                    vol = sum(item[2] for item in window_slice)
                    if vol >= self.min_burst_volume and len(receivers) > len(best_window_receivers):
                        best_window_receivers = receivers
                        best_window_txns = [item[3] for item in window_slice]
                        best_window_vol = vol
                        best_start_ts = window_slice[0][0]
                        best_end_ts = cur_end_ts

            if len(best_window_receivers) >= self.min_unique_receivers:
                severity = SEVERITY_HIGH if len(best_window_receivers) >= self.min_unique_receivers * 2 else SEVERITY_MEDIUM
                display = (
                    f"Fan-Out Split: Dispersed ₹{best_window_vol:,.2f} to {len(best_window_receivers)} "
                    f"distinct beneficiaries within {self.time_window_hours}h window."
                )
                hit = DetectorHit(
                    account_id=node,
                    code=DETECTOR_FAN_OUT,
                    window_start=best_start_ts,
                    window_end=best_end_ts,
                    severity=severity,
                    evidence={
                        "unique_receivers_count": len(best_window_receivers),
                        "total_volume": round(best_window_vol, 2),
                        "time_window_hours": self.time_window_hours,
                        "receivers": list(best_window_receivers)[:20],
                    },
                    display_text=display,
                    supporting_txns=best_window_txns,
                    counterparties=list(best_window_receivers),
                )
                hits.append(hit)

        return hits
