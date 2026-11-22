"""
Detector Evaluation Harness.
Evaluates individual detector performance against ground-truth tables (Module 6 & 10 Deliverables).
Computes precision, recall, F1, false positive rate without leaking ground-truth into detection.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Set, Tuple
import pandas as pd

from graph.shared.schemas import DetectorHit

logger = logging.getLogger(__name__)


def evaluate_detector_performance(
    hits: List[DetectorHit],
    ground_truth_df: pd.DataFrame,
    detector_code: Optional[str] = None
) -> Dict[str, Any]:
    """
    Evaluates detector hits against ground-truth mules (is_mule == 1).
    Does NOT use ground-truth to filter or bias detection logic.
    """
    if ground_truth_df is None or ground_truth_df.empty:
        return {"error": "Ground truth dataframe is empty or unavailable"}

    # Extract true mules
    gt_accts = set(ground_truth_df["account_id"].astype(str).str.strip())
    true_mules = set(
        ground_truth_df[ground_truth_df["is_mule"] == 1]["account_id"].astype(str).str.strip()
    )
    non_mules = gt_accts - true_mules

    # Filter hits by code if specified
    relevant_hits = [h for h in hits if (detector_code is None or h.code == detector_code)]
    flagged_accounts = {h.account_id for h in relevant_hits}

    # Intersect with evaluated accounts
    eval_flagged = flagged_accounts.intersection(gt_accts)

    tp = len(eval_flagged.intersection(true_mules))
    fp = len(eval_flagged.intersection(non_mules))
    fn = len(true_mules - eval_flagged)
    tn = len(non_mules - eval_flagged)

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0

    return {
        "detector_code": detector_code or "all_detectors",
        "total_hits": len(relevant_hits),
        "flagged_accounts": len(eval_flagged),
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "true_negatives": tn,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "false_positive_rate": round(fpr, 4),
    }
