"""Shared utilities for TraceMesh."""

from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any, Iterable, Optional
import pandas as pd


def compute_fingerprint(account_ids: Iterable[str]) -> str:
    """Produce a deterministic SHA-1 hash of sorted unique member account IDs."""
    sorted_accounts = sorted(set(account_ids))
    return hashlib.sha1(",".join(sorted_accounts).encode("utf-8")).hexdigest()


def parse_timestamp(val: Any) -> datetime:
    """Parse various datetime representations safely into a Python datetime."""
    if isinstance(val, datetime):
        return val
    if isinstance(val, pd.Timestamp):
        return val.to_pydatetime()
    dt = pd.to_datetime(val)
    if isinstance(dt, pd.Timestamp):
        return dt.to_pydatetime()
    return dt


def format_currency(val: float) -> str:
    """Format currency values in INR representation (Lakhs/Crores/Rupees)."""
    if val >= 10_000_000:
        return f"₹{val / 10_000_000:.2f} Cr"
    elif val >= 100_000:
        return f"₹{val / 100_000:.2f} L"
    return f"₹{val:,.2f}"
