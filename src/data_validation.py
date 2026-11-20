"""
data_validation.py – Schema checks, consistency checks, and data-quality report.
"""
import logging
from io import StringIO
from pathlib import Path

import numpy as np
import pandas as pd

from src.config import DATA_QUALITY_REPORT

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _section(title: str, buf: StringIO) -> None:
    buf.write(f"\n{'='*70}\n{title}\n{'='*70}\n")


def _write(msg: str, buf: StringIO) -> None:
    buf.write(msg + "\n")
    logger.info(msg)


# ---------------------------------------------------------------------------
# Validation functions
# ---------------------------------------------------------------------------

def validate_accounts(df: pd.DataFrame, buf: StringIO) -> pd.DataFrame:
    _section("ACCOUNTS VALIDATION", buf)
    _write(f"Shape: {df.shape}", buf)
    _write(f"Columns: {list(df.columns)}", buf)

    # Missing values
    missing = df.isnull().sum()
    _write("\nMissing values per column:", buf)
    _write(missing[missing > 0].to_string() if missing.any() else "  None", buf)

    # Duplicates
    dup = df.duplicated(subset=["account_id"]).sum()
    _write(f"\nDuplicate account_ids: {dup}", buf)
    if dup > 0:
        df = df.drop_duplicates(subset=["account_id"], keep="first")
        _write(f"  Dropped {dup} duplicate rows.", buf)

    # is_mule distribution
    if "is_mule" in df.columns:
        vc = df["is_mule"].value_counts()
        _write(f"\nis_mule distribution:\n{vc.to_string()}", buf)
        imbalance = vc.min() / vc.max()
        _write(f"Class imbalance ratio (min/max): {imbalance:.3f}", buf)

    # account_age_days
    if "account_age_days" in df.columns:
        neg = (df["account_age_days"] < 0).sum()
        _write(f"\nNegative account_age_days: {neg}", buf)
        _write(df["account_age_days"].describe().to_string(), buf)

    # initial_balance
    if "initial_balance" in df.columns:
        neg = (df["initial_balance"] < 0).sum()
        _write(f"\nNegative initial_balance: {neg}", buf)

    _write("\n[ACCOUNTS] Validation complete.", buf)
    return df


def validate_transactions(df: pd.DataFrame, buf: StringIO,
                           known_accounts: set | None = None) -> pd.DataFrame:
    _section("TRANSACTIONS VALIDATION", buf)
    _write(f"Shape: {df.shape}", buf)
    _write(f"Columns: {list(df.columns)}", buf)

    # Missing
    missing = df.isnull().sum()
    _write("\nMissing values per column:", buf)
    _write(missing[missing > 0].to_string() if missing.any() else "  None", buf)

    # Duplicates by txn_id
    if "txn_id" in df.columns:
        dup = df.duplicated(subset=["txn_id"]).sum()
        _write(f"\nDuplicate txn_ids: {dup}", buf)
        if dup > 0:
            df = df.drop_duplicates(subset=["txn_id"], keep="first")
            _write(f"  Dropped {dup} duplicate transaction rows.", buf)

    # Amount issues
    if "amount" in df.columns:
        neg = (df["amount"] < 0).sum()
        zero = (df["amount"] == 0).sum()
        _write(f"\nNegative amounts: {neg}", buf)
        _write(f"Zero amounts: {zero}", buf)
        _write(df["amount"].describe().to_string(), buf)
        # Flag but keep – some datasets have fee-reversal negatives
        if neg > 0:
            _write("  WARNING: Negative amounts retained for analysis.", buf)

    # Timestamp
    if "ts" in df.columns:
        try:
            ts = pd.to_datetime(df["ts"], errors="coerce")
            bad_ts = ts.isnull().sum()
            _write(f"\nUnparseable timestamps: {bad_ts}", buf)
            _write(f"Timestamp range: {ts.min()} → {ts.max()}", buf)
        except Exception as e:
            _write(f"  Timestamp parse error: {e}", buf)

    # Account reference validation
    if known_accounts and "src_account" in df.columns and "dst_account" in df.columns:
        unknown_src = (~df["src_account"].isin(known_accounts)).sum()
        unknown_dst = (~df["dst_account"].isin(known_accounts)).sum()
        _write(f"\nUnknown sender accounts: {unknown_src}", buf)
        _write(f"Unknown receiver accounts: {unknown_dst}", buf)

    # is_fraud_related distribution
    if "is_fraud_related" in df.columns:
        vc = df["is_fraud_related"].value_counts()
        _write(f"\nis_fraud_related distribution:\n{vc.to_string()}", buf)

    _write("\n[TRANSACTIONS] Validation complete.", buf)
    return df


def run_validation(accounts: pd.DataFrame,
                   transactions: pd.DataFrame,
                   fraud_rings: pd.DataFrame | None = None,
                   daily_summary: pd.DataFrame | None = None) -> dict:
    """
    Run all validation checks.
    Returns cleaned DataFrames and writes the data-quality report.
    """
    buf = StringIO()
    buf.write("MULE ACCOUNT RING DETECTION – DATA QUALITY REPORT\n")
    buf.write("=" * 70 + "\n")

    known_accs = set(accounts["account_id"].dropna()) if "account_id" in accounts.columns else None

    accounts_clean     = validate_accounts(accounts, buf)
    transactions_clean = validate_transactions(transactions, buf, known_accs)

    if fraud_rings is not None and not fraud_rings.empty:
        _section("FRAUD RINGS", buf)
        _write(f"Shape: {fraud_rings.shape}", buf)
        _write(f"Columns: {list(fraud_rings.columns)}", buf)
        _write(f"Unique rings: {fraud_rings['ring_id'].nunique()}", buf)
        _write(f"Unique accounts: {fraud_rings['account_id'].nunique()}", buf)

    if daily_summary is not None and not daily_summary.empty:
        _section("ACCOUNT DAILY SUMMARY", buf)
        _write(f"Shape: {daily_summary.shape}", buf)

    report_text = buf.getvalue()
    DATA_QUALITY_REPORT.parent.mkdir(parents=True, exist_ok=True)
    DATA_QUALITY_REPORT.write_text(report_text, encoding="utf-8")
    logger.info("Data quality report saved to %s", DATA_QUALITY_REPORT)

    return {
        "accounts"    : accounts_clean,
        "transactions": transactions_clean,
    }
