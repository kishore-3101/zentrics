"""Fraud Ring Explorer: Deep-dive into Module 7 ring candidates."""

import sys
from pathlib import Path

# Robust project-root resolution: ensure TraceMesh_Final is at sys.path[0]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
import streamlit as st
import streamlit.components.v1 as components
import pandas as pd
import networkx as nx

from visualization.components.data_loader import run_cached_pipeline
from visualization.components.graph_renderer import render_pyvis_network


def render_ring_explorer_page():
    st.title("Fraud Ring Explorer")
    st.markdown("Inspect coordinated mule networks, member roles, and shared-mule connections.")

    pipeline_data = run_cached_pipeline(window_days=7)
    graph = pipeline_data["graph"]
    scores = pipeline_data["scores"]
    rings = pipeline_data["rings"]

    if not rings:
        st.warning("No suspicious rings identified in the current window.")
        return

    # Ring Selector
    ring_options = [
        f"{r.ring_id} | Type: {r.ring_type} | Score: {r.score:.1f} | Priority: {r.priority:,.0f} | Members: {len(r.member_account_ids)}"
        for r in rings
    ]
    selected_idx = st.selectbox("Select Candidate Ring to Inspect", range(len(ring_options)), format_func=lambda i: ring_options[i])
    selected_ring = rings[selected_idx]

    # Ring KPI Cards
    kpi_c1, kpi_c2, kpi_c3, kpi_c4, kpi_c5 = st.columns(5)
    kpi_c1.metric("Ring Score", f"{selected_ring.score:.1f} / 100")
    kpi_c2.metric("Amount at Risk", f"INR {selected_ring.amount_at_risk:,.2f}")
    kpi_c3.metric("Total Moved", f"INR {selected_ring.amount_moved:,.2f}")
    kpi_c4.metric("Amount Cashed", f"INR {selected_ring.amount_cashed:,.2f}")
    kpi_c5.metric("Action", selected_ring.recommended_action)

    st.markdown(f"**Fingerprint (SHA-1):** `{selected_ring.fingerprint}`")
    st.markdown(f"**Pattern Tags:** `{'`, `'.join(selected_ring.pattern_tags)}`")

    # Roles & Members Table
    with st.expander("Member Accounts & Forensic Roles", expanded=True):
        members_data = []
        for m in selected_ring.member_account_ids:
            role = selected_ring.roles.get(m, "mule")
            node_data = graph.nodes.get(m, {})
            members_data.append({
                "Account ID": m,
                "Assigned Role": role.upper(),
                "Risk Score": scores.get(m, 0.0),
                "Account Type": node_data.get("account_type", "N/A"),
                "KYC Status": node_data.get("kyc_status", "N/A"),
                "City": node_data.get("city", "N/A"),
            })
        st.dataframe(pd.DataFrame(members_data), hide_index=True, use_container_width=True)

    # Interactive Ring Visualizer
    st.subheader(f"Network Topology: {selected_ring.ring_id}")
    st.markdown("""
    **Role Colors:** 
    🔵 <span style='color:#457B9D; font-weight:bold;'>Victim</span> &nbsp;&nbsp;|&nbsp;&nbsp; 
    🟠 <span style='color:#F4A261; font-weight:bold;'>Collector</span> &nbsp;&nbsp;|&nbsp;&nbsp; 
    🔴 <span style='color:#E76F51; font-weight:bold;'>Mule</span> &nbsp;&nbsp;|&nbsp;&nbsp; 
    🍷 <span style='color:#9B2226; font-weight:bold;'>Cash-out</span>
    """, unsafe_allow_html=True)

    # Build induced ring subgraph
    ring_sub = graph.subgraph(selected_ring.member_account_ids).copy()
    html_ring = render_pyvis_network(ring_sub, account_scores=scores, ring=selected_ring, height="500px")
    components.html(html_ring, height=520)

    # Transactions Timeline
    if selected_ring.ring_transactions:
        with st.expander(f"Internal Ring Transactions ({len(selected_ring.ring_transactions)} transfers)", expanded=False):
            tx_df = pd.DataFrame(selected_ring.ring_transactions)
            st.dataframe(tx_df, hide_index=True, use_container_width=True)


if __name__ == "__main__":
    render_ring_explorer_page()
