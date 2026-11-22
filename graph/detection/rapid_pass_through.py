"""
Rapid Pass-Through Detector (Module 6 Deliverable).
Identifies accounts receiving funds and rapidly transferring them onward with high volume retention.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import networkx as nx

from graph.shared.constants import DETECTOR_PASS_THROUGH, SEVERITY_CRITICAL, SEVERITY_HIGH, SEVERITY_MEDIUM
from graph.shared.schemas import DetectorHit

logger = logging.getLogger(__name__)


class RapidPassThroughDetector:
    """Detects transit mule accounts forwarding received funds in minutes with low balance retention."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        cfg = config or {}
        self.pass_through_ratio = cfg.get("pass_through_ratio", 0.80)
        self.time_window_minutes = cfg.get("time_window_minutes", 60)
        self.min_amount = cfg.get("min_amount", 500.0)

    def detect(self, G: nx.MultiDiGraph) -> List[DetectorHit]:
        hits: List[DetectorHit] = []
        delta_window = timedelta(minutes=self.time_window_minutes)

        for node in G.nodes:
            in_edges = []
            for u, v, key, data in G.in_edges(node, keys=True, data=True):
                amt = data.get("amount", 0.0)
                ts = data.get("timestamp")
                if amt >= self.min_amount and ts is not None:
                    in_edges.append((ts, amt, u, data.get("transaction_id", key)))

            if not in_edges:
                continue

            out_edges = []
            for u, v, key, data in G.out_edges(node, keys=True, data=True):
                amt = data.get("amount", 0.0)
                ts = data.get("timestamp")
                if amt >= self.min_amount and ts is not None:
                    out_edges.append((ts, amt, v, data.get("transaction_id", key)))

            if not out_edges:
                continue

            # Compare pairs of (inflow -> outflow) where ts_out >= ts_in within window
            for in_ts, in_amt, in_sender, in_txn in in_edges:
                # Find matching forward transfers
                forward_txns = []
                forward_amt = 0.0
                forward_receivers = []
                last_forward_ts = in_ts

                for out_ts, out_amt, out_rcv, out_txn in out_edges:
                    if in_ts <= out_ts <= in_ts + delta_window:
                        forward_txns.append(out_txn)
                        forward_amt += out_amt
                        forward_receivers.append(out_rcv)
                        if out_ts > last_forward_ts:
                            last_forward_ts = out_ts

                if forward_amt >= in_amt * self.pass_through_ratio and in_amt > 0:
                    delay_minutes = (last_forward_ts - in_ts).total_seconds() / 60.0
                    ratio = forward_amt / in_amt
                    severity = SEVERITY_CRITICAL if delay_minutes <= 15 else SEVERITY_HIGH

                    display = (
                        f"Rapid Pass-Through: ₹{in_amt:,.2f} received and {ratio*100:.1f}% (₹{forward_amt:,.2f}) "
                        f"forwarded within {delay_minutes:.1f} minutes."
                    )

                    all_supporting = [in_txn] + forward_txns
                    counterparties = [in_sender] + forward_receivers

                    hit = DetectorHit(
                        account_id=node,
                        code=DETECTOR_PASS_THROUGH,
                        window_start=in_ts,
                        window_end=last_forward_ts,
                        severity=severity,
                        evidence={
                            "inflow_amount": round(in_amt, 2),
                            "forwarded_amount": round(forward_amt, 2),
                            "pass_through_ratio": round(ratio, 4),
                            "delay_minutes": round(delay_minutes, 2),
                            "inflow_sender": in_sender,
                            "receivers": forward_receivers,
                        },
                        display_text=display,
                        supporting_txns=all_supporting,
                        counterparties=counterparties,
                    )
                    hits.append(hit)
                    break # One hit per account is sufficient to avoid flooding

        return hits
