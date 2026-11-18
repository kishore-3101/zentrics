"""Analytical metrics and Plotly charts for TraceMesh dashboard."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

# Robust project-root resolution: ensure TraceMesh_Final is at sys.path[0]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from shared.models import Hit, RingCandidate


def plot_risk_distribution(scores: Dict[str, float]) -> go.Figure:
    """Create a distribution chart of account risk scores."""
    if not scores:
        fig = go.Figure()
        fig.add_annotation(text="No account risk scores available", showarrow=False)
        return fig

    df = pd.DataFrame(list(scores.items()), columns=["account_id", "risk_score"])
    df["tier"] = df["risk_score"].apply(
        lambda s: "High (>= 0.50)" if s >= 0.50 else ("Medium (0.25 - 0.49)" if s >= 0.25 else "Low (< 0.25)")
    )

    fig = px.histogram(
        df,
        x="risk_score",
        color="tier",
        nbins=25,
        title="Account Risk Score Distribution",
        labels={"risk_score": "Risk Score [0.0 - 1.0]", "count": "Accounts"},
        color_discrete_map={
            "High (>= 0.50)": "#E63946",
            "Medium (0.25 - 0.49)": "#F77F00",
            "Low (< 0.25)": "#2A9D8F",
        },
        template="plotly_dark",
    )
    fig.update_layout(margin=dict(l=20, r=20, t=40, b=20), height=320)
    return fig


def plot_detector_breakdown(hits: List[Hit]) -> go.Figure:
    """Create a horizontal bar chart of detector hits by code."""
    if not hits:
        fig = go.Figure()
        fig.add_annotation(text="No detector hits recorded", showarrow=False)
        return fig

    counts = pd.Series([h.code for h in hits]).value_counts().reset_index()
    counts.columns = ["detector", "hits"]

    fig = px.bar(
        counts,
        x="hits",
        y="detector",
        orientation="h",
        title="Alert Counts by Rule Detector",
        color="detector",
        labels={"hits": "Hit Count", "detector": "Detector"},
        template="plotly_dark",
    )
    fig.update_layout(margin=dict(l=20, r=20, t=40, b=20), height=320, showlegend=False)
    return fig


def plot_ring_typologies(rings: List[RingCandidate]) -> go.Figure:
    """Create a donut chart of detected rings by typology."""
    if not rings:
        fig = go.Figure()
        fig.add_annotation(text="No rings detected", showarrow=False)
        return fig

    counts = pd.Series([r.ring_type for r in rings]).value_counts().reset_index()
    counts.columns = ["typology", "count"]

    fig = px.pie(
        counts,
        names="typology",
        values="count",
        hole=0.45,
        title="Ring Typologies Breakdown",
        template="plotly_dark",
    )
    fig.update_layout(margin=dict(l=20, r=20, t=40, b=20), height=320)
    return fig


def plot_account_timeline(txns_df: pd.DataFrame, account_id: str) -> go.Figure:
    """Plot transaction activity timeline for an investigated account."""
    acc_txns = txns_df.loc[
        (txns_df["sender_account"] == account_id) | (txns_df["receiver_account"] == account_id)
    ].copy()

    if acc_txns.empty:
        fig = go.Figure()
        fig.add_annotation(text=f"No transactions found for {account_id}", showarrow=False)
        return fig

    acc_txns["direction"] = acc_txns["sender_account"].apply(
        lambda s: "Outbound" if s == account_id else "Inbound"
    )
    acc_txns["timestamp"] = pd.to_datetime(acc_txns["timestamp"])

    fig = px.scatter(
        acc_txns,
        x="timestamp",
        y="amount",
        color="direction",
        size="amount",
        hover_data=["transaction_id", "channel", "transaction_status"],
        title=f"Transaction Flow Timeline: {account_id}",
        labels={"amount": "Amount (INR)", "timestamp": "Transaction Time"},
        color_discrete_map={"Inbound": "#2A9D8F", "Outbound": "#E63946"},
        template="plotly_dark",
    )
    fig.update_layout(margin=dict(l=20, r=20, t=40, b=20), height=340)
    return fig
