"""
preprocessing.py – Cleans and type-casts the validated DataFrames.
"""
import logging

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder

from src.config import PROCESSED_DIR

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Accounts preprocessing
# ---------------------------------------------------------------------------

def preprocess_accounts(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # Parse open_date
    if "open_date" in df.columns:
        df["open_date"] = pd.to_datetime(df["open_date"], errors="coerce")

    # Ensure account_age_days is numeric
    if "account_age_days" in df.columns:
        df["account_age_days"] = pd.to_numeric(df["account_age_days"], errors="coerce").fillna(0)

    # Ensure initial_balance is numeric
    if "initial_balance" in df.columns:
        df["initial_balance"] = pd.to_numeric(df["initial_balance"], errors="coerce").fillna(0)

    # Encode kyc_level
    if "kyc_level" in df.columns:
        kyc_map = {"Verified": 2, "Pending": 1, "Incomplete": 0}
        df["kyc_level_enc"] = df["kyc_level"].map(kyc_map).fillna(1).astype(int)

    # Encode account_type
    if "account_type" in df.columns:
        df["account_type_enc"] = LabelEncoder().fit_transform(df["account_type"].fillna("Unknown"))

    # Encode occupation
    if "occupation" in df.columns:
        df["occupation_enc"] = LabelEncoder().fit_transform(df["occupation"].fillna("Unknown"))

    # Encode city_cluster
    if "city_cluster" in df.columns:
        df["city_enc"] = LabelEncoder().fit_transform(df["city_cluster"].fillna("Unknown"))

    logger.info("Accounts preprocessed: %d rows", len(df))
    return df


# ---------------------------------------------------------------------------
# Transactions preprocessing
# ---------------------------------------------------------------------------

def preprocess_transactions(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # Parse timestamps
    if "ts" in df.columns:
        df["ts"] = pd.to_datetime(df["ts"], errors="coerce")
        invalid_ts = df["ts"].isnull().sum()
        if invalid_ts > 0:
            logger.warning("Dropping %d rows with invalid timestamps", invalid_ts)
            df = df.dropna(subset=["ts"])

    # Ensure amount is numeric; flag invalid
    if "amount" in df.columns:
        df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
        df["amount_invalid_flag"] = df["amount"].isnull().astype(int)
        df["amount"] = df["amount"].fillna(0)

    # Sort by time
    if "ts" in df.columns:
        df = df.sort_values("ts").reset_index(drop=True)

    # Time-derived columns
    if "ts" in df.columns:
        df["hour"]       = df["ts"].dt.hour
        df["day_of_week"]= df["ts"].dt.dayofweek
        df["is_night"]   = ((df["hour"] >= 22) | (df["hour"] < 6)).astype(int)

    # Encode channel
    if "channel" in df.columns:
        df["channel_enc"] = LabelEncoder().fit_transform(df["channel"].fillna("Unknown"))

    # Encode transaction_type
    if "transaction_type" in df.columns:
        df["txn_type_enc"] = LabelEncoder().fit_transform(df["transaction_type"].fillna("Unknown"))

    # Keep only Success + Pending transactions for feature engineering
    # (failed transactions are retained but flagged)
    if "transaction_status" in df.columns:
        df["is_failed"] = (df["transaction_status"] == "Failed").astype(int)

    logger.info("Transactions preprocessed: %d rows", len(df))
    return df


# ---------------------------------------------------------------------------
# Save processed data
# ---------------------------------------------------------------------------

def save_processed(accounts: pd.DataFrame, transactions: pd.DataFrame) -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    accounts.to_csv(PROCESSED_DIR / "accounts_processed.csv", index=False)
    transactions.to_csv(PROCESSED_DIR / "transactions_processed.csv", index=False)
    logger.info("Processed datasets saved to %s", PROCESSED_DIR)
