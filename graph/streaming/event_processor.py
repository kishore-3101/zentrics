"""
Event Processor and Alert Lifecycle (Module 12a Deliverable).
Orchestrates targeted 1-hop re-evaluation when new streaming transactions arrive,
maintains alert lifecycle state machines (new -> investigating -> escalated -> resolved),
and publishes delta alert events.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Set
import networkx as nx

from graph.detection.detector_engine import DetectorEngine
from graph.ring_analysis.ring_extraction import RingExtractor
from graph.shared.schemas import DetectorHit, RingCandidate
from graph.streaming.incremental_builder import IncrementalBuilder
from graph.streaming.sliding_window import SlidingWindowManager

logger = logging.getLogger(__name__)


class EventProcessor:
    """Streams transactions, performs targeted re-evaluations, and manages alert lifecycles."""

    def __init__(
        self,
        G: Optional[nx.MultiDiGraph] = None,
        alert_threshold: float = 65.0
    ):
        self.G = G if G is not None else nx.MultiDiGraph()
        self.builder = IncrementalBuilder(self.G)
        self.window_mgr = SlidingWindowManager(self.G)
        self.detector_engine = DetectorEngine()
        self.ring_extractor = RingExtractor()
        self.alert_threshold = alert_threshold

        # Active ring state store: ring_id -> RingCandidate
        self.active_rings: Dict[str, RingCandidate] = {}
        # Alert lifecycle states: ring_id -> 'new' | 'investigating' | 'escalated' | 'resolved'
        self.alert_states: Dict[str, str] = {}
        # Event log for delta polling
        self.event_log: List[Dict[str, Any]] = []
        self.next_event_id = 1000

    def process_event(self, event_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Processes an incoming streaming transaction event:
        1. Ingests edge incrementally.
        2. Advances temporal window.
        3. Re-evaluates only touched 1-hop neighborhood.
        4. Emits delta alerts if risk crossed threshold.
        """
        txn_id = str(event_data.get("transaction_id", ""))
        src = str(event_data.get("src_account", ""))
        dst = str(event_data.get("dst_account", ""))
        amt = float(event_data.get("amount", 0.0))
        ts = event_data.get("timestamp")

        is_new, affected = self.builder.ingest_transaction(
            transaction_id=txn_id,
            src_account=src,
            dst_account=dst,
            amount=amt,
            timestamp=ts,
            **event_data
        )

        if not is_new:
            # Duplicate transaction, no re-evaluation needed
            return []

        # Advance window and prune TTL
        self.window_mgr.advance_time(ts)

        # Targeted Re-Evaluation on 1-hop subgraph around affected accounts
        sub_G = self.G.subgraph(affected).copy()
        hits = self.detector_engine.run_all(sub_G)

        new_events = []
        if hits:
            # Check if any affected node exceeds alert threshold
            rule_scores = self.detector_engine.compute_account_rule_scores(hits)
            high_risk_accts = {acct for acct, sc in rule_scores.items() if sc * 100.0 >= self.alert_threshold}

            if high_risk_accts:
                account_risks = {acct: round(sc * 100.0, 1) for acct, sc in rule_scores.items()}
                extracted = self.ring_extractor.extract_rings(
                    G=self.G,
                    suspicious_accounts=high_risk_accts,
                    hits=hits,
                    account_risks=account_risks,
                    run_prefix=f"STR-{self.next_event_id}"
                )

                for ring in extracted:
                    existing = self.active_rings.get(ring.ring_id)
                    if existing is None:
                        # Brand new ring alert
                        self.active_rings[ring.ring_id] = ring
                        self.alert_states[ring.ring_id] = "new"
                        evt = {
                            "event_id": self.next_event_id,
                            "event_type": "new_ring",
                            "ring_id": ring.ring_id,
                            "ring_type": ring.ring_type,
                            "score": ring.score,
                            "amount_at_risk": ring.amount_at_risk,
                            "timestamp": datetime.utcnow().isoformat(),
                            "detail": ring.explanation,
                        }
                    else:
                        # Updated existing ring
                        self.active_rings[ring.ring_id] = ring
                        evt = {
                            "event_id": self.next_event_id,
                            "event_type": "ring_updated",
                            "ring_id": ring.ring_id,
                            "ring_type": ring.ring_type,
                            "score": ring.score,
                            "amount_at_risk": ring.amount_at_risk,
                            "timestamp": datetime.utcnow().isoformat(),
                            "detail": f"Updated volume: ₹{ring.amount_moved:,.2f}",
                        }
                    self.next_event_id += 1
                    self.event_log.append(evt)
                    new_events.append(evt)

        return new_events

    def update_alert_state(self, ring_id: str, new_state: str) -> bool:
        """Transitions alert lifecycle: 'new' -> 'investigating' -> 'escalated' -> 'resolved'."""
        valid_states = {"new", "investigating", "escalated", "resolved"}
        if new_state not in valid_states:
            return False
        if ring_id in self.alert_states:
            self.alert_states[ring_id] = new_state
            if ring_id in self.active_rings:
                self.active_rings[ring_id].status = new_state
            return True
        return False
