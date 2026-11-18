"""TraceMesh Interactive Graph Visualization Dashboard.

Multi-page Streamlit application for investigating transaction graphs,
fraud ring topologies, rule detectors, and incremental sliding-window alerts.
"""

import sys
from pathlib import Path

# Robust project-root resolution: ensure TraceMesh_Final is at sys.path[0]
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import streamlit as st

from visualization.pages.overview import render_overview_page
from visualization.pages.transaction_network import render_transaction_network_page
from visualization.pages.ring_explorer import render_ring_explorer_page
from visualization.pages.detector_visualization import render_detector_visualization_page
from visualization.pages.account_investigation import render_account_investigation_page
from visualization.pages.incremental_graph import render_incremental_graph_page

# Page Configuration
st.set_page_config(
    page_title="TraceMesh | Graph Intelligence",
    page_icon="🕸️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Sidebar Navigation
st.sidebar.title("🕸️ TraceMesh")
st.sidebar.markdown("**Graph-Based Mule Ring Detection**")
st.sidebar.markdown("---")

page = st.sidebar.radio(
    "Navigation",
    [
        "1. Overview & Metrics",
        "2. Transaction Network Graph",
        "3. Fraud Ring Explorer",
        "4. Detector Visualization",
        "5. Account Investigation",
        "6. Live / Incremental Graph",
    ],
)

st.sidebar.markdown("---")
st.sidebar.info("""
**TraceMesh Core Modules:**
- **Module 6:** MultiDiGraph & 6 Detectors
- **Module 7:** Community Detection & Rings
- **Module 12a:** Incremental Sliding Window
""")

# Route to selected page
if page == "1. Overview & Metrics":
    render_overview_page()
elif page == "2. Transaction Network Graph":
    render_transaction_network_page()
elif page == "3. Fraud Ring Explorer":
    render_ring_explorer_page()
elif page == "4. Detector Visualization":
    render_detector_visualization_page()
elif page == "5. Account Investigation":
    render_account_investigation_page()
elif page == "6. Live / Incremental Graph":
    render_incremental_graph_page()
