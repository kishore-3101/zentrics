"""Unit and edge-case tests for GroundTruthEvaluator (Phase 5)."""

import pandas as pd
import pytest

from evaluation.evaluator import GroundTruthEvaluator
from shared.models import Hit, RingCandidate


def test_ground_truth_evaluator_account_metrics():
    """Verify account-level Precision, Recall, F1, and FPR calculation."""
    accounts_df = pd.DataFrame([
        {"account_id": "ACC_1", "is_mule": 1},
        {"account_id": "ACC_2", "is_mule": 1},
        {"account_id": "ACC_3", "is_mule": 0},
        {"account_id": "ACC_4", "is_mule": 0},
    ])
    txns_df = pd.DataFrame([
        {"transaction_id": "T1", "sender_account": "ACC_1", "receiver_account": "ACC_2", "amount": 100.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"}
    ])

    evaluator = GroundTruthEvaluator(accounts_df, txns_df)

    # Predictions: ACC_1 and ACC_3 predicted positive (score >= 0.3)
    # TP: ACC_1, FP: ACC_3, FN: ACC_2, TN: ACC_4
    scores = {"ACC_1": 0.8, "ACC_2": 0.1, "ACC_3": 0.5, "ACC_4": 0.0}

    res = evaluator.evaluate_accounts(scores, threshold=0.30)
    assert res["true_positives"] == 1
    assert res["false_positives"] == 1
    assert res["false_negatives"] == 1
    assert res["true_negatives"] == 1
    assert res["precision"] == 0.5
    assert res["recall"] == 0.5
    assert res["f1_score"] == 0.5
    assert res["false_positive_rate"] == 0.5


def test_ground_truth_evaluator_ring_clustering_jaccard():
    """Verify candidate ring matching against ground-truth rings using Jaccard similarity."""
    accounts_df = pd.DataFrame([{"account_id": f"ACC_{i}", "is_mule": 1} for i in range(1, 6)])
    txns_df = pd.DataFrame([])
    fraud_rings_df = pd.DataFrame([
        {"ring_id": "GT_RING_1", "account_id": "ACC_1", "ring_role": "Controller"},
        {"ring_id": "GT_RING_1", "account_id": "ACC_2", "ring_role": "Collector"},
        {"ring_id": "GT_RING_1", "account_id": "ACC_3", "ring_role": "Pass-through"},
    ])

    evaluator = GroundTruthEvaluator(accounts_df, txns_df, fraud_rings_df)

    # Candidate ring matching GT_RING_1: members ACC_1, ACC_2, ACC_3 (Jaccard = 1.0)
    cand_ring = RingCandidate(
        ring_id="RING_0001",
        member_account_ids=["ACC_1", "ACC_2", "ACC_3"],
        community_id=1,
        roles={"ACC_1": "source", "ACC_2": "collector", "ACC_3": "mule"},
        score=85.0,
        priority=100000.0,
        amount_moved=5000.0,
        amount_cashed=1000.0,
        amount_at_risk=4000.0,
        first_inflow_ts=None,
        last_outflow_ts=None,
        ring_transactions=[],
        pattern_tags=["circular_flow"],
        ring_type="circular_flow",
        detector_evidence=[],
        recommended_action="freeze_and_escalate",
        fingerprint="fp123",
    )

    res = evaluator.evaluate_ring_clustering([cand_ring], min_jaccard=0.5)
    assert res["matched_candidate_rings"] == 1
    assert res["ring_precision"] == 1.0
    assert res["mean_best_jaccard"] == 1.0

    # Role compatibility check
    role_res = evaluator.evaluate_role_classification([cand_ring])
    assert role_res["evaluated_role_accounts"] == 3
    assert role_res["role_compatibility_rate"] > 0.6


def test_ground_truth_isolation_data_leakage_safety():
    """CRITICAL TEST: Ensure detector algorithms do NOT ingest or read ground truth columns."""
    from module_6_graph_builder_detectors import build_graph, run_detectors
    import inspect

    # Verify build_graph removes ground truth columns
    accs = pd.DataFrame([{"account_id": "A", "is_mule": 1}, {"account_id": "B", "is_mule": 0}])
    txns = pd.DataFrame([{"transaction_id": "T1", "sender_account": "A", "receiver_account": "B", "amount": 100.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI", "is_fraud": 1, "ring_id": "RING_X"}])

    graph = build_graph(accs, txns)
    # Ground truth fields must NOT be in graph node attributes or edge attributes
    assert "is_mule" not in graph.nodes["A"]
    assert "is_mule" not in graph.nodes["B"]
    edge_data = graph.get_edge_data("A", "B")["T1"]
    assert "is_fraud" not in edge_data
    assert "ring_id" not in edge_data


def test_evaluation_default_full_population_scope():
    """Verify that evaluate_accounts evaluates across the full eligible account population by default,
    properly counting unscored known negatives as True Negatives."""
    total_accs = 1000
    gt_mules_count = 10
    accounts = pd.DataFrame([
        {"account_id": f"ACC_{i:04d}", "is_mule": 1 if i < gt_mules_count else 0}
        for i in range(total_accs)
    ])
    txns = pd.DataFrame([])
    evaluator = GroundTruthEvaluator(accounts, txns)

    # Scored accounts: 4 detected mules (TP) and 1 false alarm (FP)
    # Remaining 995 accounts receive default score of 0.0
    scores = {
        "ACC_0000": 0.85,
        "ACC_0001": 0.75,
        "ACC_0002": 0.60,
        "ACC_0003": 0.55,
        "ACC_0050": 0.40,  # Legitimate account flagged as false positive
    }

    res = evaluator.evaluate_accounts(scores, evaluated_accounts=None, threshold=0.30)

    # Must evaluate all 1,000 accounts
    assert res["total_evaluated"] == total_accs
    assert res["true_positives"] == 4
    assert res["false_positives"] == 1
    assert res["false_negatives"] == 6      # 10 - 4
    assert res["true_negatives"] == 989     # 990 - 1

    assert res["precision"] == 4 / 5        # 0.8000
    assert res["recall"] == 4 / 10          # 0.4000
    assert abs(res["false_positive_rate"] - (1 / 990)) < 1e-4  # ~0.0010 (0.10%)


def test_ring_clustering_one_to_one_matching_prevents_inflation():
    """Verify that greedy 1-to-1 matching prevents multiple candidate sub-rings from inflating
    unique ground-truth ring matches."""
    accounts = pd.DataFrame([{"account_id": f"M_{i}", "is_mule": 1} for i in range(5)])
    txns = pd.DataFrame([])
    fraud_rings_df = pd.DataFrame([
        {"ring_id": "GT_RING_SOLO", "account_id": f"M_{i}", "ring_role": "Pass-through"}
        for i in range(5)
    ])
    evaluator = GroundTruthEvaluator(accounts, txns, fraud_rings_df)

    # Create 3 candidate sub-rings that all overlap heavily with the same single GT ring
    cand1 = RingCandidate(ring_id="C1", member_account_ids=["M_0", "M_1", "M_2"], community_id=1, roles={}, score=80.0, priority=100.0, amount_moved=100.0, amount_cashed=0.0, amount_at_risk=100.0)
    cand2 = RingCandidate(ring_id="C2", member_account_ids=["M_1", "M_2", "M_3"], community_id=2, roles={}, score=80.0, priority=100.0, amount_moved=100.0, amount_cashed=0.0, amount_at_risk=100.0)
    cand3 = RingCandidate(ring_id="C3", member_account_ids=["M_2", "M_3", "M_4"], community_id=3, roles={}, score=80.0, priority=100.0, amount_moved=100.0, amount_cashed=0.0, amount_at_risk=100.0)

    res = evaluator.evaluate_ring_clustering([cand1, cand2, cand3], min_jaccard=0.25)

    # Exactly 1 unique ground-truth ring exists, so 1-to-1 matching must match at most 1 pair!
    assert res["one_to_one_matched_rings"] == 1, "Must NOT claim multiple matches for the same GT ring"
    assert res["ring_precision"] == round(1 / 3, 4)
    assert res["ring_recall"] == 1.0
