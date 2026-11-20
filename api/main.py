"""
main.py – FastAPI application for Mule Account Ring Detection.
Loads the trained model on startup and exposes prediction/ring endpoints.
"""
from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Allow running from project root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api.schemas import (
    AccountFeatures, PredictionResponse, BatchPredictionRequest,
    BatchPredictionResponse, ModelInfo, HealthResponse,
    AlertItem, RingSummary, MetricsResponse,
)
from src.config import (
    MODEL_PKL, FEATURE_COLS_JSON, MODEL_META_JSON,
    OUTPUTS_DIR, RISK_THRESHOLDS,
)
from src.inference import predict_proba, get_model_info

logger = logging.getLogger("mule_api")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Mule Account Ring Detection API",
    description="Detects suspicious mule accounts and fraudulent transaction rings.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Startup: load artefacts
# ---------------------------------------------------------------------------

_model_loaded   = False
_feat_cols: list = []
_model_meta: dict = {}
_risk_df: Optional[pd.DataFrame] = None
_rings_df: Optional[pd.DataFrame] = None


def load_app_artifacts():
    global _model_loaded, _feat_cols, _model_meta, _risk_df, _rings_df
    try:
        _model_meta  = get_model_info()
        with open(FEATURE_COLS_JSON) as f:
            _feat_cols = json.load(f)
        _model_loaded = True
        logger.info("Model loaded successfully. Features: %d", len(_feat_cols))
    except Exception as e:
        logger.warning("Model not loaded: %s. Run train.py first.", e)

    # Load pre-computed outputs if available
    susp_path  = OUTPUTS_DIR / "suspicious_accounts.csv"
    rings_path = OUTPUTS_DIR / "fraud_rings.csv"
    if susp_path.exists():
        _risk_df = pd.read_csv(susp_path)
    if rings_path.exists():
        _rings_df = pd.read_csv(rings_path)


# Load artifacts immediately on module import
load_app_artifacts()


@app.on_event("startup")
def startup_event():
    load_app_artifacts()


# ---------------------------------------------------------------------------
# Helper: score from probability
# ---------------------------------------------------------------------------

def _risk_category(score: float) -> str:
    if score >= RISK_THRESHOLDS["high"]:
        return "High Risk"
    elif score >= RISK_THRESHOLDS["medium"]:
        return "Medium Risk"
    return "Low Risk"


def _prob_to_risk_score(prob: float) -> float:
    """Simple mapping: probability → 0–100 risk score."""
    return round(prob * 100, 2)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/", summary="API status")
def root():
    return {
        "service"      : "Mule Account Ring Detection API",
        "version"      : "1.0.0",
        "model_loaded" : _model_loaded,
        "docs"         : "/docs",
    }


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status       ="ok" if _model_loaded else "model_not_loaded",
        model_loaded =_model_loaded,
        model_file   =str(MODEL_PKL),
    )


@app.post("/predict", response_model=PredictionResponse)
def predict_single(features: AccountFeatures):
    if not _model_loaded:
        raise HTTPException(503, "Model not loaded. Run train.py first.")

    data   = features.model_dump(exclude={"account_id"})
    df     = pd.DataFrame([data])
    missing = [c for c in _feat_cols if c not in df.columns]
    for c in missing:
        df[c] = 0.0

    try:
        proba = predict_proba(df)[0]
    except Exception as e:
        raise HTTPException(422, f"Prediction failed: {e}")

    score    = _prob_to_risk_score(proba)
    category = _risk_category(score)

    # Top features from model
    top_feats = []
    try:
        import joblib
        model = joblib.load(MODEL_PKL)
        imp   = getattr(model, "feature_importances_", None)
        if imp is not None:
            imp_series = pd.Series(imp, index=_feat_cols).sort_values(ascending=False)
            top_feats  = imp_series.head(5).index.tolist()
    except Exception:
        pass

    explanation = "Account flagged because of: " + ", ".join(top_feats) if top_feats and proba > 0.5 else ""

    return PredictionResponse(
        account_id        =features.account_id,
        mule_probability  =round(float(proba), 4),
        account_risk_score=score,
        risk_category     =category,
        top_features      =top_feats,
        explanation       =explanation,
    )


