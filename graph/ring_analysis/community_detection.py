"""
Community Detection for Financial Transaction Graphs (Module 7 Deliverable).
Applies Louvain / modularity-based community detection on suspicious subgraphs.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Set
import networkx as nx

logger = logging.getLogger(__name__)


def detect_communities(
    G: nx.MultiDiGraph,
    weight_attribute: str = "amount",
    resolution: float = 1.0
) -> Dict[str, int]:
    """
    Detects modular communities among nodes in the graph using Louvain / modularity optimization.
    Converts multigraph to weighted undirected graph for modularity optimization.
    Returns: mapping of account_id -> community_id.
    """
    if len(G.nodes) == 0:
        return {}

    # Collapse MultiDiGraph to simple undirected weighted graph
    undirected_G = nx.Graph()
    for u, v, d in G.edges(data=True):
        if u == v:
            continue
        amt = float(d.get(weight_attribute, 1.0))
        if undirected_G.has_edge(u, v):
            undirected_G[u][v]["weight"] += amt
        else:
            undirected_G.add_edge(u, v, weight=amt)

    # Add isolated nodes
    for node in G.nodes:
        if not undirected_G.has_node(node):
            undirected_G.add_node(node)

    community_map: Dict[str, int] = {}

    try:
        # Prefer networkx.community.louvain_communities (available in NetworkX 3.0+)
        if hasattr(nx.community, "louvain_communities"):
            comms = nx.community.louvain_communities(
                undirected_G,
                weight="weight",
                resolution=resolution,
                seed=42
            )
            for cid, comm in enumerate(comms):
                for node in comm:
                    community_map[node] = cid
        else:
            # Fallback to greedy modularity
            comms = nx.community.greedy_modularity_communities(undirected_G, weight="weight")
            for cid, comm in enumerate(comms):
                for node in comm:
                    community_map[node] = cid
    except Exception as e:
        logger.warning("Community detection fallback to connected components: %s", e)
        # Fallback to connected components
        for cid, comp in enumerate(nx.connected_components(undirected_G)):
            for node in comp:
                community_map[node] = cid

    return community_map
