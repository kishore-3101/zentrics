"""
config.py – Central configuration for Mule Account Ring Detection.
All thresholds, paths, and hyper-parameters are defined here so they
can be changed without touching business logic.
"""
import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Project root (resolved relative to this file)
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# Dynamic dataset and directory resolution (project-root relative)
# ---------------------------------------------------------------------------
def _resolve_dataset_dir() -> Path:
    """Dynamically locate the dataset directory relative to project root or environment."""
    env_dir = os.environ.get("MULE_DATASET_DIR") or os.environ.get("DATASET_DIR")
    if env_dir:
        p = Path(env_dir)
        if p.exists() and (p / "accounts.csv").exists():
            return p

    candidates = [
        PROJECT_ROOT / "data" / "raw",
        PROJECT_ROOT / "data",
        PROJECT_ROOT / "mule_account_dataset",
        PROJECT_ROOT.parent / "mule_account_dataset",
        PROJECT_ROOT.parent / "data" / "raw",
    ]
    for c in candidates:
        if c.exists() and (c / "accounts.csv").exists():
            return c

    # Fallback default
    return PROJECT_ROOT / "data" / "raw"

DATASET_DIR = _resolve_dataset_dir()

# Data & output paths (all strictly relative to PROJECT_ROOT)
DATA_RAW_DIR       = PROJECT_ROOT / "data" / "raw"
DATA_PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
DATABASE_DIR       = PROJECT_ROOT / "data" / "database"
OUTPUTS_DIR        = PROJECT_ROOT / "outputs"
PROCESSED_DIR      = OUTPUTS_DIR / "processed"
VIZ_DIR            = OUTPUTS_DIR / "visualizations"
REPORTS_DIR        = OUTPUTS_DIR / "reports"
MODELS_DIR         = PROJECT_ROOT / "models"

# Ensure directories exist
for _dir in [DATA_RAW_DIR, DATA_PROCESSED_DIR, DATABASE_DIR, OUTPUTS_DIR, PROCESSED_DIR, VIZ_DIR, REPORTS_DIR, MODELS_DIR]:
    _dir.mkdir(parents=True, exist_ok=True)