@app.post("/predict/batch", response_model=BatchPredictionResponse)
def predict_batch(request: BatchPredictionRequest):
    if not _model_loaded:
        raise HTTPException(503, "Model not loaded.")

    df = pd.DataFrame(request.accounts)
    account_ids = df.pop("account_id") if "account_id" in df.columns else None

    missing = [c for c in _feat_cols if c not in df.columns]
    for c in missing:
        df[c] = 0.0

    try:
        probas = predict_proba(df)
    except Exception as e:
        raise HTTPException(422, f"Batch prediction failed: {e}")

    preds = []
    for i, proba in enumerate(probas):
        score    = _prob_to_risk_score(proba)
        category = _risk_category(score)
        acct_id  = str(account_ids.iloc[i]) if account_ids is not None else None
        preds.append(PredictionResponse(
            account_id        =acct_id,
            mule_probability  =round(float(proba), 4),
            account_risk_score=score,
            risk_category     =category,
        ))

    high_risk = sum(1 for p in preds if p.risk_category == "High Risk")
    return BatchPredictionResponse(
        predictions    =preds,
        total_accounts =len(preds),
        high_risk_count=high_risk,
    )


@app.get("/model/info", response_model=ModelInfo)
def model_info():
    if not _model_loaded:
        raise HTTPException(503, "Model not loaded.")
    meta = _model_meta or {}
    return ModelInfo(
        model_type    =meta.get("model_type", "XGBoostClassifier"),
        training_date =meta.get("training_date"),
        feature_count =len(_feat_cols),
        model_version =meta.get("model_version", "1.0.0"),
        metrics       =meta.get("metrics"),
    )


@app.get("/alerts", response_model=List[AlertItem])
def get_alerts(limit: int = 50):
    if _risk_df is None:
        raise HTTPException(404, "No suspicious accounts data available. Run train.py first.")
    top = _risk_df.head(limit)
    return [
        AlertItem(
            account_id        =str(row["account_id"]),
            account_risk_score=float(row["account_risk_score"]),
            risk_category     =str(row.get("risk_category", "High Risk")),
        )
        for _, row in top.iterrows()
    ]


@app.get("/rings", response_model=List[RingSummary])
def get_rings(limit: int = 20):
    if _rings_df is None or _rings_df.empty:
        raise HTTPException(404, "No rings data available. Run train.py first.")
    top = _rings_df.head(limit)
    rings = []
    for _, row in top.iterrows():
        rings.append(RingSummary(
            ring_id            =str(row["ring_id"]),
            account_count      =int(row.get("account_count", 0)),
            mean_risk_score    =float(row.get("mean_risk_score", 0)),
            max_risk_score     =float(row.get("max_risk_score", 0)),
            total_money_moved  =float(row.get("total_money_moved", 0)),
            amount_at_risk     =float(row.get("amount_at_risk", 0)),
            ring_priority_score=float(row.get("ring_priority_score", 0)),
            patterns           =str(row.get("patterns", "")),
        ))
    return rings


@app.get("/rings/{ring_id}")
def get_ring_detail(ring_id: str):
    if _rings_df is None or _rings_df.empty:
        raise HTTPException(404, "No rings data available.")
    row = _rings_df[_rings_df["ring_id"] == ring_id]
    if row.empty:
        raise HTTPException(404, f"Ring '{ring_id}' not found.")
    return row.iloc[0].to_dict()


@app.get("/metrics", response_model=MetricsResponse)
def get_metrics():
    # Load full risk scores if available
    full_risk_path = OUTPUTS_DIR / "processed" / "account_features.csv"
    susp_path      = OUTPUTS_DIR / "suspicious_accounts.csv"

    high = med = low = total = 0
    model_metrics = None

    if susp_path.exists():
        susp_df = pd.read_csv(susp_path)
        high    = int((susp_df.get("risk_category", pd.Series([])) == "High Risk").sum())

    comp_path = OUTPUTS_DIR / "model_comparison_metrics.csv"
    if comp_path.exists():
        mdf = pd.read_csv(comp_path)
        xgb_row = mdf[mdf["model"] == "XGBoost"]
        if not xgb_row.empty:
            model_metrics = xgb_row.iloc[0].drop("model").to_dict()

    rings_count = len(_rings_df) if _rings_df is not None else 0

    return MetricsResponse(
        total_accounts_scored=total,
        high_risk_accounts   =high,
        medium_risk_accounts =med,
        low_risk_accounts    =low,
        total_rings_detected =rings_count,
        model_metrics        =model_metrics,
    )
