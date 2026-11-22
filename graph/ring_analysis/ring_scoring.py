"""
Ring Risk Scorer and Prioritization Engine (Module 7 Deliverable).
Calculates composite ring risk score (0-100) and priority index (Score * Amount at Risk).
"""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional, Set

from graph.shared.constants import ROLE_COLLECTOR, ROLE_MULE

logger = logging.getLogger(__name__)


def compute_ring_score(
    member_roles: Dict[str, str],
    account_risks: Dict[str, float],
    financial_metrics: Dict[str, Any],
    detector_codes: Set[str]
) -> Tuple[float, float]:
    """
    Computes:
    - Ring Risk Score (0 - 100): Weighted combination of mean mule risk, max mule risk,
      pattern diversity, speed/velocity, and financial exposure.
    - Priority Index: ring_score * amount_at_risk (for AML operations queue sorting).
    """
    # Filter risks of actionable perpetrators (mules and collectors)
    mule_scores = [
        account_risks.get(a, 50.0)
        for a, r in member_roles.items()
        if r in (ROLE_MULE, ROLE_COLLECTOR)
    ]

    mean_risk = sum(mule_scores) / max(len(mule_scores), 1) if mule_scores else 50.0
    max_risk = max(mule_scores) if mule_scores else 50.0

    # Pattern diversity factor (multiple detectors triggered across members)
    diversity_count = len(detector_codes)
    diversity_score = min(100.0, diversity_count * 25.0)

    # Financial exposure factor (saturating log scale up to 10M INR)
    amt_at_risk = financial_metrics.get("amount_at_risk", 0.0)
    amt_score = min(100.0, (math.log10(max(amt_at_risk, 1000.0)) - 3.0) / 4.0 * 100.0) if amt_at_risk > 0 else 20.0

    # Velocity factor
    duration_min = financial_metrics.get("duration_min", 60.0)
    speed_score = min(100.0, max(20.0, 100.0 - (duration_min / 60.0) * 10.0))

    # Composite weighted formula
    composite_score = (
        0.35 * mean_risk +
        0.20 * max_risk +
        0.20 * amt_score +
        0.15 * diversity_score +
        0.10 * speed_score
    )

    ring_score = round(max(0.0, min(100.0, composite_score)), 1)
    priority = round(ring_score * max(amt_at_risk, 1.0), 1)

    return ring_score, priority
