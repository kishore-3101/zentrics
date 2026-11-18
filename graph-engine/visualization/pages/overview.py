"""Overview page: System metrics, risk distribution, and detector alert counts."""

import sys
from pathlib import Path

# Robust project-root resolution: ensure TraceMesh_Final is at sys.path[0]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
import streamlit as st
import pandas as pd
from visualization.components.data_loader import load_raw_data, run_cached_pipeline
from visualization.components.metrics import (
    plot_risk_distribution,
    plot_detector_breakdown,
    plot_ring_typologies,
)


def render_overview_page():
    st.title("TraceMesh: System Overview")
    st.markdown("Coordinated Mule-Account Network Detection & Graph Intelligence")

    # Load raw data and cached pipeline results
    with st.spinner("Loading TraceMesh data and pipeline outputs..."):
        accounts_df, txns_df, daily_df, fraud_rings_df = load_raw_data()
        pipeline_data = run_cached_pipeline(window_days=7)

    graph = pipeline_data["graph"]
    hits = pipeline_data["hits"]
    scores = pipeline_data["scores"]
    rings = pipeline_data["rings"]

    # Top KPI Metrics Cards
    col1, col2, col3, col4, col5 = st.columns(5)
    with col1:
        st.metric("Total Accounts", f"{len(accounts_df):,}")
    with col2:
        st.metric("Total Transactions", f"{len(txns_df):,}")
    with col3:
        success_count = (txns_df["transaction_status"] == "Success").sum()
        st.metric("Successful Txns", f"{success_count:,}")
    with col4:
        suspicious_count = sum(1 for s in scores.values() if s >= 0.30)
        st.metric("Suspicious Accounts", f"{suspicious_count:,}")
    with col5:
        st.metric("Detected Rings", f"{len(rings):,}")

    st.markdown("---")

    # Transaction Status Breakdown
    st.subheader("Transaction Status Breakdown (Full Dataset)")
    status_counts = txns_df["transaction_status"].value_counts()
    c1, c2, c3 = st.columns(3)
    c1.info(f"**Success**: {status_counts.get('Success', 0):,} ({status_counts.get('Success', 0)/len(txns_df)*100:.1f}%)")
    c2.warning(f"**Pending**: {status_counts.get('Pending', 0):,} ({status_counts.get('Pending', 0)/len(txns_df)*100:.1f}%)")
    c3.error(f"**Failed**: {status_counts.get('Failed', 0):,} ({status_counts.get('Failed', 0)/len(txns_df)*100:.1f}%)")

    st.markdown("---")

    # Charts Row 1: Risk Distribution & Detector Alert Breakdown
    chart_col1, chart_col2 = st.columns(2)
    with chart_col1:
        st.plotly_chart(plot_risk_distribution(scores), use_container_width=True)
    with chart_col2:
        st.plotly_chart(plot_detector_breakdown(hits), use_container_width=True)

    # Charts Row 2: Ring Typologies & Top Priority Rings
    r_col1, r_col2 = st.columns([1, 1.4])
    with r_col1:
        st.plotly_chart(plot_ring_typologies(rings), use_container_width=True)
    with r_col2:
        st.subheader("Top Priority Rings (Action Queue)")
        if rings:
            top_rings_df = pd.DataFrame([
                {
                    "Ring ID": r.ring_id,
                    "Typology": r.ring_type,
                    "Members": len(r.member_account_ids),
                    "Score": r.score,
                    "Amount at Risk (INR)": f"{r.amount_at_risk:,.2f}",
                    "Priority": f"{r.priority:,.0f}",
                    "Action": r.recommended_action,
                }
                for r in rings[:8]
            ])
            st.dataframe(top_rings_df, hide_index=True, use_container_width=True)
        else:
            st.write("No rings detected in the active window.")


if __name__ == "__main__":
    render_overview_page()
