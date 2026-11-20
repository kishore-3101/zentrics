"""
data_loader.py – Loads and renames the raw CSV datasets to canonical column names.
Never overwrites the originals.
"""
import shutil
import logging
from pathlib import Path

import pandas as pd

from src.config import (
    ACCOUNTS_SRC, TRANSACTIONS_SRC, FRAUD_RINGS_SRC, DAILY_SUMMARY_SRC,
    DATA_RAW_DIR,
    ACCOUNT_COL_MAP, TRANSACTION_COL_MAP,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _copy_to_raw(src: Path, dest_name: str) -> Path:
    """Copy source file into data/raw/ if it isn't already there."""
    dest = DATA_RAW_DIR / dest_name
    if not dest.exists():
        shutil.copy2(src, dest)
        logger.info("Copied %s → %s", src, dest)
    return dest


def _load_csv(path: Path, col_map: dict | None = None) -> pd.DataFrame:
    """Load a CSV, optionally rename columns using col_map."""
    if not path.exists():
        raise FileNotFoundError(f"Required dataset not found: {path}")
    df = pd.read_csv(path, low_memory=False)
    logger.info("Loaded %s  shape=%s", path.name, df.shape)
    if col_map:
        # Only rename columns that actually exist in the file
        rename = {k: v for k, v in col_map.items() if k in df.columns}
        df = df.rename(columns=rename)
    return df


# ---------------------------------------------------------------------------
# Public loaders
# ---------------------------------------------------------------------------

def load_accounts(raw_path: Path | None = None) -> pd.DataFrame:
    """Return accounts DataFrame with canonical column names."""
    if raw_path is None:
        raw_path = DATA_RAW_DIR / "accounts.csv"
        if not raw_path.exists():
            _copy_to_raw(ACCOUNTS_SRC, "accounts.csv")
    df = _load_csv(raw_path, ACCOUNT_COL_MAP)
    logger.info("Accounts loaded: %d rows, %d cols", *df.shape)
    return df


def load_transactions(raw_path: Path | None = None) -> pd.DataFrame:
    """Return transactions DataFrame with canonical column names."""
    if raw_path is None:
        raw_path = DATA_RAW_DIR / "transactions.csv"
        if not raw_path.exists():
            _copy_to_raw(TRANSACTIONS_SRC, "transactions.csv")
    df = _load_csv(raw_path, TRANSACTION_COL_MAP)
    logger.info("Transactions loaded: %d rows, %d cols", *df.shape)
    return df


def load_fraud_rings(raw_path: Path | None = None) -> pd.DataFrame:
    """Load the fraud_rings supplementary file (optional)."""
    if raw_path is None:
        raw_path = DATA_RAW_DIR / "fraud_rings.csv"
        if not raw_path.exists():
            if FRAUD_RINGS_SRC.exists():
                _copy_to_raw(FRAUD_RINGS_SRC, "fraud_rings.csv")
            else:
                logger.warning("fraud_rings.csv not found – skipping.")
                return pd.DataFrame()
    return _load_csv(raw_path)


def load_daily_summary(raw_path: Path | None = None) -> pd.DataFrame:
    """Load account_daily_summary (optional enrichment)."""
    if raw_path is None:
        raw_path = DATA_RAW_DIR / "account_daily_summary.csv"
        if not raw_path.exists():
            if DAILY_SUMMARY_SRC.exists():
                _copy_to_raw(DAILY_SUMMARY_SRC, "account_daily_summary.csv")
            else:
                logger.warning("account_daily_summary.csv not found – skipping.")
                return pd.DataFrame()
    return _load_csv(raw_path)


def load_all() -> dict:
    """Load all datasets and return as dict keyed by name."""
    return {
        "accounts"       : load_accounts(),
        "transactions"   : load_transactions(),
        "fraud_rings"    : load_fraud_rings(),
        "daily_summary"  : load_daily_summary(),
    }
