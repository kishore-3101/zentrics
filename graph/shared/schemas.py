"""
TraceMesh Graph Shared Schemas.
Pydantic and dataclass models for node, edge, detector hit, ring, and graph contracts.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple


@dataclass
class AccountNode:
    """Represents an account node in the transaction graph."""
    account_id: str
    customer_id: Optional[str] = None
    age: Optional[int] = None
    account_type: str = "savings"
    account_open_date: Optional[str] = None
    account_age_days: Optional[int] = None
    kyc_status: str = "minimal"
    occupation: Optional[str] = None
    city: Optional[str] = None
    branch_id: Optional[str] = None
    initial_balance: float = 0.0
    is_sink: bool = False
    is_frozen: bool = False
    role: str = "mule"
    risk_score: float = 0.0
    ml_prob: float = 0.0
    rule_score: float = 0.0
    neighbor_risk: float = 0.0
    total_incoming: float = 0.0
    total_outgoing: float = 0.0
    transaction_count: int = 0
    in_degree: int = 0
    out_degree: int = 0
    reason_codes: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class TransactionEdge:
    """Represents a transaction edge in the multigraph."""
    transaction_id: str
    src_account: str
    dst_account: str
    amount: float
    timestamp: datetime
    transaction_type: str = "P2P"
    transaction_status: str = "SUCCESS"
    channel: str = "UPI"
    device_id: Optional[str] = None
    ip_address: Optional[str] = None
    location: Optional[str] = None
    is_suspicious: bool = False
    pattern_tags: List[str] = field(default_factory=list)


@dataclass
class DetectorHit:
    """
    Standardized hit format matching Module 6 & 15 contracts:
    account, code, window start, window end, severity, structured evidence, and display string.
    """
    account_id: str
    code: str
    window_start: Optional[datetime] = None
    window_end: Optional[datetime] = None
    severity: str = "medium"
    evidence: Dict[str, Any] = field(default_factory=dict)
    display_text: str = ""
    supporting_txns: List[str] = field(default_factory=list)
    counterparties: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "account_id": self.account_id,
            "code": self.code,
            "window_start": self.window_start.isoformat() if self.window_start else None,
            "window_end": self.window_end.isoformat() if self.window_end else None,
            "severity": self.severity,
            "evidence": self.evidence,
            "display_text": self.display_text,
            "supporting_txns": self.supporting_txns,
            "counterparties": self.counterparties,
        }


@dataclass
class RingCandidate:
    """Detected suspicious financial crime ring entity."""
    ring_id: str
    fingerprint: str
    ring_type: str
    score: float
    priority: float
    amount_moved: float
    amount_cashed: float
    amount_at_risk: float
    duration_min: float
    status: str = "new"
    detected_at: Optional[str] = None
    pattern_tags: List[str] = field(default_factory=list)
    explanation: str = ""
    member_roles: Dict[str, str] = field(default_factory=dict)
    members: List[str] = field(default_factory=list)
    transaction_ids: List[str] = field(default_factory=list)
    nodes: List[Dict[str, Any]] = field(default_factory=list)
    edges: List[Dict[str, Any]] = field(default_factory=list)
    metrics: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ring_id": self.ring_id,
            "fingerprint": self.fingerprint,
            "ring_type": self.ring_type,
            "score": round(self.score, 1),
            "priority": round(self.priority, 1),
            "amount_moved": round(self.amount_moved, 2),
            "amount_cashed": round(self.amount_cashed, 2),
            "amount_at_risk": round(self.amount_at_risk, 2),
            "duration_min": round(self.duration_min, 1),
            "status": self.status,
            "detected_at": self.detected_at,
            "pattern_tags": self.pattern_tags,
            "explanation": self.explanation,
            "member_roles": self.member_roles,
            "members": self.members,
            "transaction_ids": self.transaction_ids,
            "nodes": self.nodes,
            "edges": self.edges,
            "metrics": self.metrics,
        }
