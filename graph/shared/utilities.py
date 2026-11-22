"""
TraceMesh Graph Utilities.
Common graph, temporal, and mathematical helper functions.
"""

from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple
import pandas as pd


def compute_ring_fingerprint(member_accounts: Iterable[str]) -> str:
    """Computes a deterministic SHA-1 fingerprint from sorted member account IDs."""
    sorted_members = sorted(list(set(member_accounts)))
    payload = "|".join(sorted_members)
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


def parse_timestamp(val: Any) -> Optional[datetime]:
    """Safely parses any datetime/string/timestamp object to a Python datetime."""
    if val is None or pd.isna(val):
        return None
    if isinstance(val, datetime):
        return val
    try:
        ts = pd.to_datetime(val)
        if pd.isna(ts):
            return None
        return ts.to_pydatetime()
    except Exception:
        return None


def calculate_jaccard_similarity(set_a: Set[str], set_b: Set[str]) -> float:
    """Calculates Jaccard index between two member sets."""
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a.intersection(set_b))
    union = len(set_a.union(set_b))
    return intersection / union if union > 0 else 0.0
