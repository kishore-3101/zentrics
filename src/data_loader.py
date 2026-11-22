"""
data_loader.py – Robust CSV Data Loader & Database Ingestion Engine.
Loads, normalizes, validates, and ingests the raw CSV datasets into canonical DataFrames
and the TraceMesh relational database. Never overwrites or modifies raw CSV files.
"""
from __future__ import annotations

import logging
import shutil
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import numpy as np
import pandas as pd

from src.config import (
    ACCOUNTS_CSV, TRANSACTIONS_CSV, FRAUD_RINGS_CSV, DAILY_SUMMARY_CSV,
    DATA_RAW_DIR, ACCOUNT_COL_MAP, TRANSACTION_COL_MAP,
)
from src.database import (
    init_database, upsert_accounts, upsert_transactions, upsert_fraud_rings,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_read_csv(path: Path, col_map: Optional[Dict[str, str]] = None) -> pd.DataFrame:
    """
    Safely read a CSV file, sanitize column names, strip whitespace,
    and apply column renaming where fields match.
    """
    if not path.exists():
        raise FileNotFoundError(f"Required dataset file not found: {path}")

    logger.info("Reading dataset from: %s", path)
    df = pd.read_csv(path, low_memory=False)
    initial_rows = len(df)

    # Strip column name whitespace
    df.columns = [str(c).strip() for c in df.columns]

    if col_map:
        rename_dict = {k: v for k, v in col_map.items() if k in df.columns}
        df = df.rename(columns=rename_dict)
        logger.info(
            "Mapped %d columns to canonical schema: %s",
            len(rename_dict),
            list(rename_dict.values())[:8],
        )

    logger.info("Loaded %s  shape=(%d, %d)", path.name, len(df), len(df.columns))
    return df


# ---------------------------------------------------------------------------
# Public Dataset Loaders (Used by Training & Inference Pipelines)
# ---------------------------------------------------------------------------

def load_accounts(raw_path: Optional[Path] = None) -> pd.DataFrame:
    """
    Load accounts dataset with canonical column mapping, type casting,
    and duplicate removal.
    """
    target_path = raw_path or ACCOUNTS_CSV
    df = _safe_read_csv(target_path, ACCOUNT_COL_MAP)

    # Validate essential identifier
    if "account_id" not in df.columns:
        raise ValueError(f"Missing mandatory 'account_id' column in {target_path}")

    # Deduplicate by account_id
    dups = df.duplicated(subset=["account_id"]).sum()
    if dups > 0:
        logger.warning("Found and removed %d duplicate accounts in %s", dups, target_path.name)
        df = df.drop_duplicates(subset=["account_id"], keep="first").reset_index(drop=True)

    # Normalize string IDs
    df["account_id"] = df["account_id"].astype(str).str.strip()

    # Parse open_date
    if "open_date" in df.columns:
        df["open_date"] = pd.to_datetime(df["open_date"], errors="coerce")

    # Clean numeric fields
    if "initial_balance" in df.columns:
        df["initial_balance"] = pd.to_numeric(df["initial_balance"], errors="coerce").fillna(0.0)

    if "account_age_days" in df.columns:
        df["account_age_days"] = pd.to_numeric(df["account_age_days"], errors="coerce").fillna(0)

    # Clean ground-truth target if present
    if "is_mule" in df.columns:
        df["is_mule"] = pd.to_numeric(df["is_mule"], errors="coerce").fillna(0).astype(int)

    logger.info("Accounts loaded & sanitized: %d clean records.", len(df))
    return df


def load_transactions(raw_path: Optional[Path] = None) -> pd.DataFrame:
    """
    Load transactions dataset with canonical column mapping,
    timestamp parsing, amount validation, and duplicate removal.
    """
    target_path = raw_path or TRANSACTIONS_CSV
    df = _safe_read_csv(target_path, TRANSACTION_COL_MAP)

    if "txn_id" not in df.columns:
        raise ValueError(f"Missing mandatory 'txn_id' column in {target_path}")

    # Deduplicate by txn_id
    dups = df.duplicated(subset=["txn_id"]).sum()
    if dups > 0:
        logger.warning("Found and removed %d duplicate transactions in %s", dups, target_path.name)
        df = df.drop_duplicates(subset=["txn_id"], keep="first").reset_index(drop=True)

    # Normalize identifiers
    df["txn_id"] = df["txn_id"].astype(str).str.strip()
    df["src_account"] = df["src_account"].astype(str).str.strip()
    df["dst_account"] = df["dst_account"].astype(str).str.strip()

    # Parse timestamps
    if "ts" in df.columns:
        df["ts"] = pd.to_datetime(df["ts"], errors="coerce")
        bad_ts = df["ts"].isnull().sum()
        if bad_ts > 0:
            logger.warning("Dropping %d transactions with unparseable timestamps", bad_ts)
            df = df.dropna(subset=["ts"]).reset_index(drop=True)

    # Validate amounts (must be numeric and strictly positive)
    if "amount" in df.columns:
        df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0.0)
        invalid_amt = (df["amount"] <= 0).sum()
        if invalid_amt > 0:
            logger.warning("Replacing %d non-positive amounts with minimal epsilon (0.01)", invalid_amt)
            df["amount"] = df["amount"].clip(lower=0.01)

    # Clean ground-truth fraud label if present
    if "is_fraud_related" in df.columns:
        df["is_fraud_related"] = pd.to_numeric(df["is_fraud_related"], errors="coerce").fillna(0).astype(int)

    logger.info("Transactions loaded & sanitized: %d clean records.", len(df))
    return df


