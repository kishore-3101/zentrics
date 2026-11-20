"""
inference.py – Load saved model and run predictions without retraining.
"""
import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd
import joblib

from src.config import MODEL_PKL, FEATURE_COLS_JSON, MODEL_META_JSON

logger = logging.getLogger(__name__)

_model       = None
_feat_cols   = None
_model_meta  = None


def _load_artifacts():
    global _model, _feat_cols, _model_meta
    if _model is None:
        if not MODEL_PKL.exists():
            raise FileNotFoundError(
                f"Model file not found: {MODEL_PKL}\n"
                "Run `python train.py` first to train and save the model."
            )
        _model = joblib.load(MODEL_PKL)
        logger.info("Model loaded from %s", MODEL_PKL)

    if _feat_cols is None:
        if not FEATURE_COLS_JSON.exists():
            raise FileNotFoundError(f"Feature columns file not found: {FEATURE_COLS_JSON}")
        with open(FEATURE_COLS_JSON) as f:
            _feat_cols = json.load(f)
        logger.info("Feature columns loaded: %d features", len(_feat_cols))

    if _model_meta is None and MODEL_META_JSON.exists():
        with open(MODEL_META_JSON) as f:
            _model_meta = json.load(f)


def predict_proba(feature_df: pd.DataFrame) -> np.ndarray:
    """
    Given a DataFrame with the same feature columns as training,
    return an array of P(mule) probabilities.
    """
    _load_artifacts()
    # Align columns
    missing = [c for c in _feat_cols if c not in feature_df.columns]
    if missing:
        logger.warning("Missing %d feature columns (filling with 0): %s", len(missing), missing[:5])
        for c in missing:
            feature_df[c] = 0.0
    X = feature_df[_feat_cols].fillna(0)
    return _model.predict_proba(X)[:, 1]


def predict(feature_df: pd.DataFrame, threshold: float = 0.5) -> np.ndarray:
    """Return binary predictions."""
    proba = predict_proba(feature_df)
    return (proba >= threshold).astype(int)


def get_model_info() -> dict:
    """Return metadata about the saved model."""
    _load_artifacts()
    return _model_meta or {
        "model_type"    : type(_model).__name__,
        "feature_count" : len(_feat_cols or []),
        "model_file"    : str(MODEL_PKL),
    }
