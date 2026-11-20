"""
tests/test_model.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import pandas as pd
import pytest


def make_feature_df(n=200, seed=42):
    rng = np.random.default_rng(seed)
    df = pd.DataFrame({
        "account_id"       : [f"A{i}" for i in range(n)],
        "total_incoming"   : rng.uniform(0, 1e5, n),
        "total_outgoing"   : rng.uniform(0, 1e5, n),
        "passthrough_ratio": rng.uniform(0, 1, n),
        "graph_pagerank"   : rng.uniform(0, 1, n),
        "graph_in_degree"  : rng.integers(0, 20, n),
        "night_txn_pct"    : rng.uniform(0, 1, n),
        "txn_burstiness"   : rng.uniform(0, 5, n),
        "is_mule"          : rng.integers(0, 2, n),
    })
    return df


def test_train_xgboost_no_crash():
    from src.train_model import train, select_features
    df = make_feature_df(300)
    # Quick test with small data without overwriting production models
    output = train(df, target_col="is_mule", save_artifacts=False)
    assert "xgb" in output["results"]
    assert 0 <= output["results"]["xgb"]["metrics"]["f1"] <= 1


def test_select_features_removes_leakage():
    from src.train_model import select_features
    df = make_feature_df()
    df["ring_id"] = "RING_001"
    df["is_fraud_related"] = 0
    feat_cols, X = select_features(df)
    assert "ring_id" not in feat_cols
    assert "is_mule" not in feat_cols
    assert "is_fraud_related" not in feat_cols


def test_risk_score_range():
    from src.risk_scoring import compute_risk_scores
    df = make_feature_df(50)
    ml_proba = pd.Series(np.random.uniform(0, 1, 50), index=df.index)
    rules = df[["account_id"]].copy()
    rules["rule_score_raw"] = np.random.uniform(0, 1, 50)
    txn = pd.DataFrame({
        "src_account": df["account_id"].sample(50).values,
        "dst_account": df["account_id"].sample(50).values,
        "amount"     : np.random.uniform(100, 10000, 50),
    })
    scores = compute_risk_scores(df, ml_proba, rules, txn)
    assert (scores["account_risk_score"] >= 0).all()
    assert (scores["account_risk_score"] <= 100).all()
