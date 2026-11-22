"""
train_model.py – Supervised ML training for mule account detection.
Models: Logistic Regression, Random Forest, XGBoost (primary).
Leakage-safe ring-aware train/test split.
"""
import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, average_precision_score,
    confusion_matrix,
)
from xgboost import XGBClassifier

from src.config import (
    MODEL_PKL, FEATURE_COLS_JSON, MODEL_META_JSON, MODELS_DIR,
    LEAKAGE_COLUMNS, RANDOM_STATE, TEST_SIZE, VAL_SIZE,
    XGB_PARAMS, CV_FOLDS,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Feature selection (remove leakage columns)
# ---------------------------------------------------------------------------

def select_features(df: pd.DataFrame) -> tuple[list[str], pd.DataFrame]:
    """Return feature column names and the filtered feature DataFrame."""
    exclude = LEAKAGE_COLUMNS | {
        # Additional safe exclusions
        "open_date", "account_open_date",
        # String identifiers
        "branch_id", "customer_id",
        # Explanation strings
        *[c for c in df.columns if c.endswith("_explanation")],
        # Non-numeric / meta
        "account_type", "kyc_level", "occupation", "city_cluster",
        "transaction_status", "transaction_type", "channel",
        "device_id", "ip_address", "location", "ts",
        # Daily-summary date
        "date",
        # Rule metadata (keep flags and scores)
        *[c for c in df.columns if c in {"ring_id", "fraud_pattern",
                                          "ring_role", "entry_point", "exit_point"}],
    }
    # Keep ring-independent flags and scores but NOT leakage
    feat_cols = [
        c for c in df.columns
        if c not in exclude
        and df[c].dtype in [np.float64, np.int64, np.float32, np.int32,
                             np.uint8, np.uint16, np.uint32, np.uint64]
    ]
    logger.info("Selected %d feature columns.", len(feat_cols))
    return feat_cols, df[feat_cols]


# ---------------------------------------------------------------------------
# Ring-aware train/test split
# ---------------------------------------------------------------------------

def ring_aware_split(df: pd.DataFrame, target: str = "is_mule",
                     ring_col: str = "ring_id"):
    """
    Split accounts so that no fraud ring spans both train and test.
    Ring-labelled suspicious accounts go to test/train by ring assignment.
    Accounts without ring labels are split randomly.
    """
    ring_col_present = ring_col in df.columns and df[ring_col].notna().any()

    if ring_col_present:
        rng = np.random.default_rng(RANDOM_STATE)
        rings = df[df[ring_col].notna()][ring_col].unique()
        rng.shuffle(rings)
        n_test = max(1, int(len(rings) * TEST_SIZE))
        test_rings  = set(rings[:n_test])
        train_rings = set(rings[n_test:])

        test_mask  = df[ring_col].isin(test_rings)
        train_mask = df[ring_col].isin(train_rings)
        no_ring    = df[ring_col].isna()

        # Random-split the unlabelled accounts
        no_ring_idx = df[no_ring].index.tolist()
        rng.shuffle(no_ring_idx)
        n_no_ring_test = max(1, int(len(no_ring_idx) * TEST_SIZE))
        test_no_ring_idx  = set(no_ring_idx[:n_no_ring_test])
        train_no_ring_idx = set(no_ring_idx[n_no_ring_test:])

        test_idx  = list(df[test_mask].index)  + [i for i in no_ring_idx if i in test_no_ring_idx]
        train_idx = list(df[train_mask].index) + [i for i in no_ring_idx if i in train_no_ring_idx]

        logger.info("Ring-aware split: %d train rings, %d test rings.",
                    len(train_rings), len(test_rings))
    else:
        # Fallback: stratified random split
        logger.warning("No ring_id available – using stratified random split (limitation: potential ring leakage).")
        from sklearn.model_selection import train_test_split
        train_idx, test_idx = train_test_split(
            df.index.tolist(),
            test_size=TEST_SIZE,
            stratify=df[target],
            random_state=RANDOM_STATE,
        )

    train_df = df.loc[train_idx]
    test_df  = df.loc[test_idx]
    logger.info("Train: %d  Test: %d", len(train_df), len(test_df))
    return train_df, test_df


# ---------------------------------------------------------------------------
# Metric helpers
# ---------------------------------------------------------------------------

def _compute_metrics(y_true, y_pred, y_proba, label: str) -> dict:
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel() if cm.shape == (2, 2) else (0, 0, 0, 0)
    fpr = fp / max(fp + tn, 1)
    fnr = fn / max(fn + tp, 1)
    return {
        "model"         : label,
        "accuracy"      : accuracy_score(y_true, y_pred),
        "precision"     : precision_score(y_true, y_pred, zero_division=0),
        "recall"        : recall_score(y_true, y_pred, zero_division=0),
        "f1"            : f1_score(y_true, y_pred, zero_division=0),
        "roc_auc"       : roc_auc_score(y_true, y_proba) if len(np.unique(y_true)) > 1 else np.nan,
        "pr_auc"        : average_precision_score(y_true, y_proba) if len(np.unique(y_true)) > 1 else np.nan,
        "fpr"           : fpr,
        "fnr"           : fnr,
        "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp),
    }


# ---------------------------------------------------------------------------
# Main training function
# ---------------------------------------------------------------------------

def train(feature_df: pd.DataFrame, target_col: str = "is_mule", save_artifacts: bool = True) -> dict:
    """
    Train LR, RF, and XGBoost models.
    Returns dict with trained models, metrics, and feature list.
    """
    if target_col not in feature_df.columns:
        raise ValueError(f"Target column '{target_col}' not found in feature_df.")

    df = feature_df.dropna(subset=[target_col]).copy()
    df[target_col] = df[target_col].astype(int)

    logger.info("Target distribution:\n%s", df[target_col].value_counts().to_string())

    feat_cols, X_all = select_features(df)
    y_all = df[target_col]

    if len(feat_cols) == 0:
        raise ValueError("No valid feature columns found after leakage removal.")

    # Ring-aware split
    split_df       = df.copy()
    train_df, test_df = ring_aware_split(split_df, target=target_col)

    X_train = X_all.loc[train_df.index]
    y_train = y_all.loc[train_df.index]
    X_test  = X_all.loc[test_df.index]
    y_test  = y_all.loc[test_df.index]

    # Class imbalance weight (from training data only)
    n_neg = (y_train == 0).sum()
    n_pos = (y_train == 1).sum()
    scale_pos = n_neg / max(n_pos, 1)
    logger.info("scale_pos_weight=%.3f  (neg=%d, pos=%d)", scale_pos, n_neg, n_pos)

    results  = {}
    all_metrics = []

    # -------------------------------------------------------------------
    # 1. Logistic Regression
    # -------------------------------------------------------------------
    logger.info("Training Logistic Regression…")
    lr_pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(
            class_weight="balanced", max_iter=1000,
            random_state=RANDOM_STATE, solver="lbfgs", C=0.1
        )),
    ])
    lr_pipe.fit(X_train, y_train)
    lr_pred  = lr_pipe.predict(X_test)
    lr_proba = lr_pipe.predict_proba(X_test)[:, 1]
    m = _compute_metrics(y_test, lr_pred, lr_proba, "LogisticRegression")
    all_metrics.append(m)
    results["lr"] = {"model": lr_pipe, "metrics": m}
    logger.info("LR  F1=%.3f  ROC-AUC=%.3f  PR-AUC=%.3f", m["f1"], m["roc_auc"], m["pr_auc"])

    # -------------------------------------------------------------------
    # 2. Random Forest
    # -------------------------------------------------------------------
    logger.info("Training Random Forest…")
    rf = RandomForestClassifier(
        n_estimators=200, max_depth=10, class_weight="balanced",
        random_state=RANDOM_STATE, n_jobs=-1
    )
    rf.fit(X_train, y_train)
    rf_pred  = rf.predict(X_test)
    rf_proba = rf.predict_proba(X_test)[:, 1]
    m = _compute_metrics(y_test, rf_pred, rf_proba, "RandomForest")
    all_metrics.append(m)
    results["rf"] = {"model": rf, "metrics": m}
    logger.info("RF  F1=%.3f  ROC-AUC=%.3f  PR-AUC=%.3f", m["f1"], m["roc_auc"], m["pr_auc"])

    # -------------------------------------------------------------------
    # 3. XGBoost without Graph Features (Baseline B)
    # -------------------------------------------------------------------
    no_graph_cols = [c for c in feat_cols if not c.startswith("graph_")]
    logger.info("Training XGBoost without graph features (%d features)…", len(no_graph_cols))
    xgb_params = dict(XGB_PARAMS)
    xgb_params["scale_pos_weight"] = scale_pos
    xgb_params.pop("use_label_encoder", None)

    xgb_ng = XGBClassifier(**xgb_params)
    xgb_ng.fit(
        X_train[no_graph_cols], y_train,
        eval_set=[(X_test[no_graph_cols], y_test)],
        verbose=False,
    )
    xgb_ng_pred  = xgb_ng.predict(X_test[no_graph_cols])
    xgb_ng_proba = xgb_ng.predict_proba(X_test[no_graph_cols])[:, 1]
    m_ng = _compute_metrics(y_test, xgb_ng_pred, xgb_ng_proba, "XGBoost_NoGraph")
    all_metrics.append(m_ng)
    results["xgb_no_graph"] = {"model": xgb_ng, "metrics": m_ng, "proba": xgb_ng_proba, "pred": xgb_ng_pred}
    logger.info("XGB NoGraph F1=%.3f  ROC-AUC=%.3f  PR-AUC=%.3f", m_ng["f1"], m_ng["roc_auc"], m_ng["pr_auc"])

    # -------------------------------------------------------------------
    # 4. XGBoost with Graph Features (Primary - Baseline C)
    # -------------------------------------------------------------------
    logger.info("Training XGBoost with all features (%d features)…", len(feat_cols))
    xgb = XGBClassifier(**xgb_params)
    xgb.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )
    xgb_pred  = xgb.predict(X_test)
    xgb_proba = xgb.predict_proba(X_test)[:, 1]
    m = _compute_metrics(y_test, xgb_pred, xgb_proba, "XGBoost")
    all_metrics.append(m)
    results["xgb"] = {"model": xgb, "metrics": m}
    logger.info("XGB Full    F1=%.3f  ROC-AUC=%.3f  PR-AUC=%.3f", m["f1"], m["roc_auc"], m["pr_auc"])

    # Cross-validation on XGBoost (training data only)
    logger.info("Cross-validating XGBoost on training set (k=%d)…", CV_FOLDS)
    xgb_cv = XGBClassifier(**xgb_params)
    cv_f1 = cross_val_score(
        xgb_cv, X_train, y_train,
        cv=StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE),
        scoring="f1", n_jobs=-1
    )
    logger.info("XGB CV F1: mean=%.3f  std=%.3f", cv_f1.mean(), cv_f1.std())
    results["xgb"]["cv_f1_mean"] = cv_f1.mean()
    results["xgb"]["cv_f1_std"]  = cv_f1.std()

    # -------------------------------------------------------------------
    # Save primary model
    # -------------------------------------------------------------------
    if save_artifacts:
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump(xgb, MODEL_PKL)
        logger.info("XGBoost model saved → %s", MODEL_PKL)

        with open(FEATURE_COLS_JSON, "w") as f:
            json.dump(feat_cols, f, indent=2)
        logger.info("Feature columns saved → %s", FEATURE_COLS_JSON)

        import datetime
        metadata = {
            "model_type"   : "XGBoostClassifier",
            "training_date": datetime.datetime.now().isoformat(),
            "feature_count": len(feat_cols),
            "model_version": "1.0.0",
            "train_samples": len(X_train),
            "test_samples" : len(X_test),
            "metrics"      : m,
            "cv_f1_mean"   : float(cv_f1.mean()),
            "cv_f1_std"    : float(cv_f1.std()),
        }
        with open(MODEL_META_JSON, "w") as f:
            json.dump(metadata, f, indent=2, default=str)

    return {
        "results"    : results,
        "all_metrics": all_metrics,
        "feat_cols"  : feat_cols,
        "X_test"     : X_test,
        "y_test"     : y_test,
        "xgb_proba"  : xgb_proba,
        "xgb_pred"   : xgb_pred,
        "test_df"    : test_df,
    }
