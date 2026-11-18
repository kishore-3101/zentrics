"""Unit and edge-case tests for Module 6: Graph Builder and Detectors."""

from datetime import datetime, timedelta
import pandas as pd
import pytest

from module_6_graph_builder_detectors import (
    build_graph,
    get_window_view,
    run_detectors,
    rule_scores,
    detect_fan_in_burst,
    detect_fan_out_split,
    detect_rapid_pass_through,
    detect_layering_chain,
    detect_circular_flow,
    detect_dormant_activation,
)
from shared.models import Hit


def test_graph_builder_directed_multigraph_parallel():
    """Verify directed multigraph preserves parallel transfers."""
    accounts = pd.DataFrame({"account_id": ["ACC_1", "ACC_2"]})
    txns = pd.DataFrame([
        {"transaction_id": "T1", "sender_account": "ACC_1", "receiver_account": "ACC_2",
         "amount": 100.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T2", "sender_account": "ACC_1", "receiver_account": "ACC_2",
         "amount": 200.0, "timestamp": "2026-01-01T10:05:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T3", "sender_account": "ACC_2", "receiver_account": "ACC_1",
         "amount": 300.0, "timestamp": "2026-01-01T10:10:00", "transaction_status": "Failed", "channel": "UPI"},
    ])

    graph = build_graph(accounts, txns)
    assert graph.is_directed()
    assert graph.is_multigraph()
    assert graph.number_of_nodes() == 2
    assert graph.number_of_edges() == 2  # Only successful transfers
    assert graph.has_edge("ACC_1", "ACC_2", key="T1")
    assert graph.has_edge("ACC_1", "ACC_2", key="T2")
    assert not graph.has_edge("ACC_2", "ACC_1")  # Failed transfer ignored


def test_graph_builder_window_filtering():
    """Verify time window filters endpoints inclusively."""
    accounts = pd.DataFrame({"account_id": ["A", "B"]})
    txns = pd.DataFrame([
        {"transaction_id": "T1", "sender_account": "A", "receiver_account": "B",
         "amount": 10.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T2", "sender_account": "A", "receiver_account": "B",
         "amount": 20.0, "timestamp": "2026-01-01T11:00:00", "transaction_status": "Success", "channel": "UPI"},
    ])

    sub = build_graph(accounts, txns, window=("2026-01-01T10:00:00", "2026-01-01T10:30:00"))
    assert sub.number_of_edges() == 1
    assert sub.has_edge("A", "B", key="T1")


def test_graph_builder_ground_truth_isolation():
    """Verify ground truth columns are excluded from graph nodes and edges."""
    accounts = pd.DataFrame({"account_id": ["A", "B"], "is_mule": [1, 0]})
    txns = pd.DataFrame([
        {"transaction_id": "T1", "sender_account": "A", "receiver_account": "B",
         "amount": 10.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success",
         "channel": "UPI", "is_fraud": 1, "ring_id": "RING_1", "fraud_pattern": "Circular"},
    ])

    graph = build_graph(accounts, txns)
    assert "is_mule" not in graph.nodes["A"]
    edge_data = graph.get_edge_data("A", "B", key="T1")
    assert "is_fraud" not in edge_data
    assert "ring_id" not in edge_data
    assert "fraud_pattern" not in edge_data


