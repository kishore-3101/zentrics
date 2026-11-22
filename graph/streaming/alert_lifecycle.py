"""
Alert Lifecycle State Machine (Module 12b Deliverable).
Manages compliant transitions and audit trails for fraud ring alerts.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class AlertLifecycle:
    """Manages audit-logged state transitions for detected financial crime rings."""

    TRANSITIONS = {
        "new": ["investigating", "dismissed"],
        "investigating": ["escalated", "frozen", "dismissed"],
        "escalated": ["frozen", "sar_filed", "dismissed"],
        "frozen": ["sar_filed", "resolved"],
        "sar_filed": ["resolved"],
        "dismissed": [],
        "resolved": [],
    }

    def __init__(self):
        self.history: List[Dict[str, Any]] = []

    def transition(
        self,
        ring_id: str,
        current_state: str,
        target_state: str,
        analyst_id: str = "analyst_01",
        reason: str = ""
    ) -> bool:
        allowed = self.TRANSITIONS.get(current_state, [])
        if target_state not in allowed:
            logger.warning("Illegal state transition: %s -> %s for ring %s", current_state, target_state, ring_id)
            return False

        record = {
            "ring_id": ring_id,
            "previous_state": current_state,
            "new_state": target_state,
            "analyst_id": analyst_id,
            "reason": reason,
            "timestamp": datetime.utcnow().isoformat(),
        }
        self.history.append(record)
        return True
