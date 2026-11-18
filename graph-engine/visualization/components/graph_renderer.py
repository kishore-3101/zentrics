"""Interactive graph visualizer using PyVis and NetworkX."""

from __future__ import annotations

import sys
from pathlib import Path
import math
from typing import Any, Dict, List, Optional, Set
import networkx as nx
from pyvis.network import Network

# Robust project-root resolution: ensure TraceMesh_Final is at sys.path[0]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from shared.models import RingCandidate


def get_risk_color(score: float) -> str:
    """Return color hex according to risk score tiers."""
    if score >= 0.50:
        return "#E63946"  # Red: High risk
    elif score >= 0.25:
        return "#F77F00"  # Orange: Medium risk
    elif score > 0.0:
        return "#2A9D8F"  # Green: Low risk
    return "#6C757D"      # Grey: Unscored / Neutral


def get_role_color(role: str) -> str:
    """Return color hex according to forensic ring role."""
    role_colors = {
        "victim": "#457B9D",     # Steel Blue
        "collector": "#F4A261",  # Sandy Orange
        "mule": "#E76F51",       # Coral Red
        "cash_out": "#9B2226",   # Crimson
    }
    return role_colors.get(role.lower(), "#6C757D")


def render_pyvis_network(
    subgraph: nx.MultiDiGraph,
    account_scores: Optional[Dict[str, float]] = None,
    ring: Optional[RingCandidate] = None,
    highlight_nodes: Optional[Set[str]] = None,
    highlight_edges: Optional[Set[str]] = None,
    height: str = "600px",
) -> str:
    """Convert a NetworkX MultiDiGraph into an interactive PyVis HTML string."""
    account_scores = account_scores or {}
    highlight_nodes = highlight_nodes or set()
    highlight_edges = highlight_edges or set()

    net = Network(height=height, width="100%", directed=True, notebook=False)
    net.toggle_physics(True)

    # Physics settings for smooth layout without aggressive jitter
    net.set_options("""
    {
      "physics": {
        "barnesHut": {
          "gravitationalConstant": -3000,
          "centralGravity": 0.3,
          "springLength": 120,
          "springConstant": 0.04,
          "damping": 0.09
        },
        "minVelocity": 0.75
      },
      "edges": {
        "smooth": {
          "type": "cubicBezier",
          "forceDirection": "none",
          "roundness": 0.15
        },
        "arrows": {
          "to": {"enabled": true, "scaleFactor": 0.75}
        }
      },
      "interaction": {
        "hover": true,
        "navigationButtons": true,
        "zoomView": true
      }
    }
    """)

    # Add Nodes
    for node, data in subgraph.nodes(data=True):
        score = account_scores.get(str(node), 0.0)
        acc_type = data.get("account_type", "Account")
        city = data.get("city", "N/A")

        if ring and str(node) in ring.roles:
            role = ring.roles[str(node)]
            color = get_role_color(role)
            title = f"<b>Account: {node}</b><br>Role: <b>{role.upper()}</b><br>Ring: {ring.ring_id}<br>Risk Score: {score:.2f}<br>Type: {acc_type}<br>City: {city}"
            label = f"{node}\n[{role}]"
        else:
            color = get_risk_color(score)
            tier = "High" if score >= 0.5 else ("Medium" if score >= 0.25 else ("Low" if score > 0 else "Unscored"))
            title = f"<b>Account: {node}</b><br>Risk: <b>{tier} ({score:.2f})</b><br>Type: {acc_type}<br>City: {city}"
            label = str(node)

        is_highlighted = str(node) in highlight_nodes
        border_color = "#FFFF00" if is_highlighted else color
        border_width = 3 if is_highlighted else 1
        size = 22 if is_highlighted else (18 if score >= 0.5 else 14)

        net.add_node(
            str(node),
            label=label,
            title=title,
            color={"background": color, "border": border_color, "highlight": {"border": "#FFFF00", "background": color}},
            borderWidth=border_width,
            size=size,
            font={"color": "#FFFFFF", "size": 11, "strokeWidth": 2, "strokeColor": "#000000"},
        )

    # Add Directed Edges
    for u, v, k, d in subgraph.edges(keys=True, data=True):
        amt = float(d.get("amount", 0.0))
        ts = str(d.get("timestamp", ""))
        channel = str(d.get("channel", "N/A"))
        t_id = str(d.get("transaction_id", k))

        # Scale width by log10 of amount
        width = max(1.5, min(7.0, math.log10(max(amt, 10.0)) * 1.2))
        is_edge_hl = t_id in highlight_edges
        edge_color = "#FFFF00" if is_edge_hl else ("#E63946" if amt >= 10000 else "#8D99AE")

        title = f"<b>Txn: {t_id}</b><br>Amount: <b>INR {amt:,.2f}</b><br>Time: {ts}<br>Channel: {channel}<br>{u} -> {v}"

        net.add_edge(
            str(u),
            str(v),
            title=title,
            value=width,
            color=edge_color,
            width=width,
        )

    return net.generate_html()
