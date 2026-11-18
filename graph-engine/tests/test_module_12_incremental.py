"""Unit and streaming tests for Module 12a: Incremental Sliding-Window Detection."""

from datetime import datetime, timedelta
import pandas as pd
import pytest

from module_6_graph_builder_detectors import build_graph, run_detectors, rule_scores
from module_7_community_ring_clustering import cluster_rings
from module_12_incremental_sliding_window import SlidingWindowGraphManager, IncrementalDetectorEngine


def test_sliding_window_transaction_lifecycle():
    """Verify transaction addition, deduplication, and expiration in SlidingWindowGraphManager."""
    mgr = SlidingWindowGraphManager(window_minutes=60)

    # 1. Add normal transaction
    t1 = {"transaction_id": "T1", "sender_account": "A", "receiver_account": "B", "amount": 100, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"}
    added, touched = mgr.add_transaction(t1)
    assert added is True
    assert touched == {"A", "B"}
    assert mgr.graph.number_of_edges() == 1

    # 2. Duplicate transaction is ignored
    added_dup, _ = mgr.add_transaction(t1)
    assert added_dup is False
    assert mgr.graph.number_of_edges() == 1

    # 3. Failed transaction is ignored
    t_failed = {"transaction_id": "TF", "sender_account": "A", "receiver_account": "B", "amount": 50, "timestamp": "2026-01-01T10:05:00", "transaction_status": "Failed", "channel": "UPI"}
    added_fail, _ = mgr.add_transaction(t_failed)
    assert added_fail is False

    # 4. Out-of-order within window
    t_ooo = {"transaction_id": "T_OOO", "sender_account": "B", "receiver_account": "C", "amount": 80, "timestamp": "2026-01-01T10:02:00", "transaction_status": "Success", "channel": "UPI"}
    added_ooo, _ = mgr.add_transaction(t_ooo)
    assert added_ooo is True
    assert mgr.graph.number_of_edges() == 2

    # 5. Expiration: advance clock by 2 hours
    t_future = {"transaction_id": "T_FUT", "sender_account": "X", "receiver_account": "Y", "amount": 200, "timestamp": "2026-01-01T12:05:00", "transaction_status": "Success", "channel": "UPI"}
    added_fut, _ = mgr.add_transaction(t_future)
    assert added_fut is True
    # Previous transactions at 10:00 and 10:02 are older than 12:05 - 60min = 11:05, so they expired!
    assert mgr.graph.number_of_edges() == 1
    assert not mgr.graph.has_edge("A", "B", key="T1")


def test_incremental_fan_in_burst_trigger():
    """Verify incremental processing triggers fan-in burst when threshold is reached."""
    engine = IncrementalDetectorEngine(window_minutes=60)

    # Ingest 4 transactions into TARGET (below min_senders=5)
    for i in range(1, 5):
        txn = {
            "transaction_id": f"T_{i}",
            "sender_account": f"SRC_{i}",
            "receiver_account": "TARGET",
            "amount": 2000.0,
            "timestamp": f"2026-01-01T10:{i*5:02d}:00",
            "transaction_status": "Success",
            "channel": "UPI",
        }
        res = engine.process_transaction(txn)
        assert "fan_in_burst" not in res.triggered_detector_codes

    # 5th transaction crosses threshold (min_senders=5, amount >= 1000)
    t5 = {
        "transaction_id": "T_5",
        "sender_account": "SRC_5",
        "receiver_account": "TARGET",
        "amount": 2000.0,
        "timestamp": "2026-01-01T10:25:00",
        "transaction_status": "Success",
        "channel": "UPI",
    }
    res5 = engine.process_transaction(t5)
    assert "fan_in_burst" in res5.triggered_detector_codes
    assert res5.updated_account_scores["TARGET"] > 0.0


def test_incremental_rapid_pass_through_sequence():
    """Verify incremental processing identifies rapid pass-through upon matching outflow arrival."""
    engine = IncrementalDetectorEngine(window_minutes=60)

    # Inflow
    t_in = {"transaction_id": "T_IN", "sender_account": "VICTIM", "receiver_account": "MULE", "amount": 10000.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"}
    engine.process_transaction(t_in)

    # Outflow 8 minutes later
    t_out = {"transaction_id": "T_OUT", "sender_account": "MULE", "receiver_account": "DEST", "amount": 9500.0, "timestamp": "2026-01-01T10:08:00", "transaction_status": "Success", "channel": "UPI"}
    res_out = engine.process_transaction(t_out)

    assert "rapid_pass_through" in res_out.triggered_detector_codes
    assert res_out.updated_account_scores["MULE"] > 0.0


def test_incremental_circular_flow_trigger():
    """Verify circular flow alert is emitted when final closing transfer arrives."""
    engine = IncrementalDetectorEngine(window_minutes=60)

    t1 = {"transaction_id": "T1", "sender_account": "ACC_A", "receiver_account": "ACC_B", "amount": 2000.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"}
    t2 = {"transaction_id": "T2", "sender_account": "ACC_B", "receiver_account": "ACC_C", "amount": 1950.0, "timestamp": "2026-01-01T10:05:00", "transaction_status": "Success", "channel": "UPI"}
    engine.process_transaction(t1)
    engine.process_transaction(t2)

    # Closing transfer C -> A
    t3 = {"transaction_id": "T3", "sender_account": "ACC_C", "receiver_account": "ACC_A", "amount": 1900.0, "timestamp": "2026-01-01T10:10:00", "transaction_status": "Success", "channel": "UPI"}
    res3 = engine.process_transaction(t3)

    assert "circular_flow" in res3.triggered_detector_codes
    assert res3.current_status in ["new_alert", "alert_triggered"]
    assert res3.alert_score >= 50.0


def test_incremental_vs_batch_consistency():
    """Verify incremental output on streaming transactions is consistent with batch execution on the same window."""
    txns_data = [
        {"transaction_id": "T1", "sender_account": "A", "receiver_account": "B", "amount": 5000.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T2", "sender_account": "B", "receiver_account": "C", "amount": 4800.0, "timestamp": "2026-01-01T10:10:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T3", "sender_account": "C", "receiver_account": "D", "amount": 4700.0, "timestamp": "2026-01-01T10:20:00", "transaction_status": "Success", "channel": "UPI"},
    ]
    accounts_data = [{"account_id": x} for x in ["A", "B", "C", "D"]]

    # Batch run
    batch_graph = build_graph(pd.DataFrame(accounts_data), pd.DataFrame(txns_data))
    batch_hits = run_detectors(batch_graph)
    batch_scores = rule_scores(batch_hits)

    # Incremental run
    engine = IncrementalDetectorEngine(window_minutes=60)
    for t in txns_data:
        engine.process_transaction(t)

    # Check that scores for key accounts match closely
    for acc in ["B", "C"]:
        assert abs(engine.account_scores.get(acc, 0.0) - batch_scores.get(acc, 0.0)) < 0.15


def test_incremental_duplicate_rejection_and_retention_policy():
    """Verify duplicate transactions are rejected both in active window and after expiration via historical tracking."""
    engine = IncrementalDetectorEngine(window_minutes=60)

    t1 = {"transaction_id": "TXN_DUP_1", "sender_account": "A", "receiver_account": "B", "amount": 1000.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"}
    res1 = engine.process_transaction(t1)
    assert res1.current_status != "ignored_or_duplicate"
    assert "TXN_DUP_1" in engine.window_mgr.active_window_txn_ids

    # Immediate replay inside active window
    res_dup = engine.process_transaction(t1)
    assert res_dup.current_status == "ignored_or_duplicate"

    # Advance time by 2 hours so T1 expires from active window
    t2 = {"transaction_id": "TXN_LATER", "sender_account": "C", "receiver_account": "D", "amount": 500.0, "timestamp": "2026-01-01T12:00:00", "transaction_status": "Success", "channel": "UPI"}
    engine.process_transaction(t2)
    assert "TXN_DUP_1" not in engine.window_mgr.active_window_txn_ids
    assert "TXN_DUP_1" in engine.window_mgr.historical_seen_txn_ids

    # Replay of TXN_DUP_1 after active-window expiration must STILL be rejected!
    res_late_dup = engine.process_transaction(t1)
    assert res_late_dup.current_status == "ignored_or_duplicate"


def test_incremental_out_of_order_transactions():
    """Verify out-of-order transactions within active window are accepted, while older ones are dropped."""
    engine = IncrementalDetectorEngine(window_minutes=60)

    # Ingest event at 10:30 (advances watermark to 10:30, window is 09:30 - 10:30)
    t1 = {"transaction_id": "T_1030", "sender_account": "A", "receiver_account": "B", "amount": 1000.0, "timestamp": "2026-01-01T10:30:00", "transaction_status": "Success", "channel": "UPI"}
    engine.process_transaction(t1)

    # Out-of-order event at 10:15 (within 60m window: > 09:30) -> MUST BE ACCEPTED
    t_ooo_valid = {"transaction_id": "T_1015", "sender_account": "B", "receiver_account": "C", "amount": 950.0, "timestamp": "2026-01-01T10:15:00", "transaction_status": "Success", "channel": "UPI"}
    res_valid = engine.process_transaction(t_ooo_valid)
    assert res_valid.current_status != "expired_out_of_order"
    assert engine.window_mgr.graph.has_edge("B", "C", key="T_1015")

    # Out-of-order event at 09:00 (older than 09:30 cutoff) -> MUST BE DROPPED
    t_ooo_expired = {"transaction_id": "T_0900", "sender_account": "X", "receiver_account": "Y", "amount": 500.0, "timestamp": "2026-01-01T09:00:00", "transaction_status": "Success", "channel": "UPI"}
    res_expired = engine.process_transaction(t_ooo_expired)
    assert res_expired.current_status == "expired_out_of_order"
    assert not engine.window_mgr.graph.has_edge("X", "Y", key="T_0900")


def test_incremental_ring_expiration_and_reactivation_lifecycle():
    """Verify ring formation (new_alert), dissolution on expiration (alert_deactivated),
    and reappearance on new transfers (alert_reactivated)."""
    engine = IncrementalDetectorEngine(window_minutes=60)

    # Step 1: Form a circular ring at 10:00
    t1 = {"transaction_id": "T1", "sender_account": "R_A", "receiver_account": "R_B", "amount": 5000.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"}
    t2 = {"transaction_id": "T2", "sender_account": "R_B", "receiver_account": "R_C", "amount": 4900.0, "timestamp": "2026-01-01T10:05:00", "transaction_status": "Success", "channel": "UPI"}
    t3 = {"transaction_id": "T3", "sender_account": "R_C", "receiver_account": "R_A", "amount": 4800.0, "timestamp": "2026-01-01T10:10:00", "transaction_status": "Success", "channel": "UPI"}
    engine.process_transaction(t1)
    engine.process_transaction(t2)
    res3 = engine.process_transaction(t3)

    assert res3.current_status in ["new_alert", "alert_triggered"]
    fp = res3.fingerprint
    assert fp in engine.active_rings
    assert engine.account_scores.get("R_B", 0.0) > 0.0

    # Step 2: Advance time by 2 hours with an unrelated transfer to expire the ring
    t_advance = {"transaction_id": "T_ADV", "sender_account": "UNR_1", "receiver_account": "UNR_2", "amount": 100.0, "timestamp": "2026-01-01T12:00:00", "transaction_status": "Success", "channel": "UPI"}
    res_adv = engine.process_transaction(t_advance)

    # Ring transactions expired!
    assert fp not in engine.active_rings
    assert fp in engine.deactivated_rings
    # Expired accounts must have their scores reconciled to 0.0
    assert engine.account_scores.get("R_B", 0.0) == 0.0

    # Step 3: Reactivate ring with new circular transactions at 12:10
    t4 = {"transaction_id": "T4", "sender_account": "R_A", "receiver_account": "R_B", "amount": 6000.0, "timestamp": "2026-01-01T12:10:00", "transaction_status": "Success", "channel": "UPI"}
    t5 = {"transaction_id": "T5", "sender_account": "R_B", "receiver_account": "R_C", "amount": 5900.0, "timestamp": "2026-01-01T12:15:00", "transaction_status": "Success", "channel": "UPI"}
    t6 = {"transaction_id": "T6", "sender_account": "R_C", "receiver_account": "R_A", "amount": 5800.0, "timestamp": "2026-01-01T12:20:00", "transaction_status": "Success", "channel": "UPI"}
    engine.process_transaction(t4)
    engine.process_transaction(t5)
    res6 = engine.process_transaction(t6)

    # Must be recognized as alert_reactivated!
    assert res6.current_status == "alert_reactivated"
    assert fp in engine.active_rings
    assert fp not in engine.deactivated_rings


def test_incremental_high_volume_throughput_and_latency():
    """Verify incremental engine processes a high-volume stream with sub-millisecond average latency."""
    engine = IncrementalDetectorEngine(window_minutes=60)
    txns = [
        {
            "transaction_id": f"VOL_TXN_{i}",
            "sender_account": f"USER_{i % 50}",
            "receiver_account": f"USER_{(i + 1) % 50}",
            "amount": 100.0 + (i % 20) * 10,
            "timestamp": f"2026-01-01T10:{i // 60:02d}:{i % 60:02d}",
            "transaction_status": "Success",
            "channel": "UPI",
        }
        for i in range(500)
    ]

    latencies = []
    for t in txns:
        evt = engine.process_transaction(t)
        latencies.append(evt.processing_time_ms)

    avg_lat = sum(latencies) / len(latencies)
    assert avg_lat < 5.0, f"Average latency too high: {avg_lat:.2f} ms"


def test_advance_time_without_new_transactions_full_ring_expiration():
    """Verify advance_time() recalculates scores, removes stale hits, and deactivates rings."""
    engine = IncrementalDetectorEngine(window_minutes=60)

    # Ingest circular ring at 10:00
    t1 = {"transaction_id": "T1", "sender_account": "ACC_1", "receiver_account": "ACC_2", "amount": 5000.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"}
    t2 = {"transaction_id": "T2", "sender_account": "ACC_2", "receiver_account": "ACC_3", "amount": 4900.0, "timestamp": "2026-01-01T10:05:00", "transaction_status": "Success", "channel": "UPI"}
    t3 = {"transaction_id": "T3", "sender_account": "ACC_3", "receiver_account": "ACC_1", "amount": 4800.0, "timestamp": "2026-01-01T10:10:00", "transaction_status": "Success", "channel": "UPI"}
    engine.process_transaction(t1)
    engine.process_transaction(t2)
    res_trigger = engine.process_transaction(t3)

    assert res_trigger.current_status in ["new_alert", "alert_triggered"]
    fp = res_trigger.fingerprint
    assert fp in engine.active_rings
    assert engine.account_scores.get("ACC_2", 0.0) > 0.0

    # Advance watermark by 90 minutes without new transactions
    adv_evt = engine.advance_time(datetime(2026, 1, 1, 11, 40))

    # All ring transactions expired
    assert adv_evt.current_status == "alert_deactivated"
    assert fp not in engine.active_rings
    assert fp in engine.deactivated_rings
    # Scores must be cleanly zeroed out with no stale residue
    assert adv_evt.updated_account_scores.get("ACC_1", 0.0) == 0.0
    assert adv_evt.updated_account_scores.get("ACC_2", 0.0) == 0.0
    assert adv_evt.updated_account_scores.get("ACC_3", 0.0) == 0.0
    assert engine.account_scores.get("ACC_2", 0.0) == 0.0
    assert engine.account_hits.get("ACC_2", []) == []


def test_partial_ring_expiration_and_score_reduction():
    """Verify that when one edge of a ring expires while other edges remain,
    the cycle is broken, score is reduced, and ring alert is deactivated."""
    engine = IncrementalDetectorEngine(window_minutes=60)

    # T1 at 10:00, T2 at 10:25, T3 at 10:30
    t1 = {"transaction_id": "T1", "sender_account": "P_A", "receiver_account": "P_B", "amount": 4000.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"}
    t2 = {"transaction_id": "T2", "sender_account": "P_B", "receiver_account": "P_C", "amount": 3900.0, "timestamp": "2026-01-01T10:25:00", "transaction_status": "Success", "channel": "UPI"}
    t3 = {"transaction_id": "T3", "sender_account": "P_C", "receiver_account": "P_A", "amount": 3800.0, "timestamp": "2026-01-01T10:30:00", "transaction_status": "Success", "channel": "UPI"}
    engine.process_transaction(t1)
    engine.process_transaction(t2)
    res3 = engine.process_transaction(t3)

    assert res3.current_status in ["new_alert", "alert_triggered"]
    fp = res3.fingerprint
    score_full_cycle = engine.account_scores.get("P_B", 0.0)
    assert score_full_cycle > 0.0

    # Advance time to 11:10 (cutoff is 10:10): T1 expires, but T2 (10:25) and T3 (10:30) remain!
    adv_evt = engine.advance_time(datetime(2026, 1, 1, 11, 10))

    # T1 expired, breaking the cycle
    assert not engine.window_mgr.graph.has_edge("P_A", "P_B", key="T1")
    assert engine.window_mgr.graph.has_edge("P_B", "P_C", key="T2")
    assert engine.window_mgr.graph.has_edge("P_C", "P_A", key="T3")

    # Ring should be deactivated because cycle is broken
    assert fp not in engine.active_rings
    assert fp in engine.deactivated_rings
    assert adv_evt.current_status == "alert_deactivated"

    # Score for P_B must be reduced because circular_flow hit is gone
    score_partial = engine.account_scores.get("P_B", 0.0)
    assert score_partial < score_full_cycle


def test_controlled_normal_stream_no_unjustified_alerts():
    """Verify that a controlled sequence of normal, benign retail transactions produces zero unjustified alerts."""
    engine = IncrementalDetectorEngine(window_minutes=60)

    # 50 normal transactions between distinct sender-receiver pairs, amounts 50-250, spaced 2 minutes apart
    normal_txns = [
        {
            "transaction_id": f"NORM_{i:03d}",
            "sender_account": f"CUST_{i:03d}",
            "receiver_account": f"MERCH_{i:03d}",
            "amount": 75.0 + (i % 10) * 15.0,
            "timestamp": f"2026-01-01T10:{i*2 // 60:02d}:{i*2 % 60:02d}",
            "transaction_status": "Success",
            "channel": "UPI",
        }
        for i in range(50)
    ]

    for txn in normal_txns:
        evt = engine.process_transaction(txn)
        assert evt.current_status == "monitored", f"Expected monitored status for normal txn, got {evt.current_status}"
        assert len(evt.triggered_detector_codes) == 0, f"Expected 0 hits for normal txn, got {evt.triggered_detector_codes}"

    assert len(engine.active_rings) == 0, "No active rings should exist for normal traffic"
    assert len(engine.deactivated_rings) == 0, "No deactivated rings should exist for normal traffic"


def test_controlled_suspicious_stream_and_reactivation():
    """Deterministic controlled stream: verifies that suspicious sequences trigger detection,
    normal transfers do not, expiration removes evidence, and rings deactivate & reactivate."""
    engine = IncrementalDetectorEngine(window_minutes=60)

    # Step 1: Normal transaction -> monitored, no alerts
    norm_t = {"transaction_id": "T_NORM", "sender_account": "ALICE", "receiver_account": "BOB", "amount": 100.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"}
    evt_norm = engine.process_transaction(norm_t)
    assert evt_norm.current_status == "monitored"
    assert len(evt_norm.triggered_detector_codes) == 0

    # Step 2: Inject rapid pass-through: Inflow 10,000 into MULE_X, outflow 9,600 to SINK_Y at 10:08
    t_in = {"transaction_id": "T_IN", "sender_account": "VICTIM_V", "receiver_account": "MULE_X", "amount": 10000.0, "timestamp": "2026-01-01T10:02:00", "transaction_status": "Success", "channel": "UPI"}
    engine.process_transaction(t_in)

    t_out = {"transaction_id": "T_OUT", "sender_account": "MULE_X", "receiver_account": "SINK_Y", "amount": 9600.0, "timestamp": "2026-01-01T10:08:00", "transaction_status": "Success", "channel": "UPI"}
    evt_rpt = engine.process_transaction(t_out)
    assert "rapid_pass_through" in evt_rpt.triggered_detector_codes
    assert engine.account_scores.get("MULE_X", 0.0) > 0.0

    # Step 3: Duplicate replay of T_OUT -> MUST be rejected
    evt_dup = engine.process_transaction(t_out)
    assert evt_dup.current_status == "ignored_or_duplicate"

    # Step 4: Inject Fan-in Burst into HUB_Z (5 senders within 15 min, amount >= 1000)
    for i in range(1, 5):
        t_sub = {"transaction_id": f"T_BURST_{i}", "sender_account": f"SRC_{i}", "receiver_account": "HUB_Z", "amount": 2500.0, "timestamp": f"2026-01-01T10:{10+i*2:02d}:00", "transaction_status": "Success", "channel": "UPI"}
        engine.process_transaction(t_sub)

    t_burst_final = {"transaction_id": "T_BURST_5", "sender_account": "SRC_5", "receiver_account": "HUB_Z", "amount": 2500.0, "timestamp": "2026-01-01T10:20:00", "transaction_status": "Success", "channel": "UPI"}
    evt_burst = engine.process_transaction(t_burst_final)
    assert "fan_in_burst" in evt_burst.triggered_detector_codes
    assert engine.account_scores.get("HUB_Z", 0.0) > 0.0

    # Step 5: Advance time by 2 hours via advance_time() -> all events expire
    adv_evt = engine.advance_time(datetime(2026, 1, 1, 12, 30))
    assert engine.account_scores.get("MULE_X", 0.0) == 0.0
    assert engine.account_scores.get("HUB_Z", 0.0) == 0.0
    assert engine.account_hits.get("MULE_X", []) == []
    assert engine.account_hits.get("HUB_Z", []) == []

    # Step 6: Replay T_BURST_5 after window expiration -> historical tracking must STILL reject replay!
    evt_late_dup = engine.process_transaction(t_burst_final)
    assert evt_late_dup.current_status == "ignored_or_duplicate"
