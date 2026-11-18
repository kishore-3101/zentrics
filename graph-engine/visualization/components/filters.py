"""Reusable filter components for transaction graph navigation."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple
import networkx as nx
import pandas as pd

# Robust project-root resolution: ensure TraceMesh_Final is at sys.path[0]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
def extract_filtered_subgraph(
    graph: nx.MultiDiGraph,
    account_scores: Dict[str, float],
    min_amount: float = 0.0,
    risk_filter: str = "All",
    status_filter: str = "Success",
    max_nodes: int = 60,
    search_account: str = "",
) -> nx.MultiDiGraph:
    """Extract a filtered subgraph adhering to visual size limits to prevent browser freezing."""
    # 1. Candidate nodes matching search or risk criteria
    matching_nodes: Set[str] = set()

    search_term = search_account.strip().upper()
    if search_term:
        matching_nodes = {n for n in graph.nodes if search_term in n.upper()}
        # If search match found, include its 1-hop ego network
        ego_nodes = set(matching_nodes)
        for m in matching_nodes:
            ego_nodes.update(graph.predecessors(m))
            ego_nodes.update(graph.successors(m))
        matching_nodes = ego_nodes
    else:
        for n in graph.nodes:
            score = account_scores.get(str(n), 0.0)
            if risk_filter == "High Risk (>= 0.50)" and score >= 0.50:
                matching_nodes.add(n)
            elif risk_filter == "Medium & High (>= 0.25)" and score >= 0.25:
                matching_nodes.add(n)
            elif risk_filter == "All Scored (> 0.0)" and score > 0.0:
                matching_nodes.add(n)
            elif risk_filter == "All":
                if score > 0.0 or graph.degree(n) > 0:
                    matching_nodes.add(n)

    if not matching_nodes:
        # Fallback to top transacting accounts
        deg_sorted = sorted(graph.nodes, key=lambda n: graph.degree(n), reverse=True)
        matching_nodes = set(deg_sorted[:max_nodes])

    # Limit nodes to max_nodes
    if len(matching_nodes) > max_nodes:
        # Prioritize highest scored accounts first
        scored_matching = sorted(matching_nodes, key=lambda n: account_scores.get(str(n), 0.0), reverse=True)
        matching_nodes = set(scored_matching[:max_nodes])

    # Build induced subgraph
    sub = nx.MultiDiGraph()
    for n in matching_nodes:
        sub.add_node(n, **graph.nodes[n])

    for u in matching_nodes:
        for _, v, k, d in graph.out_edges(u, keys=True, data=True):
            if v in matching_nodes:
                amt = float(d.get("amount", 0.0))
                if amt >= min_amount:
                    sub.add_edge(u, v, key=k, **d)

    return sub
