"""Incremental Graph Replay: Streaming replay of Module 12a sliding-window detection."""

import sys
from pathlib import Path

# Robust project-root resolution: ensure TraceMesh_Final is at sys.path[0]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
import streamlit as st
import streamlit.components.v1 as components
import pandas as pd

from visualization.components.data_loader import load_raw_data
from visualization.components.graph_renderer import render_pyvis_network
from module_12_incremental_sliding_window import IncrementalDetectorEngine


def render_incremental_graph_page():
    st.title("Incremental Sliding-Window Detection (Module 12a)")
    st.markdown("""
    **Streaming Transaction Replay:** This page executes the real **Module 12a** sliding-window engine 
    against chronological transaction records. It illustrates dynamic edge ingestion, transaction expiration, 
    and localized 1-to-2 hop re-evaluation without full graph rebuilding.
    """)

    _, txns_df, _, _ = load_raw_data()

    # Session State to hold stream state
    if "engine" not in st.session_state:
        st.session_state.engine = IncrementalDetectorEngine(window_minutes=60)
        st.session_state.cursor = 0
        st.session_state.events = []

    engine: IncrementalDetectorEngine = st.session_state.engine

    # Controls
    ctrl_c1, ctrl_c2, ctrl_c3 = st.columns([1, 1, 1])
    with ctrl_c1:
        step_size = st.selectbox("Replay Step Size (Txns)", [25, 50, 100, 250], index=1)
    with ctrl_c2:
        if st.button(f"▶ Ingest Next {step_size} Transactions"):
            next_slice = txns_df.iloc[st.session_state.cursor : st.session_state.cursor + step_size]
            for row in next_slice.to_dict(orient="records"):
                evt = engine.process_transaction(row)
                st.session_state.events.append(evt)
            st.session_state.cursor += step_size
    with ctrl_c3:
        if st.button("🔄 Reset Replay Stream"):
            st.session_state.engine = IncrementalDetectorEngine(window_minutes=60)
            st.session_state.cursor = 0
            st.session_state.events = []
            st.rerun()

    # Stream Metrics
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Stream Position", f"{st.session_state.cursor:,} / {len(txns_df):,}")
    m2.metric("Active Window Nodes", f"{engine.window_mgr.graph.number_of_nodes()}")
    m3.metric("Active Window Edges", f"{engine.window_mgr.graph.number_of_edges()}")
    alert_events = [e for e in st.session_state.events if e.current_status in ["new_alert", "alert_updated", "alert_triggered"]]
    m4.metric("Triggered Alerts", f"{len(alert_events)}")

    # Graph Rendering
    st.subheader("Current Sliding-Window In-Memory Graph")
    if engine.window_mgr.graph.number_of_edges() > 0:
        html_stream = render_pyvis_network(engine.window_mgr.graph, account_scores=engine.account_scores, height="480px")
        components.html(html_stream, height=500)
    else:
        st.info("The in-memory sliding window is currently empty. Click 'Ingest Next Transactions' above to start replay.")

    # Recent Alerts & Events Table
    if st.session_state.events:
        with st.expander("Recent Streaming Transaction Events", expanded=True):
            recent_evts = [
                {
                    "Event ID": e.event_id,
                    "Txn ID": e.transaction_id,
                    "Timestamp": str(e.timestamp)[:19],
                    "Status": e.current_status,
                    "Ring ID": e.ring_id or "None",
                    "Alert Score": f"{e.alert_score:.1f}",
                    "Latency (ms)": f"{e.processing_time_ms:.2f}",
                }
                for e in st.session_state.events[-15:][::-1]
            ]
            st.dataframe(pd.DataFrame(recent_evts), hide_index=True, use_container_width=True)


if __name__ == "__main__":
    render_incremental_graph_page()
