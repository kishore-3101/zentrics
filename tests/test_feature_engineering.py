"""
tests/test_feature_engineering.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
import numpy as np
import pytest
from src.feature_engineering import _volume_flow_features, _time_features


def make_txns():
    return pd.DataFrame({
        "src_account"       : ["A1", "A1", "A2"],
        "dst_account"       : ["A2", "A3", "A3"],
        "amount"            : [100.0, 200.0, 50.0],
        "ts"                : pd.to_datetime(["2024-01-01 10:00", "2024-01-01 10:05", "2024-01-01 10:30"]),
        "transaction_status": ["Success", "Success", "Success"],
    })


def test_passthrough_ratio_non_negative():
    feat = _volume_flow_features(make_txns())
    assert (feat["passthrough_ratio"] >= 0).all()


def test_net_amount_correctness():
    feat = _volume_flow_features(make_txns())
    a1   = feat[feat["account_id"] == "A1"].iloc[0]
    assert a1["total_outgoing"] == pytest.approx(300.0)
    assert a1["total_incoming"] == pytest.approx(0.0)


def test_time_features_no_crash():
    feat = _time_features(make_txns())
    assert "account_id" in feat.columns
    assert len(feat) >= 2


def test_burstiness_non_negative():
    feat = _time_features(make_txns())
    assert (feat["txn_burstiness"] >= 0).all()