# Database location (SQLite default with environment URL override)
DEFAULT_DB_PATH = DATABASE_DIR / "tracemesh.db"
DATABASE_URL    = os.environ.get("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

# Input files (searches data/raw first, then DATASET_DIR)
def _find_dataset_file(filename: str) -> Path:
    candidates = [
        DATA_RAW_DIR / filename,
        DATASET_DIR / filename,
        PROJECT_ROOT / "data" / filename,
        PROJECT_ROOT / filename,
    ]
    for p in candidates:
        if p.exists():
            return p
    return DATA_RAW_DIR / filename

ACCOUNTS_CSV       = _find_dataset_file("accounts.csv")
TRANSACTIONS_CSV   = _find_dataset_file("transactions.csv")
RING_LABELS_CSV    = _find_dataset_file("ring_labels.csv")
FRAUD_RINGS_CSV    = _find_dataset_file("fraud_rings.csv")
DAILY_SUMMARY_CSV  = _find_dataset_file("account_daily_summary.csv")

ACCOUNTS_SRC       = ACCOUNTS_CSV
TRANSACTIONS_SRC   = TRANSACTIONS_CSV
FRAUD_RINGS_SRC    = FRAUD_RINGS_CSV
DAILY_SUMMARY_SRC  = DAILY_SUMMARY_CSV

# ---------------------------------------------------------------------------
# Output files
# ---------------------------------------------------------------------------
ACCOUNT_FEATURES_CSV        = PROCESSED_DIR / "account_features.csv"
RULE_DETECTION_CSV          = PROCESSED_DIR / "rule_detection_results.csv"
SUSPICIOUS_ACCOUNTS_CSV     = OUTPUTS_DIR / "suspicious_accounts.csv"
FRAUD_RINGS_OUT_CSV         = OUTPUTS_DIR / "fraud_rings.csv"
SHAP_EXPLANATIONS_CSV       = OUTPUTS_DIR / "shap_explanations.csv"
DATA_QUALITY_REPORT         = OUTPUTS_DIR / "data_quality_report.txt"
MODEL_EVALUATION_REPORT     = OUTPUTS_DIR / "model_evaluation_report.txt"

MODEL_PKL           = MODELS_DIR / "mule_detection_xgboost.pkl"
FEATURE_COLS_JSON   = MODELS_DIR / "feature_columns.json"
MODEL_META_JSON     = MODELS_DIR / "model_metadata.json"

# ---------------------------------------------------------------------------
# Column name mappings  (actual → canonical)
# Maps the real dataset columns to internal canonical names used by the pipeline.
# ---------------------------------------------------------------------------
ACCOUNT_COL_MAP = {
    "account_id"       : "account_id",
    "customer_id"      : "customer_id",
    "age"              : "age",
    "account_type"     : "account_type",
    "account_open_date": "open_date",
    "account_age_days" : "account_age_days",
    "kyc_status"       : "kyc_level",
    "occupation"       : "occupation",
    "city"             : "city_cluster",
    "branch_id"        : "branch_id",
    "initial_balance"  : "initial_balance",
    "is_mule"          : "is_mule",
}

TRANSACTION_COL_MAP = {
    "transaction_id"        : "txn_id",
    "sender_account"        : "src_account",
    "receiver_account"      : "dst_account",
    "amount"                : "amount",
    "timestamp"             : "ts",
    "transaction_type"      : "transaction_type",
    "transaction_status"    : "transaction_status",
    "channel"               : "channel",
    "sender_balance_before" : "sender_balance_before",
    "sender_balance_after"  : "sender_balance_after",
    "receiver_balance_before": "receiver_balance_before",
    "receiver_balance_after" : "receiver_balance_after",
    "device_id"             : "device_id",
    "ip_address"            : "ip_address",
    "location"              : "location",
    "is_fraud"              : "is_fraud_related",
    "ring_id"               : "ring_id",
    "fraud_pattern"         : "fraud_pattern",
}

# Ground-truth / metadata columns – NEVER used as model features
LEAKAGE_COLUMNS = {
    "is_mule", "is_fraud_related", "ring_id", "scenario",
    "fraud_pattern", "ring_role", "entry_point", "exit_point",
    "account_id", "customer_id", "txn_id",
}

# ---------------------------------------------------------------------------
# Rule-based detector thresholds (all configurable)
# ---------------------------------------------------------------------------
RULE_CFG = {
    "fan_in": {
        "min_unique_senders": 10,
        "time_window_hours": 1,
        "min_amount": 0,
    },
    "rapid_passthrough": {
        "passthrough_ratio": 0.85,
        "time_window_minutes": 15,
    },
    "fan_out_split": {
        "min_new_beneficiaries": 4,
        "time_window_minutes": 30,
    },
    "layering_chain": {
        "min_hops": 3,
        "amount_similarity_pct": 0.10,   # ±10 %
        "max_delay_minutes": 30,
    },
    "circular_flow": {
        "min_cycle_len": 3,
        "max_cycle_len": 5,
        "time_window_hours": 24,
    },
    "dormant_activation": {
        "inactivity_days": 90,
        "volume_multiplier": 5,          # 5× usual daily volume
    },
}

# ---------------------------------------------------------------------------
# Risk scoring weights (must sum to 1.0)
# ---------------------------------------------------------------------------
RISK_WEIGHTS = {
    "ml_probability": 0.50,
    "rule_score":     0.30,
    "neighbor_risk":  0.20,
}

RISK_THRESHOLDS = {
    "high":   80,
    "medium": 50,
}

# ---------------------------------------------------------------------------
# Ring detection thresholds
# ---------------------------------------------------------------------------
RING_CFG = {
    "risk_threshold":          60,    # minimum risk score for 'suspicious'
    "min_accounts_per_ring":   3,
}

# ---------------------------------------------------------------------------
# Model training
# ---------------------------------------------------------------------------
RANDOM_STATE = 42
TEST_SIZE    = 0.20
VAL_SIZE     = 0.10
CV_FOLDS     = 5

XGB_PARAMS = {
    "n_estimators"     : 400,
    "max_depth"        : 6,
    "learning_rate"    : 0.05,
    "subsample"        : 0.8,
    "colsample_bytree" : 0.8,
    "min_child_weight" : 3,
    "gamma"            : 0.1,
    "reg_alpha"        : 0.1,
    "reg_lambda"       : 1.0,
    "use_label_encoder": False,
    "eval_metric"      : "logloss",
    "random_state"     : RANDOM_STATE,
    "n_jobs"           : -1,
}

# ---------------------------------------------------------------------------
# Ensure all output directories exist
# ---------------------------------------------------------------------------
for _d in [DATA_RAW_DIR, PROCESSED_DIR, VIZ_DIR, REPORTS_DIR, MODELS_DIR, OUTPUTS_DIR]:
    _d.mkdir(parents=True, exist_ok=True)