def test_graph_builder_validation_errors():
    """Verify invalid inputs raise expected ValueError."""
    # Missing columns
    with pytest.raises(ValueError):
        build_graph(pd.DataFrame({"foo": [1]}), pd.DataFrame())

    # Duplicate account_id
    with pytest.raises(ValueError):
        build_graph(pd.DataFrame({"account_id": ["A", "A"]}), pd.DataFrame(columns=["transaction_id", "sender_account", "receiver_account", "amount", "timestamp", "transaction_status", "channel"]))

    # Negative amount
    accounts = pd.DataFrame({"account_id": ["A", "B"]})
    txns = pd.DataFrame([{"transaction_id": "T1", "sender_account": "A", "receiver_account": "B", "amount": -5.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"}])
    with pytest.raises(ValueError):
        build_graph(accounts, txns)

    # Unknown account reference
    txns_unknown = pd.DataFrame([{"transaction_id": "T1", "sender_account": "A", "receiver_account": "UNKNOWN", "amount": 5.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"}])
    with pytest.raises(ValueError):
        build_graph(accounts, txns_unknown)


def test_get_window_view():
    """Verify preset window views ('10m', '1h', '24h', '7d')."""
    accounts = pd.DataFrame({"account_id": ["A", "B"]})
    base_time = datetime(2026, 1, 1, 12, 0, 0)
    txns = pd.DataFrame([
        {"transaction_id": "T1", "sender_account": "A", "receiver_account": "B", "amount": 10, "timestamp": base_time - timedelta(minutes=5), "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T2", "sender_account": "A", "receiver_account": "B", "amount": 20, "timestamp": base_time - timedelta(minutes=30), "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T3", "sender_account": "A", "receiver_account": "B", "amount": 30, "timestamp": base_time - timedelta(hours=2), "transaction_status": "Success", "channel": "UPI"},
    ])
    graph = build_graph(accounts, txns)

    v10m = get_window_view(graph, view="10m", reference_time=base_time)
    assert v10m.number_of_edges() == 1
    assert v10m.has_edge("A", "B", key="T1")

    v1h = get_window_view(graph, view="1h", reference_time=base_time)
    assert v1h.number_of_edges() == 2

    v24h = get_window_view(graph, view="24h", reference_time=base_time)
    assert v24h.number_of_edges() == 3


def test_detector_fan_in_burst_positive_and_negative():
    """Verify Fan-in burst detector fires on rapid multi-sender inflow and ignores slow inflows."""
    accounts = pd.DataFrame({"account_id": [f"ACC_{i}" for i in range(10)]})

    # Positive: 6 senders within 30 min into ACC_0
    txns_pos = pd.DataFrame([
        {"transaction_id": f"TP_{i}", "sender_account": f"ACC_{i}", "receiver_account": "ACC_0",
         "amount": 2000.0, "timestamp": f"2026-01-01T10:{i*5:02d}:00", "transaction_status": "Success", "channel": "UPI"}
        for i in range(1, 7)
    ])
    g_pos = build_graph(accounts, txns_pos)
    hits_pos = detect_fan_in_burst(g_pos, {"detectors": {"fan_in_burst": {"min_senders": 5, "min_amount": 5000.0}}})
    assert len(hits_pos) >= 1
    assert hits_pos[0].account_id == "ACC_0"
    assert hits_pos[0].code == "fan_in_burst"

    # Negative: same 6 senders spread over 3 days (1 txn every 12 hours)
    txns_neg = pd.DataFrame([
        {"transaction_id": f"TN_{i}", "sender_account": f"ACC_{i}", "receiver_account": "ACC_0",
         "amount": 2000.0, "timestamp": f"2026-01-0{i+1}T10:00:00", "transaction_status": "Success", "channel": "UPI"}
        for i in range(1, 7)
    ])
    g_neg = build_graph(accounts, txns_neg)
    hits_neg = detect_fan_in_burst(g_neg, {"detectors": {"fan_in_burst": {"min_senders": 5, "window_minutes": 60}}})
    assert len(hits_neg) == 0


def test_detector_fan_out_split_positive_and_negative():
    """Verify Fan-out split detector fires on distribution burst and ignores gradual transfers."""
    accounts = pd.DataFrame({"account_id": [f"ACC_{i}" for i in range(10)]})

    # Positive: ACC_0 sends to 5 distinct receivers in 20 min
    txns_pos = pd.DataFrame([
        {"transaction_id": f"TP_{i}", "sender_account": "ACC_0", "receiver_account": f"ACC_{i}",
         "amount": 2000.0, "timestamp": f"2026-01-01T10:{i*4:02d}:00", "transaction_status": "Success", "channel": "UPI"}
        for i in range(1, 6)
    ])
    g_pos = build_graph(accounts, txns_pos)
    hits_pos = detect_fan_out_split(g_pos, {"detectors": {"fan_out_split": {"min_recipients": 4, "min_amount": 5000.0}}})
    assert len(hits_pos) >= 1
    assert hits_pos[0].account_id == "ACC_0"
    assert hits_pos[0].code == "fan_out_split"

    # Negative: ACC_0 sends to only 2 receivers
    txns_neg = pd.DataFrame([
        {"transaction_id": f"TN_{i}", "sender_account": "ACC_0", "receiver_account": f"ACC_{i%2 + 1}",
         "amount": 2000.0, "timestamp": f"2026-01-01T10:{i*4:02d}:00", "transaction_status": "Success", "channel": "UPI"}
        for i in range(5)
    ])
    g_neg = build_graph(accounts, txns_neg)
    hits_neg = detect_fan_out_split(g_neg, {"detectors": {"fan_out_split": {"min_recipients": 4}}})
    assert len(hits_neg) == 0


def test_detector_rapid_pass_through_positive_and_negative():
    """Verify Rapid pass-through identifies immediate forwarding of similar amounts."""
    accounts = pd.DataFrame({"account_id": ["SRC", "MULE", "DST"]})

    # Positive: receives 10,000 and forwards 9,500 (95%) in 8 minutes
    txns_pos = pd.DataFrame([
        {"transaction_id": "T1", "sender_account": "SRC", "receiver_account": "MULE",
         "amount": 10000.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T2", "sender_account": "MULE", "receiver_account": "DST",
         "amount": 9500.0, "timestamp": "2026-01-01T10:08:00", "transaction_status": "Success", "channel": "UPI"},
    ])
    g_pos = build_graph(accounts, txns_pos)
    hits_pos = detect_rapid_pass_through(g_pos, {"detectors": {"rapid_pass_through": {"max_delay_minutes": 30, "min_forward_ratio": 0.80}}})
    assert len(hits_pos) == 1
    assert hits_pos[0].account_id == "MULE"
    assert hits_pos[0].code == "rapid_pass_through"

    # Negative: forwards only 30% (3,000 of 10,000)
    txns_neg = pd.DataFrame([
        {"transaction_id": "T1", "sender_account": "SRC", "receiver_account": "MULE",
         "amount": 10000.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T2", "sender_account": "MULE", "receiver_account": "DST",
         "amount": 3000.0, "timestamp": "2026-01-01T10:08:00", "transaction_status": "Success", "channel": "UPI"},
    ])
    g_neg = build_graph(accounts, txns_neg)
    hits_neg = detect_rapid_pass_through(g_neg, {"detectors": {"rapid_pass_through": {"min_forward_ratio": 0.80}}})
    assert len(hits_neg) == 0


def test_detector_layering_chain():
    """Verify Layering chain detects A -> B -> C -> D flow with similar amounts."""
    accounts = pd.DataFrame({"account_id": ["A", "B", "C", "D"]})
    txns = pd.DataFrame([
        {"transaction_id": "T1", "sender_account": "A", "receiver_account": "B",
         "amount": 5000.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T2", "sender_account": "B", "receiver_account": "C",
         "amount": 4800.0, "timestamp": "2026-01-01T10:15:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T3", "sender_account": "C", "receiver_account": "D",
         "amount": 4700.0, "timestamp": "2026-01-01T10:30:00", "transaction_status": "Success", "channel": "UPI"},
    ])
    graph = build_graph(accounts, txns)
    hits = detect_layering_chain(graph, {"detectors": {"layering_chain": {"min_hops": 3, "amount_tolerance": 0.20}}})
    assert len(hits) >= 1
    hit_accs = {h.account_id for h in hits}
    assert "B" in hit_accs or "C" in hit_accs


def test_detector_circular_flow():
    """Verify Circular flow detects directed cycles of 3-5 nodes."""
    accounts = pd.DataFrame({"account_id": ["A", "B", "C"]})
    txns = pd.DataFrame([
        {"transaction_id": "T1", "sender_account": "A", "receiver_account": "B",
         "amount": 1000.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T2", "sender_account": "B", "receiver_account": "C",
         "amount": 980.0, "timestamp": "2026-01-01T10:10:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T3", "sender_account": "C", "receiver_account": "A",
         "amount": 970.0, "timestamp": "2026-01-01T10:20:00", "transaction_status": "Success", "channel": "UPI"},
    ])
    graph = build_graph(accounts, txns)
    hits = detect_circular_flow(graph, {"detectors": {"circular_flow": {"min_cycle_length": 3, "max_cycle_duration_hours": 24}}})
    assert len(hits) == 3
    assert {h.account_id for h in hits} == {"A", "B", "C"}


def test_detector_dormant_activation():
    """Verify Dormant activation detects sudden activity after long dormancy."""
    accounts = pd.DataFrame([
        {"account_id": "DORMANT_ACC", "account_open_date": "2025-01-01"},
    ])
    txns = pd.DataFrame([
        {"transaction_id": "T1", "sender_account": "DORMANT_ACC", "receiver_account": "RECV",
         "amount": 5000.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T2", "sender_account": "DORMANT_ACC", "receiver_account": "RECV",
         "amount": 6000.0, "timestamp": "2026-01-01T10:05:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T3", "sender_account": "DORMANT_ACC", "receiver_account": "RECV",
         "amount": 7000.0, "timestamp": "2026-01-01T10:10:00", "transaction_status": "Success", "channel": "UPI"},
    ])
    recv_acc = pd.DataFrame({"account_id": ["RECV"]})
    graph = build_graph(pd.concat([accounts, recv_acc]), txns)

    hits = detect_dormant_activation(graph, {"detectors": {"dormant_active": {"dormant_days_threshold": 30, "min_recent_txns": 3}}})
    assert len(hits) >= 1
    assert hits[0].account_id == "DORMANT_ACC"


def test_rule_scores_normalization_and_saturation():
    """Verify rule scores are between 0 and 1 with diminishing returns on duplicate hits."""
    hits = [
        Hit("ACC_1", "fan_in_burst", datetime.now(), datetime.now(), "high"),
        Hit("ACC_1", "fan_in_burst", datetime.now(), datetime.now(), "high"),
        Hit("ACC_1", "circular_flow", datetime.now(), datetime.now(), "critical"),
        Hit("ACC_2", "fan_out_split", datetime.now(), datetime.now(), "low"),
    ]
    scores = rule_scores(hits)
    assert 0.0 <= scores["ACC_1"] <= 1.0
    assert 0.0 <= scores["ACC_2"] <= 1.0
    assert scores["ACC_1"] > scores["ACC_2"]


def test_missing_values_and_nans():
    """Verify accounts with NaN attributes and transactions with missing optional fields are safely handled."""
    accounts = pd.DataFrame([
        {"account_id": "ACC_NAN1", "city": None, "occupation": float("nan")},
        {"account_id": "ACC_NAN2", "kyc_status": None, "branch_id": float("nan")},
    ])
    txns = pd.DataFrame([
        {"transaction_id": "T_NAN1", "sender_account": "ACC_NAN1", "receiver_account": "ACC_NAN2",
         "amount": 500.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": None},
    ])
    graph = build_graph(accounts, txns)
    assert graph.number_of_nodes() == 2
    assert graph.number_of_edges() == 1
    assert pd.isna(graph.nodes["ACC_NAN1"]["city"])


def test_accounts_with_no_transactions():
    """Verify isolated accounts with no transactions remain nodes with degree 0."""
    accounts = pd.DataFrame([
        {"account_id": "ACTIVE_1"},
        {"account_id": "ACTIVE_2"},
        {"account_id": "IDLE_1"},
        {"account_id": "IDLE_2"},
    ])
    txns = pd.DataFrame([
        {"transaction_id": "T1", "sender_account": "ACTIVE_1", "receiver_account": "ACTIVE_2",
         "amount": 250.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"},
    ])
    graph = build_graph(accounts, txns)
    assert graph.number_of_nodes() == 4
    assert graph.degree("IDLE_1") == 0
    assert graph.degree("IDLE_2") == 0
    assert graph.degree("ACTIVE_1") == 1


def test_hard_negatives_regular_merchant_flow():
    """Verify legitimate recurring customer activity does not trigger false mule rings."""
    # Merchant receiving routine payments from same regular customer over days
    accounts = pd.DataFrame([{"account_id": "MERCHANT"}, {"account_id": "CUSTOMER"}])
    txns = pd.DataFrame([
        {"transaction_id": f"T_M_{i}", "sender_account": "CUSTOMER", "receiver_account": "MERCHANT",
         "amount": 150.0, "timestamp": f"2026-01-0{i+1}T09:00:00", "transaction_status": "Success", "channel": "UPI"}
        for i in range(5)
    ])
    graph = build_graph(accounts, txns)
    hits = run_detectors(graph)
    # Routine single-sender transactions should not trigger fan-in burst or circular flow
    assert len([h for h in hits if h.code in ["fan_in_burst", "circular_flow", "rapid_pass_through"]]) == 0


def test_dormant_activation_strict_calendar_continuity():
    """REGRESSION TEST: Verify that missing calendar dates in daily summary are NOT
    treated as confirmed zero-transaction days.
    """
    import pandas as pd
    from module_6_graph_builder_detectors import build_graph, run_detectors

    # Account 1: Strictly continuous 31 calendar days with total_transactions == 0, then spike
    acc1_dates = [f"2026-01-{d:02d}" for d in range(1, 32)]
    acc1_rows = [{"account_id": "ACC_CONT", "date": d, "total_transactions": 0, "total_incoming": 0, "total_outgoing": 0} for d in acc1_dates]
    acc1_rows.append({"account_id": "ACC_CONT", "date": "2026-02-01", "total_transactions": 5, "total_incoming": 50000, "total_outgoing": 49000})

    # Account 2: 31 records with total_transactions == 0, but dates have massive gaps (e.g. 1st of each month across 3 years)
    # Missing calendar dates must break streak and NOT qualify as confirmed continuous dormancy!
    acc2_rows = [{"account_id": "ACC_GAPS", "date": f"202{year}-{(m%12)+1:02d}-01", "total_transactions": 0, "total_incoming": 0, "total_outgoing": 0} for year in [3, 4, 5] for m in range(11)]
    acc2_rows.append({"account_id": "ACC_GAPS", "date": "2026-02-01", "total_transactions": 5, "total_incoming": 50000, "total_outgoing": 49000})

    daily_df = pd.DataFrame(acc1_rows + acc2_rows)

    accounts_df = pd.DataFrame([{"account_id": "ACC_CONT"}, {"account_id": "ACC_GAPS"}])
    txns_df = pd.DataFrame([
        {"transaction_id": "T1", "sender_account": "ACC_CONT", "receiver_account": "ACC_GAPS", "amount": 1000.0, "timestamp": "2026-02-01T10:00:00", "transaction_status": "Success", "channel": "UPI"}
    ])

    graph = build_graph(accounts_df, txns_df)
    hits = run_detectors(graph, daily_summary_df=daily_df)

    dormant_hits = [h for h in hits if h.code == "dormant_active"]
    hit_accs = {h.account_id: h for h in dormant_hits}

    # ACC_CONT must be detected as confirmed dormancy
    assert "ACC_CONT" in hit_accs
    assert hit_accs["ACC_CONT"].evidence.get("is_confirmed") is True
    assert hit_accs["ACC_CONT"].evidence.get("dormancy_type") == "confirmed_dormancy"

    # ACC_GAPS must NOT be confirmed dormancy because calendar dates were missing!
    if "ACC_GAPS" in hit_accs:
        assert hit_accs["ACC_GAPS"].evidence.get("is_confirmed") is False


def test_dormant_activation_coexistence_multi_account():
    """Verify that confirmed dormancy and unconfirmed inactivity gaps are both collected across multiple accounts."""
    # Account 1: Confirmed dormancy via 35 continuous consecutive zero-txn calendar days
    acc1_rows = [
        {"account_id": "ACC_CONFIRMED", "date": (datetime(2026, 1, 1) + timedelta(days=i)).strftime("%Y-%m-%d"), "total_transactions": 0, "total_incoming": 0, "total_outgoing": 0}
        for i in range(35)
    ]
    spike_date_str = (datetime(2026, 1, 1) + timedelta(days=35)).strftime("%Y-%m-%d")  # Exactly consecutive next day
    acc1_rows.append({"account_id": "ACC_CONFIRMED", "date": spike_date_str, "total_transactions": 4, "total_incoming": 50000, "total_outgoing": 0})

    daily_df = pd.DataFrame(acc1_rows)

    # Accounts:
    # - ACC_CONFIRMED: has daily summaries with confirmed continuous dormancy
    # - ACC_UNCONFIRMED: has NO daily summaries, but has a 45-day gap in transaction graph
    # - ACC_REGULAR: active account with regular daily transactions
    accounts_df = pd.DataFrame([
        {"account_id": "ACC_CONFIRMED"},
        {"account_id": "ACC_UNCONFIRMED"},
        {"account_id": "ACC_REGULAR"},
        {"account_id": "DEST_NODE"},
    ])

    txns = [
        # ACC_CONFIRMED transactions on spike date
        {"transaction_id": f"T_C_{i}", "sender_account": "ACC_CONFIRMED", "receiver_account": "DEST_NODE", "amount": 12500.0, "timestamp": f"{spike_date_str}T10:{i*5:02d}:00", "transaction_status": "Success", "channel": "UPI"}
        for i in range(4)
    ] + [
        # ACC_UNCONFIRMED: transaction on Jan 01, then 45-day gap, then 3 transactions on Feb 15
        {"transaction_id": "T_U_0", "sender_account": "ACC_UNCONFIRMED", "receiver_account": "DEST_NODE", "amount": 2000.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T_U_1", "sender_account": "ACC_UNCONFIRMED", "receiver_account": "DEST_NODE", "amount": 8000.0, "timestamp": "2026-02-15T10:00:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T_U_2", "sender_account": "ACC_UNCONFIRMED", "receiver_account": "DEST_NODE", "amount": 9000.0, "timestamp": "2026-02-15T10:15:00", "transaction_status": "Success", "channel": "UPI"},
        {"transaction_id": "T_U_3", "sender_account": "ACC_UNCONFIRMED", "receiver_account": "DEST_NODE", "amount": 9500.0, "timestamp": "2026-02-15T10:30:00", "transaction_status": "Success", "channel": "UPI"},
    ] + [
        # ACC_REGULAR: transactions spaced 2 days apart (no gap >= 30 days)
        {"transaction_id": f"T_R_{i}", "sender_account": "ACC_REGULAR", "receiver_account": "DEST_NODE", "amount": 100.0, "timestamp": f"2026-01-{i*2+1:02d}T10:00:00", "transaction_status": "Success", "channel": "UPI"}
        for i in range(5)
    ]

    graph = build_graph(accounts_df, pd.DataFrame(txns))
    hits = run_detectors(graph, daily_summary_df=daily_df)

    dormant_hits = [h for h in hits if h.code == "dormant_active"]
    hit_map = {h.account_id: h for h in dormant_hits}

    # 1. Both eligible accounts must be detected
    assert "ACC_CONFIRMED" in hit_map, "Confirmed dormancy account must be detected"
    assert "ACC_UNCONFIRMED" in hit_map, "Unconfirmed inactivity gap account must ALSO be detected"

    # 2. Confirmed vs unconfirmed evidence must be clearly distinguished
    assert hit_map["ACC_CONFIRMED"].evidence["is_confirmed"] is True
    assert hit_map["ACC_CONFIRMED"].evidence["dormancy_type"] == "confirmed_dormancy"

    assert hit_map["ACC_UNCONFIRMED"].evidence["is_confirmed"] is False
    assert hit_map["ACC_UNCONFIRMED"].evidence["dormancy_type"] == "observed_inactivity_gap"

    # 3. Regular active account must NOT trigger dormant activation
    assert "ACC_REGULAR" not in hit_map

    # 4. No duplicate hits for the same account
    hit_acc_ids = [h.account_id for h in dormant_hits]
    assert len(hit_acc_ids) == len(set(hit_acc_ids)), "Duplicate hits must be avoided"
