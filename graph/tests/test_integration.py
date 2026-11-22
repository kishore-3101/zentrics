import pytest
from datetime import datetime, timedelta
import pandas as pd
import networkx as nx

from graph.construction.graph_builder import GraphBuilder
from graph.detection.detector_engine import DetectorEngine
from graph.ring_analysis.ring_extraction import RingExtractor
from graph.visualization.graph_serializer import GraphSerializer
from graph.evaluation.detector_evaluation import evaluate_detector_performance
from graph.evaluation.ring_evaluation import evaluate_ring_performance


def test_end_to_end_graph_pipeline():
    # 1. Synthesize accounts and transactions
    accounts_data = [
        {"account_id": "ACC_V1", "account_type": "savings", "kyc_status": "full", "initial_balance": 100000.0, "is_mule": 0},
        {"account_id": "ACC_M1", "account_type": "savings", "kyc_status": "minimal", "initial_balance": 500.0, "is_mule": 1},
        {"account_id": "ACC_M2", "account_type": "savings", "kyc_status": "minimal", "initial_balance": 500.0, "is_mule": 1},
        {"account_id": "ACC_M3", "account_type": "savings", "kyc_status": "minimal", "initial_balance": 500.0, "is_mule": 1},
        {"account_id": "ACC_SINK", "account_type": "atm", "kyc_status": "minimal", "initial_balance": 0.0, "is_mule": 0},
    ]
    accounts_df = pd.DataFrame(accounts_data)

    base_ts = datetime(2026, 3, 10, 10, 0, 0)
    txns_data = [
        # Victim transfers to M1
        {"transaction_id": "T0", "src_account": "ACC_V1", "dst_account": "ACC_M1", "amount": 100000.0, "ts": base_ts.isoformat(), "transaction_status": "SUCCESS"},
        # Cycle M1 -> M2 -> M3 -> M1
        {"transaction_id": "T1", "src_account": "ACC_M1", "dst_account": "ACC_M2", "amount": 95000.0, "ts": (base_ts + timedelta(minutes=5)).isoformat(), "transaction_status": "SUCCESS"},
        {"transaction_id": "T2", "src_account": "ACC_M2", "dst_account": "ACC_M3", "amount": 92000.0, "ts": (base_ts + timedelta(minutes=10)).isoformat(), "transaction_status": "SUCCESS"},
        {"transaction_id": "T3", "src_account": "ACC_M3", "dst_account": "ACC_M1", "amount": 90000.0, "ts": (base_ts + timedelta(minutes=15)).isoformat(), "transaction_status": "SUCCESS"},
        # Partial cash out to sink
        {"transaction_id": "T4", "src_account": "ACC_M1", "dst_account": "ACC_SINK", "amount": 30000.0, "ts": (base_ts + timedelta(minutes=20)).isoformat(), "transaction_status": "SUCCESS"},
    ]
    txns_df = pd.DataFrame(txns_data)

    # 2. Build graph
    builder = GraphBuilder()
    G = builder.build_from_dataframes(txns_df, accounts_df)

    assert G.number_of_nodes() == 5
    assert G.number_of_edges() == 5

    # 3. Run detectors
    engine = DetectorEngine()
    hits = engine.run_all(G)
    assert len(hits) >= 1

    # 4. Compute rule scores
    rule_scores = engine.compute_account_rule_scores(hits)
    susp_accounts = {acct for acct, sc in rule_scores.items() if sc >= 0.3}
    assert "ACC_M1" in susp_accounts

    # 5. Extract Rings
    extractor = RingExtractor()
    account_risks = {acct: sc * 100.0 for acct, sc in rule_scores.items()}
    rings = extractor.extract_rings(
        G=G,
        suspicious_accounts=susp_accounts,
        hits=hits,
        account_risks=account_risks,
        sink_accounts={"ACC_SINK"}
    )

    assert len(rings) >= 1
    ring = rings[0]
    assert ring.amount_moved >= 90000.0
    assert ring.amount_cashed == 30000.0
    assert ring.amount_at_risk == ring.amount_moved - ring.amount_cashed

    # 6. Serialize for API
    serialized = GraphSerializer.serialize_ring(ring)
    assert "nodes" in serialized
    assert "edges" in serialized
    assert serialized["score"] > 0
    assert len(serialized["nodes"]) >= 3

    # 7. Evaluate
    det_eval = evaluate_detector_performance(hits, accounts_df)
    assert det_eval["precision"] > 0
