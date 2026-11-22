"""
Dormant Activation Detector (Module 6 Deliverable).
Identifies dormant accounts that suddenly become active with a sharp burst of incoming/outgoing volume.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import networkx as nx

from graph.shared.constants import DETECTOR_DORMANT, SEVERITY_HIGH, SEVERITY_MEDIUM
from graph.shared.schemas import DetectorHit
from graph.shared.utilities import parse_timestamp

logger = logging.getLogger(__name__)


class DormantActivationDetector:
    """Detects reactivation of dormant accounts with abnormal transaction velocity."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        cfg = config or {}
        self.inactivity_days = cfg.get("inactivity_days", 60)
        self.volume_multiplier = cfg.get("volume_multiplier", 3.0)
        self.min_reactivation_amount = cfg.get("min_reactivation_amount", 1000.0)

    def detect(self, G: nx.MultiDiGraph) -> List[DetectorHit]:
        hits: List[DetectorHit] = []
        inactivity_delta = timedelta(days=self.inactivity_days)

        for node in G.nodes:
            # Collect all transactions for node
            txns = []
            for _, _, _, data in G.in_edges(node, keys=True, data=True):
                ts = data.get("timestamp")
                amt = data.get("amount", 0.0)
                if ts:
                    txns.append((ts, amt, data.get("transaction_id", ""), data.get("src_account", ""), "in"))
            for _, _, _, data in G.out_edges(node, keys=True, data=True):
                ts = data.get("timestamp")
                amt = data.get("amount", 0.0)
                if ts:
                    txns.append((ts, amt, data.get("transaction_id", ""), data.get("dst_account", ""), "out"))

            if not txns:
                continue

            txns.sort(key=lambda x: x[0])

            # Check account opening date if available
            node_data = G.nodes[node]
            open_date_str = node_data.get("account_open_date")
            open_dt = parse_timestamp(open_date_str) if open_date_str else None

            # Case A: Long gap between opening and first transaction
            if open_dt and txns:
                first_ts, first_amt, first_txn, first_counter, _ = txns[0]
                if (first_ts - open_dt) >= inactivity_delta and first_amt >= self.min_reactivation_amount:
                    gap_days = (first_ts - open_dt).days
                    display = (
                        f"Dormant Activation: Account opened {gap_days} days ago with zero activity, "
                        f"suddenly reactivated with ₹{first_amt:,.2f} transfer."
                    )
                    hit = DetectorHit(
                        account_id=node,
                        code=DETECTOR_DORMANT,
                        window_start=first_ts,
                        window_end=first_ts + timedelta(hours=24),
                        severity=SEVERITY_HIGH,
                        evidence={
                            "dormancy_gap_days": gap_days,
                            "reactivation_amount": round(first_amt, 2),
                            "historical_average_daily_volume": 0.0,
                        },
                        display_text=display,
                        supporting_txns=[first_txn],
                        counterparties=[first_counter],
                    )
                    hits.append(hit)
                    continue

            # Case B: Inactivity gap between consecutive transactions
            for i in range(len(txns) - 1):
                prev_ts = txns[i][0]
                curr_ts, curr_amt, curr_txn, curr_counter, _ = txns[i+1]

                if (curr_ts - prev_ts) >= inactivity_delta and curr_amt >= self.min_reactivation_amount:
                    gap_days = (curr_ts - prev_ts).days
                    display = (
                        f"Dormant Activation: Reactivated after {gap_days} days of total dormancy "
                        f"with sudden transfer of ₹{curr_amt:,.2f}."
                    )
                    hit = DetectorHit(
                        account_id=node,
                        code=DETECTOR_DORMANT,
                        window_start=curr_ts,
                        window_end=curr_ts + timedelta(hours=24),
                        severity=SEVERITY_MEDIUM,
                        evidence={
                            "dormancy_gap_days": gap_days,
                            "reactivation_amount": round(curr_amt, 2),
                        },
                        display_text=display,
                        supporting_txns=[curr_txn],
                        counterparties=[curr_counter],
                    )
                    hits.append(hit)
                    break

        return hits
