"""End-to-end integration test verifying Modules 6, 7, and 12a work together."""

from datetime import datetime
import pandas as pd
import pytest

from module_6_graph_builder_detectors import (
    build_graph,
    run_detectors,
    rule_scores,
)
from module_7_community_ring_clustering import cluster_rings
from module_12_incremental_sliding_window import IncrementalDetectorEngine


def test_full_pipeline_batch_and_stream_integration():
    """Verify raw input -> Module 6 -> Module 7 -> Module 12a integration."""
    # Accounts
    accounts_df = pd.DataFrame([
        {"account_id": "ACC_V1", "account_type": "Savings", "kyc_status": "Verified"},
        {"account_id": "ACC_V2", "account_type": "Savings", "kyc_status": "Verified"},
        {"account_id": "ACC_COL", "account_type": "Current", "kyc_status": "Verified"},
        {"account_id": "ACC_M1", "account_type": "Savings", "kyc_status": "Pending"},
        {"account_id": "ACC_M2", "account_type": "Savings", "kyc_status": "Pending"},
        {"account_id": "ACC_SINK", "account_type": "Salary", "kyc_status": "Verified"},
    ])

    # Transactions forming Fan-in -> Pass-through -> Cash-out
    txns_df = pd.DataFrame([
        # 1. Victims send to Collector
        {"transaction_id": "T1", "sender_account": "ACC_V1", "receiver_account": "ACC_COL",
         "amount": 25000.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T2", "sender_account": "ACC_V2", "receiver_account": "ACC_COL",
         "amount": 25000.0, "timestamp": "2026-01-01T10:05:00", "transaction_status": "Success", "channel": "UPI"},
        # 2. Collector splits to M1 and M2
        {"transaction_id": "T3", "sender_account": "ACC_COL", "receiver_account": "ACC_M1",
         "amount": 24000.0, "timestamp": "2026-01-01T10:15:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T4", "sender_account": "ACC_COL", "receiver_account": "ACC_M2",
         "amount": 24000.0, "timestamp": "2026-01-01T10:18:00", "transaction_status": "Success", "channel": "UPI"},
        # 3. M1 and M2 forward to Sink
        {"transaction_id": "T5", "sender_account": "ACC_M1", "receiver_account": "ACC_SINK",
         "amount": 23500.0, "timestamp": "2026-01-01T10:25:00", "transaction_status": "Success", "channel": "IMPS"},
        {"transaction_id": "T6", "sender_account": "ACC_M2", "receiver_account": "ACC_SINK",
         "amount": 23500.0, "timestamp": "2026-01-01T10:28:00", "transaction_status": "Success", "channel": "IMPS"},
    ])

    sink_accounts = {"ACC_SINK"}

    # Step 1: Module 6 Graph Builder
    graph = build_graph(accounts_df, txns_df, sink_accounts=sink_accounts)
    assert graph.number_of_nodes() == 6
    assert graph.number_of_edges() == 6

    # Step 2: Module 6 Detectors
    hits = run_detectors(graph)
    assert len(hits) >= 1
    hit_codes = {h.code for h in hits}
    assert "rapid_pass_through" in hit_codes

    # Step 3: Module 6 Rule Scores
    scores = rule_scores(hits)
    assert 0.0 <= scores["ACC_COL"] <= 1.0
    assert 0.0 <= scores["ACC_M1"] <= 1.0

    # Step 4: Module 7 Community & Ring Clustering
    rings = cluster_rings(graph, scores, hits, sink_accounts=sink_accounts)
    assert len(rings) >= 1
    top_ring = rings[0]

    assert top_ring.score > 0.0
    assert top_ring.amount_moved >= 47000.0
    assert top_ring.amount_cashed > 0.0
    assert top_ring.roles["ACC_SINK"] == "cash_out"
    assert top_ring.fingerprint != ""
    assert top_ring.recommended_action in ["freeze_and_escalate", "watchlist_review", "monitor"]

    # Step 5: Module 12a Incremental Streaming Replay
    engine = IncrementalDetectorEngine(window_minutes=60, sink_accounts=sink_accounts)
    events = []
    for row in txns_df.to_dict(orient="records"):
        evt = engine.process_transaction(row)
        events.append(evt)

    assert len(events) == 6
    # The last transfer should have updated ring or alert status
    assert events[-1].processing_time_ms >= 0.0
    assert len(engine.window_mgr.active_transactions) == 6
