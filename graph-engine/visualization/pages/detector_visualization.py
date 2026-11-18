"""Detector Visualization: Inspect alerts for all six Module 6 detectors."""

import sys
from pathlib import Path

# Robust project-root resolution: ensure TraceMesh_Final is at sys.path[0]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
import streamlit as st
import streamlit.components.v1 as components
import pandas as pd

from visualization.components.data_loader import run_cached_pipeline
from visualization.components.graph_renderer import render_pyvis_network


def render_detector_visualization_page():
    st.title("Module 6: Rule Detectors Visualization")
    st.markdown("Examine detection evidence, affected subgraphs, and rule criteria.")

    pipeline_data = run_cached_pipeline(window_days=7)
    graph = pipeline_data["graph"]
    hits = pipeline_data["hits"]
    scores = pipeline_data["scores"]

    detectors_map = {
        "fan_in_burst": "1. Fan-in Burst",
        "fan_out_split": "2. Fan-out Split",
        "rapid_pass_through": "3. Rapid Pass-through",
        "layering_chain": "4. Layering Chain",
        "circular_flow": "5. Circular Flow",
        "dormant_active": "6. Dormant Activation",
    }

    selected_code = st.selectbox(
        "Choose Suspicious Activity Detector",
        list(detectors_map.keys()),
        format_func=lambda k: detectors_map[k],
    )

    det_hits = [h for h in hits if h.code == selected_code]
    st.markdown(f"**Total Alerts Found for {detectors_map[selected_code]}:** `{len(det_hits)}`")

    if not det_hits:
        st.info("No hits were recorded for this detector within the active 7-day window.")
        return

    # Alert Table
    alerts_summary = [
        {
            "Alert #": i + 1,
            "Account ID": h.account_id,
            "Severity": h.severity.upper(),
            "Window Start": str(h.window_start)[:19],
            "Window End": str(h.window_end)[:19],
            "Evidence Detail": h.detail,
        }
        for i, h in enumerate(det_hits)
    ]
    st.dataframe(pd.DataFrame(alerts_summary), hide_index=True, use_container_width=True)

    # Subgraph Inspection for a chosen alert
    st.subheader("Inspect Alert Subgraph")
    chosen_idx = st.selectbox("Select Alert to Visualize", range(len(det_hits)), format_func=lambda i: f"Alert #{i+1}: {det_hits[i].account_id} ({det_hits[i].severity.upper()})")
    chosen_hit = det_hits[chosen_idx]

    # Show structured evidence
    st.json(chosen_hit.evidence)

    # Extract relevant nodes
    target_node = chosen_hit.account_id
    sub_nodes = {target_node}
    sub_nodes.update(graph.predecessors(target_node))
    sub_nodes.update(graph.successors(target_node))

    # Add cycle or path accounts if present
    for p in chosen_hit.evidence.get("path_accounts", []):
        if p in graph.nodes:
            sub_nodes.add(p)
    for c in chosen_hit.evidence.get("cycle_accounts", []):
        if c in graph.nodes:
            sub_nodes.add(c)

    hit_subgraph = graph.subgraph(sub_nodes).copy()
    html_hit = render_pyvis_network(
        hit_subgraph,
        account_scores=scores,
        highlight_nodes={target_node},
        height="480px",
    )
    components.html(html_hit, height=500)


if __name__ == "__main__":
    render_detector_visualization_page()
