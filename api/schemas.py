"""
schemas.py – Pydantic request/response models for the FastAPI endpoints.
"""
from __future__ import annotations
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class AccountFeatures(BaseModel):
    account_id: Optional[str] = None
    # Accept any numeric features dynamically via model_extra
    model_config = {"extra": "allow"}


class PredictionResponse(BaseModel):
    account_id: Optional[str] = None
    mule_probability: float
    account_risk_score: float
    risk_category: str
    top_features: Optional[List[str]] = None
    explanation: Optional[str] = None


class BatchPredictionRequest(BaseModel):
    accounts: List[Dict[str, Any]]


class BatchPredictionResponse(BaseModel):
    predictions: List[PredictionResponse]
    total_accounts: int
    high_risk_count: int


class ModelInfo(BaseModel):
    model_type: str
    training_date: Optional[str] = None
    feature_count: int
    model_version: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_file: str


class AlertItem(BaseModel):
    account_id: str
    account_risk_score: float
    risk_category: str


class RingSummary(BaseModel):
    ring_id: str
    account_count: int
    mean_risk_score: float
    max_risk_score: float
    total_money_moved: float
    amount_at_risk: float
    ring_priority_score: float
    patterns: Optional[str] = None


class MetricsResponse(BaseModel):
    total_accounts_scored: int
    high_risk_accounts: int
    medium_risk_accounts: int
    low_risk_accounts: int
    total_rings_detected: int
    model_metrics: Optional[Dict[str, float]] = None
