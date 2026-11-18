"""Unit and edge-case tests for Module 7: Community Detection and Ring Clustering."""

import pandas as pd
import pytest

from module_6_graph_builder_detectors import build_graph, run_detectors, rule_scores
from module_7_community_ring_clustering import cluster_rings
from shared.models import Hit, RingCandidate
from shared.utils import compute_fingerprint


def test_simple_three_account_ring():
    """Verify standard 3-account ring is clustered, scored, and roles assigned."""
    accounts = pd.DataFrame([{"account_id": "A"}, {"account_id": "B"}, {"account_id": "C"}])
    txns = pd.DataFrame([
        {"transaction_id": "T1", "sender_account": "A", "receiver_account": "B", "amount": 1000.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T2", "sender_account": "B", "receiver_account": "C", "amount": 950.0, "timestamp": "2026-01-01T10:10:00", "transaction_status": "Success", "channel": "UPI"},
    ])
    graph = build_graph(accounts, txns)
    scores = {"A": 0.8, "B": 0.8, "C": 0.8}
    hits = [Hit("B", "rapid_pass_through", pd.to_datetime("2026-01-01T10:00:00"), pd.to_datetime("2026-01-01T10:10:00"), "high")]

    rings = cluster_rings(graph, scores, hits)
    assert len(rings) == 1
    r = rings[0]
    assert set(r.member_account_ids) == {"A", "B", "C"}
    assert r.roles["A"] in ["victim", "collector"]
    assert r.roles["B"] == "mule"
    assert r.roles["C"] == "cash_out"
    assert r.score > 0.0
    assert r.priority > 0.0
    assert r.fingerprint == compute_fingerprint(["A", "B", "C"])


def test_shared_mule_ring_separation():
    """CRITICAL TEST: Verify two rings sharing one mule account are NOT merged into one single ring.
    
    Ring A: A -> B -> C -> D
    Ring B: D -> E -> F -> G
    D is the shared mule.
    """
    accounts = pd.DataFrame([{"account_id": x} for x in ["A", "B", "C", "D", "E", "F", "G"]])
    txns = pd.DataFrame([
        # Ring A
        {"transaction_id": "TA1", "sender_account": "A", "receiver_account": "B", "amount": 10000, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "TA2", "sender_account": "B", "receiver_account": "C", "amount": 9500, "timestamp": "2026-01-01T10:10:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "TA3", "sender_account": "C", "receiver_account": "D", "amount": 9200, "timestamp": "2026-01-01T10:20:00", "transaction_status": "Success", "channel": "UPI"},
        # Ring B
        {"transaction_id": "TB1", "sender_account": "D", "receiver_account": "E", "amount": 5000, "timestamp": "2026-01-01T12:00:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "TB2", "sender_account": "E", "receiver_account": "F", "amount": 4800, "timestamp": "2026-01-01T12:10:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "TB3", "sender_account": "F", "receiver_account": "G", "amount": 4700, "timestamp": "2026-01-01T12:20:00", "transaction_status": "Success", "channel": "UPI"},
    ])
    graph = build_graph(accounts, txns)
    scores = {x: 0.85 for x in accounts["account_id"]}
    hits = run_detectors(graph)

    rings = cluster_rings(graph, scores, hits)
    # Must produce 2 distinct rings, NOT 1 giant 7-node ring!
    assert len(rings) == 2
    ring_members = [set(r.member_account_ids) for r in rings]
    assert {"A", "B", "C", "D"} in ring_members
    assert {"D", "E", "F", "G"} in ring_members


def test_disconnected_suspicious_groups():
    """Verify disconnected suspicious clusters form independent rings."""
    accounts = pd.DataFrame([{"account_id": x} for x in ["A1", "A2", "A3", "B1", "B2", "B3"]])
    txns = pd.DataFrame([
        # Group 1
        {"transaction_id": "T1", "sender_account": "A1", "receiver_account": "A2", "amount": 1000, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T2", "sender_account": "A2", "receiver_account": "A3", "amount": 950, "timestamp": "2026-01-01T10:10:00", "transaction_status": "Success", "channel": "UPI"},
        # Group 2
        {"transaction_id": "T3", "sender_account": "B1", "receiver_account": "B2", "amount": 2000, "timestamp": "2026-01-01T11:00:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T4", "sender_account": "B2", "receiver_account": "B3", "amount": 1900, "timestamp": "2026-01-01T11:10:00", "transaction_status": "Success", "channel": "UPI"},
    ])
    graph = build_graph(accounts, txns)
    scores = {x: 0.9 for x in accounts["account_id"]}
    rings = cluster_rings(graph, scores, [])

    assert len(rings) == 2
    fps = {r.fingerprint for r in rings}
    assert len(fps) == 2


def test_low_risk_accounts_filtered_out():
    """Verify low risk accounts (< threshold) without hits do not form rings."""
    accounts = pd.DataFrame([{"account_id": "A"}, {"account_id": "B"}, {"account_id": "C"}])
    txns = pd.DataFrame([
        {"transaction_id": "T1", "sender_account": "A", "receiver_account": "B", "amount": 100, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T2", "sender_account": "B", "receiver_account": "C", "amount": 95, "timestamp": "2026-01-01T10:10:00", "transaction_status": "Success", "channel": "UPI"},
    ])
    graph = build_graph(accounts, txns)
    scores = {"A": 0.05, "B": 0.05, "C": 0.05}

    rings = cluster_rings(graph, scores, [])
    assert len(rings) == 0


def test_empty_graph_returns_empty_rings():
    """Verify empty graph returns empty ring list."""
    accounts = pd.DataFrame(columns=["account_id"])
    txns = pd.DataFrame(columns=["transaction_id", "sender_account", "receiver_account", "amount", "timestamp", "transaction_status", "channel"])
    graph = build_graph(accounts, txns)

    rings = cluster_rings(graph, {}, [])
    assert rings == []


def test_amount_at_risk_calculation_with_sinks():
    """Verify cash-out to sinks properly reduces amount at risk."""
    accounts = pd.DataFrame([{"account_id": "VIC"}, {"account_id": "MULE"}, {"account_id": "SINK"}])
    txns = pd.DataFrame([
        {"transaction_id": "T1", "sender_account": "VIC", "receiver_account": "MULE", "amount": 10000, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T2", "sender_account": "MULE", "receiver_account": "SINK", "amount": 8000, "timestamp": "2026-01-01T10:15:00", "transaction_status": "Success", "channel": "UPI"},
    ])
    graph = build_graph(accounts, txns, sink_accounts={"SINK"})
    scores = {"VIC": 0.1, "MULE": 0.9, "SINK": 0.9}
    hits = [Hit("MULE", "rapid_pass_through", pd.to_datetime("2026-01-01T10:00:00"), pd.to_datetime("2026-01-01T10:15:00"), "high")]

    rings = cluster_rings(graph, scores, hits, sink_accounts={"SINK"})
    assert len(rings) == 1
    r = rings[0]
    assert r.amount_moved == 18000.0
    assert r.amount_cashed == 8000.0
    assert r.amount_at_risk == 2000.0  # 10,000 inflow - 8,000 cashed out
    assert r.roles["SINK"] == "cash_out"


def test_clustering_determinism_under_node_permutations():
    """REGRESSION TEST: Verify ring clustering, IDs, roles, scores, and fingerprints
    are 100% identical regardless of graph node and edge insertion orders.
    """
    import random
    raw_nodes = ["ACC_A", "ACC_B", "ACC_C", "ACC_D", "ACC_E", "ACC_F", "ACC_G", "ACC_H"]
    raw_txns = [
        ("T1", "ACC_A", "ACC_B", 5000.0, "2026-01-01T10:00:00"),
        ("T2", "ACC_B", "ACC_C", 4800.0, "2026-01-01T10:05:00"),
        ("T3", "ACC_C", "ACC_D", 4700.0, "2026-01-01T10:10:00"),
        ("T4", "ACC_D", "ACC_A", 4600.0, "2026-01-01T10:15:00"),
        ("T5", "ACC_E", "ACC_F", 8000.0, "2026-01-01T11:00:00"),
        ("T6", "ACC_F", "ACC_G", 7800.0, "2026-01-01T11:10:00"),
        ("T7", "ACC_G", "ACC_H", 7700.0, "2026-01-01T11:20:00"),
    ]
    scores = {acc: 0.85 for acc in raw_nodes}

    runs_output = []
    # Test across 4 different random seeds and orderings
    for seed in [42, 99, 123, 777]:
        rng = random.Random(seed)
        shuffled_nodes = list(raw_nodes)
        rng.shuffle(shuffled_nodes)
        shuffled_txns = list(raw_txns)
        rng.shuffle(shuffled_txns)

        acc_df = pd.DataFrame([{"account_id": n} for n in shuffled_nodes])
        txn_df = pd.DataFrame([
            {
                "transaction_id": t[0],
                "sender_account": t[1],
                "receiver_account": t[2],
                "amount": t[3],
                "timestamp": t[4],
                "transaction_status": "Success",
                "channel": "Online",
            }
            for t in shuffled_txns
        ])
        g = build_graph(acc_df, txn_df)
        h = run_detectors(g)
        rings = cluster_rings(g, scores, h)
        runs_output.append(rings)

    # All runs must produce exactly identical rings!
    base_rings = runs_output[0]
    for other_rings in runs_output[1:]:
        assert len(other_rings) == len(base_rings)
        for r_base, r_other in zip(base_rings, other_rings):
            assert r_base.ring_id == r_other.ring_id
            assert r_base.member_account_ids == r_other.member_account_ids
            assert r_base.roles == r_other.roles
            assert r_base.score == r_other.score
            assert r_base.priority == r_other.priority
            assert r_base.fingerprint == r_other.fingerprint
