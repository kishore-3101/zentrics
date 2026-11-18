"""Transaction Network Graph: Interactive directed multigraph."""

import sys
from pathlib import Path

# Robust project-root resolution: ensure TraceMesh_Final is at sys.path[0]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
import streamlit as st
import streamlit.components.v1 as components
from visualization.components.data_loader import run_cached_pipeline
from visualization.components.filters import extract_filtered_subgraph
from visualization.components.graph_renderer import render_pyvis_network


def render_transaction_network_page():
    st.title("Transaction Network Graph")
    st.markdown("Explore directed money movement, high-risk hubs, and counterparty clusters.")

    pipeline_data = run_cached_pipeline(window_days=7)
    graph = pipeline_data["graph"]
    scores = pipeline_data["scores"]

    # Filter Sidebar / Controls
    with st.expander("Graph Filtering & Controls", expanded=True):
        f_col1, f_col2, f_col3, f_col4 = st.columns(4)
        with f_col1:
            search_account = st.text_input("Search Account ID", placeholder="e.g. ACC_04432")
        with f_col2:
            risk_filter = st.selectbox(
                "Risk Tier",
                ["High Risk (>= 0.50)", "Medium & High (>= 0.25)", "All Scored (> 0.0)", "All"],
                index=1,
            )
        with f_col3:
            min_amount = st.number_input("Min Amount (INR)", min_value=0.0, value=1000.0, step=500.0)
        with f_col4:
            max_nodes = st.slider("Max Display Nodes", min_value=15, max_value=150, value=50, step=5)

    # Extract filtered subgraph
    subgraph = extract_filtered_subgraph(
        graph,
        scores,
        min_amount=min_amount,
        risk_filter=risk_filter,
        max_nodes=max_nodes,
        search_account=search_account,
    )

    # Subgraph Stats
    stat_c1, stat_c2, stat_c3 = st.columns(3)
    stat_c1.metric("Visible Nodes", f"{subgraph.number_of_nodes()}")
    stat_c2.metric("Visible Transactions", f"{subgraph.number_of_edges()}")
    total_vol = sum(d.get("amount", 0.0) for _, _, d in subgraph.edges(data=True))
    stat_c3.metric("Volume in View", f"INR {total_vol:,.2f}")

    # Legend
    st.markdown("""
    **Node Color Legend:** 
    🔴 <span style='color:#E63946; font-weight:bold;'>High Risk (>= 0.50)</span> &nbsp;&nbsp;|&nbsp;&nbsp; 
    🟠 <span style='color:#F77F00; font-weight:bold;'>Medium Risk (0.25 - 0.49)</span> &nbsp;&nbsp;|&nbsp;&nbsp; 
    🟢 <span style='color:#2A9D8F; font-weight:bold;'>Low Risk (< 0.25)</span> &nbsp;&nbsp;|&nbsp;&nbsp; 
    ⚪ <span style='color:#6C757D; font-weight:bold;'>Unscored</span>
    """, unsafe_allow_html=True)

    # Render interactive network
    if subgraph.number_of_nodes() > 0:
        html_content = render_pyvis_network(subgraph, account_scores=scores, height="620px")
        components.html(html_content, height=650)
    else:
        st.warning("No accounts match the current filter criteria. Try adjusting the search or reducing thresholds.")


if __name__ == "__main__":
    render_transaction_network_page()
