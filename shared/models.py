"""Data models and contracts for TraceMesh."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
import hashlib


@dataclass
class Hit:
    """Standardized detection hit contract.
    
    Compatible with Supabase `detector_hits` table and Module 15 explanation engine.
    """
    account_id: str
    code: str  # fan_in_burst, fan_out_split, rapid_pass_through, layering_chain, circular_flow, dormant_active
    window_start: datetime
    window_end: datetime
    severity: str  # 'low', 'medium', 'high', 'critical'
    evidence: Dict[str, Any] = field(default_factory=dict)
    detail: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "account_id": self.account_id,
            "code": self.code,
            "window_start": self.window_start.isoformat() if isinstance(self.window_start, datetime) else str(self.window_start),
            "window_end": self.window_end.isoformat() if isinstance(self.window_end, datetime) else str(self.window_end),
            "severity": self.severity,
            "evidence_json": self.evidence,
            "detail": self.detail or self.display_text,
        }

    @property
    def display_text(self) -> str:
        if self.detail:
            return self.detail
        return f"[{self.severity.upper()}] {self.code} on {self.account_id}"


@dataclass
class RingCandidate:
    """Candidate mule ring network.
    
    Compatible with Supabase `rings`, `ring_members`, and `ring_transactions` tables.
    """
    ring_id: str
    member_account_ids: List[str]
    community_id: int
    roles: Dict[str, str]  # account_id -> 'victim', 'collector', 'mule', 'cash_out'
    score: float  # [0, 100]
    priority: float  # score * amount_at_risk
    amount_moved: float
    amount_cashed: float
    amount_at_risk: float
    first_inflow_ts: Optional[datetime] = None
    last_outflow_ts: Optional[datetime] = None
    ring_transactions: List[Dict[str, Any]] = field(default_factory=list)
    pattern_tags: List[str] = field(default_factory=list)
    ring_type: str = "mixed"  # 'fan_in_fan_out', 'layering_chain', 'circular_flow', 'pass_through_hub', 'dormant_active', 'mixed'
    detector_evidence: List[Dict[str, Any]] = field(default_factory=list)
    recommended_action: str = "monitor"  # 'freeze_and_escalate', 'watchlist_review', 'monitor'
    fingerprint: str = ""

    def __post_init__(self):
        if not self.fingerprint and self.member_account_ids:
            sorted_members = sorted(set(self.member_account_ids))
            self.fingerprint = hashlib.sha1(",".join(sorted_members).encode("utf-8")).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ring_id": self.ring_id,
            "fingerprint": self.fingerprint,
            "member_account_ids": sorted(list(self.member_account_ids)),
            "community_id": self.community_id,
            "roles": self.roles,
            "score": round(self.score, 2),
            "priority": round(self.priority, 2),
            "amount_moved": round(self.amount_moved, 2),
            "amount_cashed": round(self.amount_cashed, 2),
            "amount_at_risk": round(self.amount_at_risk, 2),
            "first_inflow_ts": self.first_inflow_ts.isoformat() if isinstance(self.first_inflow_ts, datetime) else str(self.first_inflow_ts or ""),
            "last_outflow_ts": self.last_outflow_ts.isoformat() if isinstance(self.last_outflow_ts, datetime) else str(self.last_outflow_ts or ""),
            "ring_transactions": self.ring_transactions,
            "pattern_tags": self.pattern_tags,
            "ring_type": self.ring_type,
            "detector_evidence": self.detector_evidence,
            "recommended_action": self.recommended_action,
        }


@dataclass
class AlertEvent:
    """Incremental streaming alert event.
    
    Compatible with Supabase `alert_events` table.
    """
    event_id: str
    transaction_id: str
    timestamp: datetime
    affected_accounts: List[str]
    triggered_detector_codes: List[str]
    updated_account_scores: Dict[str, float]
    ring_id: Optional[str] = None
    fingerprint: Optional[str] = None
    previous_status: Optional[str] = None
    current_status: str = "monitored"  # 'new', 'updated', 'alert_triggered', 'monitored'
    alert_score: float = 0.0
    priority: float = 0.0
    amount_at_risk: float = 0.0
    evidence: Dict[str, Any] = field(default_factory=dict)
    processing_time_ms: float = 0.0

    def __iter__(self):
        """Allow iteration over affected_accounts for backward compatibility."""
        return iter(self.affected_accounts)

    def __len__(self):
        return len(self.affected_accounts)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "transaction_id": self.transaction_id,
            "timestamp": self.timestamp.isoformat() if isinstance(self.timestamp, datetime) else str(self.timestamp),
            "affected_accounts": self.affected_accounts,
            "triggered_detector_codes": self.triggered_detector_codes,
            "updated_account_scores": {k: round(v, 4) for k, v in self.updated_account_scores.items()},
            "ring_id": self.ring_id,
            "fingerprint": self.fingerprint,
            "previous_status": self.previous_status,
            "current_status": self.current_status,
            "alert_score": round(self.alert_score, 2),
            "priority": round(self.priority, 2),
            "amount_at_risk": round(self.amount_at_risk, 2),
            "evidence": self.evidence,
            "processing_time_ms": round(self.processing_time_ms, 3),
        }
