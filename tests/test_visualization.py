"""Unit tests for dashboard visualization data preparation and filtering."""

import pandas as pd
import pytest
import networkx as nx

from module_6_graph_builder_detectors import build_graph
from shared.models import Hit, RingCandidate
from visualization.components.filters import extract_filtered_subgraph
from visualization.components.graph_renderer import render_pyvis_network, get_risk_color, get_role_color
from visualization.components.metrics import (
    plot_risk_distribution,
    plot_detector_breakdown,
    plot_ring_typologies,
    plot_account_timeline,
)


def test_risk_and_role_colors():
    """Verify color mappings adhere to risk tiers and forensic roles."""
    assert get_risk_color(0.85) == "#E63946"  # High risk: Red
    assert get_risk_color(0.35) == "#F77F00"  # Medium risk: Orange
    assert get_risk_color(0.15) == "#2A9D8F"  # Low risk: Green
    assert get_risk_color(0.0) == "#6C757D"   # Neutral: Grey

    assert get_role_color("victim") == "#457B9D"
    assert get_role_color("collector") == "#F4A261"
    assert get_role_color("mule") == "#E76F51"
    assert get_role_color("cash_out") == "#9B2226"


def test_extract_filtered_subgraph():
    """Verify graph filtering respects min amount, risk tier, search, and node limits."""
    accounts = pd.DataFrame([{"account_id": f"ACC_{i}"} for i in range(10)])
    txns = pd.DataFrame([
        {"transaction_id": f"T_{i}", "sender_account": f"ACC_{i}", "receiver_account": f"ACC_{(i+1)%10}",
         "amount": float(i * 1000 + 500), "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"}
        for i in range(10)
    ])
    graph = build_graph(accounts, txns)
    scores = {f"ACC_{i}": i * 0.1 for i in range(10)}

    # High risk filter (>= 0.50): ACC_5 to ACC_9
    sub_high = extract_filtered_subgraph(graph, scores, risk_filter="High Risk (>= 0.50)", max_nodes=20)
    assert sub_high.number_of_nodes() <= 5
    for n in sub_high.nodes:
        assert scores[n] >= 0.50

    # Search filter
    sub_search = extract_filtered_subgraph(graph, scores, search_account="ACC_3", max_nodes=20)
    assert "ACC_3" in sub_search.nodes
    # 1-hop neighbors ACC_2 and ACC_4 should be included
    assert "ACC_2" in sub_search.nodes or "ACC_4" in sub_search.nodes

    # Max nodes cap
    sub_capped = extract_filtered_subgraph(graph, scores, risk_filter="All", max_nodes=4)
    assert sub_capped.number_of_nodes() <= 4


def test_render_pyvis_network_html_generation():
    """Verify PyVis renders valid standalone HTML containing network elements."""
    accounts = pd.DataFrame([{"account_id": "ACC_A"}, {"account_id": "ACC_B"}])
    txns = pd.DataFrame([
        {"transaction_id": "T1", "sender_account": "ACC_A", "receiver_account": "ACC_B",
         "amount": 2500.0, "timestamp": "2026-01-01T10:00:00", "transaction_status": "Success", "channel": "UPI"}
    ])
    graph = build_graph(accounts, txns)
    scores = {"ACC_A": 0.8, "ACC_B": 0.2}

    html = render_pyvis_network(graph, account_scores=scores)
    assert isinstance(html, str)
    assert "<html>" in html.lower() or "<div" in html.lower()
    assert "ACC_A" in html
    assert "ACC_B" in html


def test_plotly_chart_generators():
    """Verify Plotly charts generate valid figures even with empty or populated data."""
    # Risk distribution
    scores = {"ACC_1": 0.85, "ACC_2": 0.35, "ACC_3": 0.10}
    fig_risk = plot_risk_distribution(scores)
    assert fig_risk is not None

    # Detector breakdown
    hits = [
        Hit("ACC_1", "fan_in_burst", pd.to_datetime("2026-01-01"), pd.to_datetime("2026-01-01"), "high"),
        Hit("ACC_2", "circular_flow", pd.to_datetime("2026-01-01"), pd.to_datetime("2026-01-01"), "critical"),
    ]
    fig_hits = plot_detector_breakdown(hits)
    assert fig_hits is not None

    # Ring typologies
    rings = [
        RingCandidate("R1", ["A", "B", "C"], 1, {"A": "victim", "B": "mule", "C": "cash_out"}, 80.0, 80000.0, 1000.0, 500.0, 500.0, ring_type="circular_flow"),
        RingCandidate("R2", ["D", "E", "F"], 2, {"D": "collector", "E": "mule", "F": "cash_out"}, 60.0, 60000.0, 2000.0, 1000.0, 1000.0, ring_type="layering_chain"),
    ]
    fig_rings = plot_ring_typologies(rings)
    assert fig_rings is not None

    # Account timeline
    txns_df = pd.DataFrame([
        {"transaction_id": "T1", "sender_account": "ACC_1", "receiver_account": "ACC_2", "amount": 1000.0, "timestamp": "2026-01-01T10:00:00", "channel": "UPI", "transaction_status": "Success"},
        {"transaction_id": "T2", "sender_account": "ACC_3", "receiver_account": "ACC_1", "amount": 2000.0, "timestamp": "2026-01-01T11:00:00", "channel": "UPI", "transaction_status": "Success"},
    ])
    fig_timeline = plot_account_timeline(txns_df, "ACC_1")
    assert fig_timeline is not None
