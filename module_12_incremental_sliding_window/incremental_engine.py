"""Incremental detector engine for real-time transaction streams.

Performs localized 1-to-2 hop graph re-evaluation upon transaction ingestion
and edge expiration, maintaining incremental detector hits, account risk scores,
active candidate rings, and alert lifecycle transitions.
"""

from __future__ import annotations

import time
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple
import networkx as nx

from module_6_graph_builder_detectors import run_detectors, rule_scores
from module_7_community_ring_clustering import cluster_rings
from module_12_incremental_sliding_window.sliding_window import SlidingWindowGraphManager
from shared.config import load_config
from shared.models import AlertEvent, Hit, RingCandidate
from shared.utils import parse_timestamp


class IncrementalDetectorEngine:
    """Stateful streaming engine for low-latency incremental fraud detection."""

    def __init__(
        self,
        window_minutes: int = 60,
        accounts_df: Optional[Any] = None,
        sink_accounts: Optional[Iterable[str]] = None,
        config: Optional[Dict[str, Any]] = None,
    ):
        self.cfg = load_config(config)
        self.window_mgr = SlidingWindowGraphManager(
            window_minutes=window_minutes,
            accounts_df=accounts_df,
            sink_accounts=sink_accounts,
            config=self.cfg,
        )

        streaming_cfg = self.cfg.get("streaming", {})
        self.neighborhood_hops: int = int(streaming_cfg.get("re_evaluate_hops", 2))
        self.alert_thresh: float = float(streaming_cfg.get("alert_threshold", 50.0))

        # Cached states
        self.account_scores: Dict[str, float] = {}
        self.account_hits: Dict[str, List[Hit]] = {}

        # Ring Lifecycle states
        self.active_rings: Dict[str, RingCandidate] = {}
        self.deactivated_rings: Set[str] = set()
        self.reported_ring_alerts: Dict[str, float] = {}

        self.event_counter: int = 0

    def process_transaction(self, txn: Dict[str, Any]) -> AlertEvent:
        """Process a single incoming transaction event incrementally."""
        start_time = time.perf_counter()
        self.event_counter += 1
        txn_id = str(txn.get("transaction_id", ""))
        ts = parse_timestamp(txn["timestamp"])

        is_added, touched_accounts = self.window_mgr.add_transaction(txn)
        expired_accounts = self.window_mgr.last_expired_accounts
        reason = self.window_mgr.last_reason

        # If rejected and no transactions expired
        if not is_added and not expired_accounts:
            proc_ms = (time.perf_counter() - start_time) * 1000.0
            return AlertEvent(
                event_id=f"EVT_{self.event_counter:06d}",
                transaction_id=txn_id,
                timestamp=ts,
                affected_accounts=sorted(list(touched_accounts)),
                triggered_detector_codes=[],
                updated_account_scores={},
                current_status="ignored_or_duplicate" if reason == "duplicate_transaction" else reason,
                processing_time_ms=proc_ms,
            )

        return self._reconcile_state(
            touched_accounts=touched_accounts,
            expired_accounts=expired_accounts,
            ts=ts,
            txn_id=txn_id,
            reason=reason,
            start_time=start_time,
        )

    def advance_time(self, current_ts: datetime | str) -> AlertEvent:
        """Advance watermark without new transaction to expire old edges and reconcile state."""
        start_time = time.perf_counter()
        self.event_counter += 1
        ts = parse_timestamp(current_ts)
        self.window_mgr.watermark = ts
        _, expired_accounts = self.window_mgr.expire_transactions(ts)
        self.window_mgr.last_expired_accounts = expired_accounts
        self.window_mgr.last_reason = "time_advanced"

        return self._reconcile_state(
            touched_accounts=set(),
            expired_accounts=expired_accounts,
            ts=ts,
            txn_id="TIME_ADVANCE",
            reason="advance_time",
            start_time=start_time,
        )

    def _reconcile_state(
        self,
        touched_accounts: Set[str],
        expired_accounts: Set[str],
        ts: datetime,
        txn_id: str = "",
        reason: str = "",
        start_time: float = 0.0,
    ) -> AlertEvent:
        """Shared reconciliation engine for transaction ingestion and time advancement.

        Guarantees that active rings, alert lifecycles, detector hits, and account risk scores
        are strictly reconciled upon edge addition or expiration, even when the resulting
        neighborhood has zero active edges.
        """
        affected_accounts = touched_accounts | expired_accounts

        # 1. Zero out scores and hits for accounts that no longer have active incident edges
        for acc in expired_accounts:
            if acc in self.window_mgr.graph:
                if self.window_mgr.graph.in_degree(acc) == 0 and self.window_mgr.graph.out_degree(acc) == 0:
                    self.account_scores[acc] = 0.0
                    self.account_hits[acc] = []

        # 2. Expand to k-hop neighborhood around all affected accounts
        eval_neighborhood = self.window_mgr.get_neighborhood(affected_accounts, hops=self.neighborhood_hops)

        # 3. Extract localized neighborhood subgraph
        if eval_neighborhood:
            local_subgraph = self.window_mgr.get_neighborhood_subgraph(affected_accounts, hops=self.neighborhood_hops)
        else:
            local_subgraph = nx.MultiDiGraph()

        has_active_edges = local_subgraph.number_of_edges() > 0

        # 4. Run detectors and recompute scores
        triggered_codes: Set[str] = set()
        eval_hits: List[Hit] = []

        if not has_active_edges:
            # Empty evaluation neighborhood or no edges left in subgraph
            for acc in (eval_neighborhood | affected_accounts):
                self.account_scores[acc] = 0.0
                self.account_hits[acc] = []
            candidate_rings: List[RingCandidate] = []
        else:
            local_hits = run_detectors(local_subgraph, config=self.cfg)
            for acc in eval_neighborhood:
                acc_hits = [h for h in local_hits if h.account_id == acc]
                self.account_hits[acc] = acc_hits
                for h in acc_hits:
                    triggered_codes.add(h.code)

            eval_hits = [h for acc in eval_neighborhood for h in self.account_hits.get(acc, [])]
            updated_scores = rule_scores(eval_hits, config=self.cfg)
            for acc in eval_neighborhood:
                self.account_scores[acc] = updated_scores.get(acc, 0.0)

            # Ensure any expired accounts outside eval_neighborhood are reset
            for acc in expired_accounts:
                if acc not in eval_neighborhood:
                    self.account_scores[acc] = 0.0
                    self.account_hits[acc] = []

            # 5. Cluster candidate rings on active localized subgraph
            candidate_rings = cluster_rings(
                local_subgraph,
                self.account_scores,
                eval_hits,
                config=self.cfg,
                sink_accounts=self.window_mgr.sink_set,
            )

        # 6. Reconcile Active Rings and Alert Lifecycle
        event_status = "monitored"
        primary_ring: Optional[RingCandidate] = None
        prev_status: Optional[str] = None

        candidate_fps = set()
        for ring in candidate_rings:
            fp = ring.fingerprint
            candidate_fps.add(fp)
            score = ring.score

            if fp in self.active_rings:
                prev_status = "active"
                if score >= self.alert_thresh:
                    last_score = self.reported_ring_alerts.get(fp, 0.0)
                    if abs(score - last_score) >= 5.0 or (last_score < self.alert_thresh <= score):
                        event_status = "alert_updated" if last_score >= self.alert_thresh else "alert_triggered"
                        self.reported_ring_alerts[fp] = score
                        primary_ring = ring
                self.active_rings[fp] = ring
            elif fp in self.deactivated_rings:
                prev_status = "deactivated"
                if score >= self.alert_thresh:
                    event_status = "alert_reactivated"
                    self.reported_ring_alerts[fp] = score
                    self.active_rings[fp] = ring
                    self.deactivated_rings.remove(fp)
                    primary_ring = ring
            else:
                prev_status = None
                if score >= self.alert_thresh:
                    event_status = "new_alert"
                    self.reported_ring_alerts[fp] = score
                    self.active_rings[fp] = ring
                    primary_ring = ring

        # 7. Check for ring deactivations due to edge expiration or score reduction
        for fp in list(self.active_rings.keys()):
            prev_ring = self.active_rings[fp]
            # If any member of this ring was affected by edge addition or expiration
            if any(m in (affected_accounts | expired_accounts) for m in prev_ring.member_account_ids):
                matching_curr = next((r for r in candidate_rings if r.fingerprint == fp), None)
                if matching_curr is None or matching_curr.score < self.alert_thresh:
                    del self.active_rings[fp]
                    self.deactivated_rings.add(fp)
                    if not primary_ring or event_status in ["monitored", "alert_triggered"]:
                        event_status = "alert_deactivated"
                        prev_status = "active"
                        primary_ring = prev_ring

        if not primary_ring and candidate_rings:
            primary_ring = candidate_rings[0]

        all_reporting_accs = eval_neighborhood | affected_accounts | expired_accounts
        scores_dict = {acc: self.account_scores.get(acc, 0.0) for acc in sorted(all_reporting_accs)}

        proc_ms = (time.perf_counter() - start_time) * 1000.0 if start_time > 0 else 0.0

        return AlertEvent(
            event_id=f"EVT_{self.event_counter:06d}",
            transaction_id=txn_id,
            timestamp=ts,
            affected_accounts=sorted(list(all_reporting_accs)),
            triggered_detector_codes=sorted(list(triggered_codes)),
            updated_account_scores=scores_dict,
            ring_id=primary_ring.ring_id if primary_ring else None,
            fingerprint=primary_ring.fingerprint if primary_ring else None,
            previous_status=prev_status,
            current_status=event_status,
            alert_score=primary_ring.score if primary_ring else 0.0,
            priority=primary_ring.priority if primary_ring else 0.0,
            amount_at_risk=primary_ring.amount_at_risk if primary_ring else 0.0,
            evidence={
                "local_nodes": local_subgraph.number_of_nodes() if has_active_edges else 0,
                "local_edges": local_subgraph.number_of_edges() if has_active_edges else 0,
                "hits_count": len(eval_hits),
                "rings_found": len(candidate_rings),
                "expired_accounts": sorted(list(expired_accounts)),
                "reason": reason,
            },
            processing_time_ms=proc_ms,
        )
