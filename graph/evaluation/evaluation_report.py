"""
Reproducible Graph Evaluation Report Generator.
Generates comprehensive evaluation summaries for detector accuracy, ring precision/recall,
and computational efficiency.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List
import pandas as pd

from graph.evaluation.detector_evaluation import evaluate_detector_performance
from graph.evaluation.ring_evaluation import evaluate_ring_performance
from graph.shared.schemas import DetectorHit, RingCandidate


def generate_evaluation_report(
    hits: List[DetectorHit],
    rings: List[RingCandidate],
    accounts_df: pd.DataFrame,
    fraud_rings_df: pd.DataFrame,
    timings: Dict[str, float]
) -> Dict[str, Any]:
    """Generates complete forensic graph evaluation report."""
    detector_eval = evaluate_detector_performance(hits, accounts_df)
    ring_eval = evaluate_ring_performance(rings, fraud_rings_df, accounts_df)

    report = {
        "timestamp": datetime.utcnow().isoformat(),
        "summary": {
            "total_nodes_evaluated": len(accounts_df),
            "total_detector_hits": len(hits),
            "total_rings_discovered": len(rings),
        },
        "detectors": detector_eval,
        "rings": ring_eval,
        "timings_ms": timings,
    }
    return report