def load_fraud_rings(raw_path: Optional[Path] = None) -> pd.DataFrame:
    """
    Load supplementary fraud rings reference table.
    Returns empty DataFrame gracefully if file is not found.
    """
    target_path = raw_path or FRAUD_RINGS_CSV
    if not target_path.exists():
        logger.warning("fraud_rings.csv not found at %s – skipping.", target_path)
        return pd.DataFrame()

    df = _safe_read_csv(target_path)
    if "account_id" in df.columns:
        df["account_id"] = df["account_id"].astype(str).str.strip()
    if "ring_id" in df.columns:
        df["ring_id"] = df["ring_id"].astype(str).str.strip()

    logger.info("Fraud rings loaded: %d records.", len(df))
    return df


def load_daily_summary(raw_path: Optional[Path] = None) -> pd.DataFrame:
    """
    Load account daily activity summary.
    Returns empty DataFrame gracefully if file is not found.
    """
    target_path = raw_path or DAILY_SUMMARY_CSV
    if not target_path.exists():
        logger.warning("account_daily_summary.csv not found at %s – skipping.", target_path)
        return pd.DataFrame()

    df = _safe_read_csv(target_path)
    if "account_id" in df.columns:
        df["account_id"] = df["account_id"].astype(str).str.strip()
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")

    logger.info("Daily summary loaded: %d records.", len(df))
    return df


def load_all() -> Dict[str, pd.DataFrame]:
    """Load all available datasets and return as a dictionary."""
    return {
        "accounts": load_accounts(),
        "transactions": load_transactions(),
        "fraud_rings": load_fraud_rings(),
        "daily_summary": load_daily_summary(),
    }


# ---------------------------------------------------------------------------
# Database Ingestion Pipeline
# ---------------------------------------------------------------------------

def ingest_all_to_database(
    accounts_df: Optional[pd.DataFrame] = None,
    transactions_df: Optional[pd.DataFrame] = None,
    rings_df: Optional[pd.DataFrame] = None,
) -> Dict[str, int]:
    """
    Ingest accounts, transactions, and fraud ring records into the database.
    Idempotent and safe to run repeatedly.
    """
    logger.info("=" * 60)
    logger.info("STARTING DATABASE INGESTION PIPELINE")
    logger.info("=" * 60)
    start_t = time.time()

    # Load data if not provided
    if accounts_df is None:
        accounts_df = load_accounts()
    if transactions_df is None:
        transactions_df = load_transactions()
    if rings_df is None:
        rings_df = load_fraud_rings()

    # 1. Initialize schema
    init_database()

    # 2. Ingest fraud rings first (so ground truth foreign keys resolve)
    ring_count = upsert_fraud_rings(rings_df) if not rings_df.empty else 0

    # 3. Ingest accounts
    acc_count = upsert_accounts(accounts_df)

    # 4. Ingest transactions
    txn_count = upsert_transactions(transactions_df)

    elapsed = round(time.time() - start_t, 2)
    logger.info("Database ingestion complete in %s seconds.", elapsed)
    logger.info("Summary: %d accounts, %d transactions, %d rings ingested.", acc_count, txn_count, ring_count)

    return {
        "accounts_ingested": acc_count,
        "transactions_ingested": txn_count,
        "rings_ingested": ring_count,
        "elapsed_seconds": elapsed,
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    ingest_all_to_database()
