"""
tests/test_api.py – Unit and integration tests for FastAPI application endpoints.
"""
import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import pytest
import api.main as M
from api.schemas import (
    AccountFeatures, PredictionResponse, BatchPredictionRequest,
    BatchPredictionResponse, ModelInfo, HealthResponse, AlertItem,
    RingSummary, MetricsResponse,
)


def test_api_root():
    data = M.root()
    assert data["service"] == "Mule Account Ring Detection API"
    assert data["model_loaded"] is True
    assert data["version"] == "1.0.0"


def test_api_health():
    res = M.health()
    assert isinstance(res, HealthResponse)
    assert res.status == "ok"
    assert res.model_loaded is True


def test_api_model_info():
    info = M.model_info()
    assert isinstance(info, ModelInfo)
    assert info.model_type == "XGBoostClassifier"
    assert info.feature_count == 63
    assert info.metrics is not None


def test_api_predict_single():
    feat = AccountFeatures(
        account_id="ACC_TEST_001",
        total_incoming=75000.0,
        total_outgoing=74500.0,
        passthrough_ratio=0.993,
        graph_pagerank=0.002,
        graph_in_degree=8,
        rule_detector_count=2,
    )
    pred = M.predict_single(feat)
    assert isinstance(pred, PredictionResponse)
    assert pred.account_id == "ACC_TEST_001"
    assert 0.0 <= pred.mule_probability <= 1.0
    assert 0.0 <= pred.account_risk_score <= 100.0
    assert pred.risk_category in ["Low Risk", "Medium Risk", "High Risk"]


def test_api_predict_batch():
    batch_req = BatchPredictionRequest(
        accounts=[
            {"account_id": "ACC_B1", "total_incoming": 50000.0, "passthrough_ratio": 0.95},
            {"account_id": "ACC_B2", "total_incoming": 200.0, "passthrough_ratio": 0.1},
        ]
    )
    b_res = M.predict_batch(batch_req)
    assert isinstance(b_res, BatchPredictionResponse)
    assert b_res.total_accounts == 2
    assert len(b_res.predictions) == 2
    assert b_res.high_risk_count >= 0


def test_api_alerts():
    alerts = M.get_alerts(limit=5)
    assert isinstance(alerts, list)
    assert len(alerts) <= 5
    if len(alerts) > 0:
        assert isinstance(alerts[0], AlertItem)
        assert alerts[0].account_risk_score >= 0


def test_api_rings():
    rings = M.get_rings(limit=5)
    assert isinstance(rings, list)
    assert len(rings) >= 1
    assert isinstance(rings[0], RingSummary)
    assert rings[0].account_count >= 3

    # Test single ring detail
    first_id = rings[0].ring_id
    detail = M.get_ring_detail(first_id)
    assert isinstance(detail, dict)
    assert detail["ring_id"] == first_id


def test_api_metrics():
    met = M.get_metrics()
    assert isinstance(met, MetricsResponse)
    assert met.high_risk_accounts >= 0
    assert met.total_rings_detected >= 1
