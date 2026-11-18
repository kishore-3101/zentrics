"""Data loader and pipeline caching for TraceMesh dashboard."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
import streamlit as st

# Robust project-root resolution: ensure TraceMesh_Final is at sys.path[0]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from module_6_graph_builder_detectors import build_graph, run_detectors, rule_scores
from module_7_community_ring_clustering import cluster_rings
from module_12_incremental_sliding_window import IncrementalDetectorEngine
from shared.models import Hit, RingCandidate


def get_data_dir() -> Path:
    """Resolve directory containing input CSV datasets using pathlib.
    
    Prioritizes the local `datasets/` subdirectory inside the project root,
    followed by candidate directories relative to the project root.
    """
    candidates = [
        PROJECT_ROOT / "datasets",
        PROJECT_ROOT / "data",
        PROJECT_ROOT,
        PROJECT_ROOT.parent / "datasets",
        PROJECT_ROOT.parent / "dataset",
        PROJECT_ROOT.parent,
    ]
    for c in candidates:
        if (c / "accounts.csv").is_file():
            return c
    raise FileNotFoundError(
        f"Could not locate datasets directory relative to project root: {PROJECT_ROOT}\n"
        f"Expected 'datasets/accounts.csv' inside {PROJECT_ROOT}."
    )


@st.cache_data(show_spinner=False)
def load_raw_data() -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Load the raw CSV datasets into DataFrames."""
    data_dir = get_data_dir()
    accounts_df = pd.read_csv(data_dir / "accounts.csv")
    txns_df = pd.read_csv(data_dir / "transactions.csv")
    daily_df = pd.read_csv(data_dir / "account_daily_summary.csv")
    rings_df = pd.read_csv(data_dir / "fraud_rings.csv")
    return accounts_df, txns_df, daily_df, rings_df


@st.cache_data(show_spinner=False)
def run_cached_pipeline(window_days: int = 7) -> Dict[str, Any]:
    """Execute Modules 6 and 7 on the selected temporal window and cache the output."""
    accounts_df, txns_df, daily_df, _ = load_raw_data()
    min_ts = txns_df["timestamp"].min()
    window_end = (pd.to_datetime(min_ts) + pd.Timedelta(days=window_days)).isoformat()
    window_tuple = (str(min_ts), str(window_end))

    # Module 6: Build Graph
    graph = build_graph(accounts_df, txns_df, window=window_tuple)

    # Module 6: Run Detectors & Rule Scoring
    hits = run_detectors(graph, daily_summary_df=daily_df)
    scores = rule_scores(hits)

    # Module 7: Ring Clustering & Roles
    rings = cluster_rings(graph, scores, hits)

    return {
        "graph": graph,
        "hits": hits,
        "scores": scores,
        "rings": rings,
        "window": window_tuple,
    }
