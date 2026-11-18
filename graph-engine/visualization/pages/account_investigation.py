"""Account Investigation: 360-degree forensic analysis of an account."""

import sys
from pathlib import Path

# Robust project-root resolution: ensure TraceMesh_Final is at sys.path[0]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
import streamlit as st
import streamlit.components.v1 as components
import pandas as pd

from visualization.components.data_loader import load_raw_data, run_cached_pipeline
from visualization.components.metrics import plot_account_timeline
from visualization.components.graph_renderer import render_pyvis_network


def render_account_investigation_page():
    st.title("Account Investigation")
    st.markdown("Search and investigate account profiles, risk contributors, counterparty ego-networks, and transaction history.")

    accounts_df, txns_df, _, _ = load_raw_data()
    pipeline_data = run_cached_pipeline(window_days=7)
    graph = pipeline_data["graph"]
    scores = pipeline_data["scores"]
    hits = pipeline_data["hits"]
    rings = pipeline_data["rings"]

    # Account Selector / Search
    high_risk_list = sorted([acc for acc, s in scores.items() if s >= 0.30], key=lambda a: scores[a], reverse=True)
    all_accounts = list(accounts_df["account_id"].unique())

    col_search, col_preset = st.columns([2, 1])
    with col_search:
        search_input = st.text_input("Enter Account ID to Investigate", value="ACC_04432").strip()
    with col_preset:
        preset_acc = st.selectbox("Quick-Select Suspicious Account", high_risk_list[:25])
        if st.button("Load Quick-Select Account"):
            search_input = preset_acc

    target_acc = search_input
    if target_acc not in accounts_df["account_id"].values:
        st.error(f"Account '{target_acc}' not found in accounts dataset.")
        return

    # Profile & Risk Info
    acc_row = accounts_df.loc[accounts_df["account_id"] == target_acc].iloc[0]
    acc_score = scores.get(target_acc, 0.0)

    # Top Cards
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Risk Score", f"{acc_score:.2f} / 1.00")
    c2.metric("Account Type", acc_row.get("account_type", "N/A"))
    c3.metric("KYC Status", acc_row.get("kyc_status", "N/A"))
    c4.metric("City / Branch", f"{acc_row.get('city', 'N/A')} ({acc_row.get('branch_id', 'N/A')})")

    st.markdown("---")

    # Check Ring Membership
    member_rings = [r for r in rings if target_acc in r.member_account_ids]
    if member_rings:
        for r in member_rings:
            st.error(f"⚠️ **Member of Ring {r.ring_id}** ({r.ring_type.upper()}) | Assigned Role: **{r.roles.get(target_acc, 'MULE').upper()}** | Ring Priority: {r.priority:,.0f}")
    else:
        st.info("ℹ️ Account is not currently part of any detected ring.")

    # Triggered Detector Hits for this Account
    acc_hits = [h for h in hits if h.account_id == target_acc]
    if acc_hits:
        with st.expander(f"Triggered Anomaly Rules ({len(acc_hits)} alerts)", expanded=True):
            for h in acc_hits:
                st.markdown(f"- **`{h.code}`** [{h.severity.upper()}]: {h.detail}")

    # Visual Ego-Network
    st.subheader(f"1-Hop Counterparty Ego-Network: {target_acc}")
    ego_nodes = {target_acc}
    if target_acc in graph:
        ego_nodes.update(graph.predecessors(target_acc))
        ego_nodes.update(graph.successors(target_acc))
        ego_subgraph = graph.subgraph(ego_nodes).copy()
        html_ego = render_pyvis_network(ego_subgraph, account_scores=scores, highlight_nodes={target_acc}, height="460px")
        components.html(html_ego, height=480)
    else:
        st.write("Account has no transactions in the current graph window.")

    # Transaction Timeline Chart & History
    st.subheader("Transaction Activity Timeline")
    st.plotly_chart(plot_account_timeline(txns_df, target_acc), use_container_width=True)

    with st.expander("Detailed Transaction History"):
        history = txns_df.loc[(txns_df["sender_account"] == target_acc) | (txns_df["receiver_account"] == target_acc)]
        st.dataframe(history, hide_index=True, use_container_width=True)


if __name__ == "__main__":
    render_account_investigation_page()
