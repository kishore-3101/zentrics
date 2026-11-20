"""
tests/test_data_validation.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
import pytest
from io import StringIO
from src.data_validation import validate_accounts, validate_transactions


def make_accounts():
    return pd.DataFrame({
        "account_id"      : ["A1", "A2", "A1"],   # intentional duplicate
        "account_age_days": [100, 200, 100],
        "initial_balance" : [1000.0, 2000.0, 1000.0],
        "is_mule"         : [0, 1, 0],
    })


def make_transactions():
    return pd.DataFrame({
        "txn_id"    : ["T1", "T2", "T1"],   # intentional duplicate
        "src_account": ["A1", "A2", None],
        "dst_account": ["A2", "A3", "A1"],
        "amount"    : [100.0, -50.0, 200.0],
        "ts"        : ["2024-01-01T10:00:00", "bad_date", "2024-01-01T11:00:00"],
    })


def test_duplicate_accounts_removed():
    buf = StringIO()
    cleaned = validate_accounts(make_accounts(), buf)
    assert cleaned["account_id"].duplicated().sum() == 0


def test_missing_values_reported():
    buf = StringIO()
    validate_transactions(make_transactions(), buf)
    report = buf.getvalue()
    assert "Missing" in report or "missing" in report.lower() or len(report) > 0


def test_negative_amounts_flagged():
    buf = StringIO()
    validate_transactions(make_transactions(), buf)
    report = buf.getvalue()
    assert "Negative" in report


def test_duplicate_transactions_removed():
    buf = StringIO()
    cleaned = validate_transactions(make_transactions(), buf)
    if "txn_id" in cleaned.columns:
        assert cleaned["txn_id"].duplicated().sum() == 0
