"""
Ring Evaluation Harness.
Evaluates discovered rings against ground-truth fraud rings (Module 7 & 10 Deliverables).
Conforms to project definitions:
- Ring recall: A ground-truth ring is detected if one predicted ring contains >= 70% of its mule members.
- Ring precision: Share of predicted rings in which >= 70% of members are true mule accounts.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Set, Tuple
import pandas as pd

from graph.shared.schemas import RingCandidate

logger = logging.getLogger(__name__)


def evaluate_ring_performance(
    detected_rings: List[RingCandidate],
    gt_fraud_rings_df: pd.DataFrame,
    gt_accounts_df: Optional[pd.DataFrame] = None,
    overlap_threshold: float = 0.70
) -> Dict[str, Any]:
    """
    Evaluates detected ring precision and recall against true planted rings.
    """
    if gt_fraud_rings_df is None or gt_fraud_rings_df.empty:
        return {"error": "Ground-truth fraud rings dataframe is empty"}

    # Group ground truth rings by ring_id
    gt_rings: Dict[str, Set[str]] = {}
    for ring_id, grp in gt_fraud_rings_df.groupby("ring_id"):
        # Mules only (or all labeled accounts if is_mule column present)
        if "is_mule" in grp.columns:
            mules = set(grp[grp["is_mule"] == 1]["account_id"].astype(str).str.strip())
        else:
            mules = set(grp["account_id"].astype(str).str.strip())
        if mules:
            gt_rings[str(ring_id)] = mules

    total_gt_rings = len(gt_rings)
    total_detected_rings = len(detected_rings)

    if total_gt_rings == 0 or total_detected_rings == 0:
        return {
            "total_gt_rings": total_gt_rings,
            "total_detected_rings": total_detected_rings,
            "detected_gt_rings": 0,
            "ring_recall": 0.0,
            "ring_precision": 0.0,
            "f1_score": 0.0,
        }

    # True mule account lookup
    true_mules: Set[str] = set()
    if gt_accounts_df is not None and not gt_accounts_df.empty and "is_mule" in gt_accounts_df.columns:
        true_mules = set(gt_accounts_df[gt_accounts_df["is_mule"] == 1]["account_id"].astype(str).str.strip())
    else:
        for m_set in gt_rings.values():
            true_mules.update(m_set)

    # 1. Ring Recall: GT ring detected if any predicted ring has >= 70% overlap of GT ring members
    matched_gt_rings = set()
    for gt_id, gt_members in gt_rings.items():
        gt_size = len(gt_members)
        for pred_ring in detected_rings:
            pred_members = set(pred_ring.members)
            overlap = len(gt_members.intersection(pred_members))
            if overlap / gt_size >= overlap_threshold:
                matched_gt_rings.add(gt_id)
                break

    ring_recall = len(matched_gt_rings) / total_gt_rings if total_gt_rings > 0 else 0.0

    # 2. Ring Precision: Predicted ring is pure if >= 70% of its members are true mules
    pure_detected_rings = 0
    for pred_ring in detected_rings:
        pred_members = set(pred_ring.members)
        if not pred_members:
            continue
        mule_count = len(pred_members.intersection(true_mules))
        if mule_count / len(pred_members) >= overlap_threshold:
            pure_detected_rings += 1

    ring_precision = pure_detected_rings / total_detected_rings if total_detected_rings > 0 else 0.0
    f1 = 2 * ring_precision * ring_recall / (ring_precision + ring_recall) if (ring_precision + ring_recall) > 0 else 0.0

    return {
        "total_gt_rings": total_gt_rings,
        "total_detected_rings": total_detected_rings,
        "matched_gt_rings_count": len(matched_gt_rings),
        "pure_detected_rings_count": pure_detected_rings,
        "ring_recall": round(ring_recall, 4),
        "ring_precision": round(ring_precision, 4),
        "f1_score": round(f1, 4),
    }
