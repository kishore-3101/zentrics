"""
graph_builder.py – Constructs a directed transaction graph using NetworkX.
"""
import logging

import networkx as nx
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def build_graph(transactions: pd.DataFrame) -> nx.DiGraph:
    """
    Build a directed weighted graph from the transactions DataFrame.
    Nodes  = account IDs.
    Edges  = transactions; attributes: amount, ts.
    Only successful transactions are used for the main graph.
    """
    G = nx.DiGraph()

    # Use only valid rows
    txn = transactions.dropna(subset=["src_account", "dst_account", "amount"])

    # Optionally filter only successful transactions
    if "transaction_status" in txn.columns:
        txn = txn[txn["transaction_status"] != "Failed"]

    for _, row in txn.iterrows():
        src = row["src_account"]
        dst = row["dst_account"]
        amt = float(row["amount"])
        ts  = row["ts"] if pd.notna(row.get("ts")) else None

        if G.has_edge(src, dst):
            G[src][dst]["weight"]     += amt
            G[src][dst]["count"]      += 1
            G[src][dst]["amounts"].append(amt)
        else:
            G.add_edge(src, dst, weight=amt, count=1, amounts=[amt],
                       first_ts=ts, last_ts=ts)
        # Update last_ts
        if ts is not None and G[src][dst].get("last_ts") is not None:
            if ts > G[src][dst]["last_ts"]:
                G[src][dst]["last_ts"] = ts

    logger.info("Graph built: %d nodes, %d edges", G.number_of_nodes(), G.number_of_edges())
    return G


def compute_graph_features(G: nx.DiGraph, accounts: pd.DataFrame) -> pd.DataFrame:
    """
    Compute per-account graph-based features.
    Returns a DataFrame indexed by account_id.
    """
    if G.number_of_nodes() == 0:
        logger.warning("Empty graph – returning empty graph features.")
        return pd.DataFrame()

    logger.info("Computing PageRank…")
    try:
        pr = nx.pagerank(G, alpha=0.85, max_iter=200, tol=1e-6)
    except Exception as e:
        logger.warning("PageRank failed: %s. Using uniform.", e)
        pr = {n: 1.0 / G.number_of_nodes() for n in G.nodes()}

    # Betweenness centrality – expensive; use approximation for large graphs
    n_nodes = G.number_of_nodes()
    logger.info("Computing betweenness centrality (k=%d)…", min(500, n_nodes))
    try:
        k_bc = min(500, n_nodes)
        bc = nx.betweenness_centrality(G, k=k_bc, normalized=True, seed=42)
    except Exception as e:
        logger.warning("Betweenness failed: %s. Using zeros.", e)
        bc = {n: 0.0 for n in G.nodes()}

    rows = []
    for node in G.nodes():
        in_deg  = G.in_degree(node)
        out_deg = G.out_degree(node)
        total   = in_deg + out_deg

        in_nbrs  = list(G.predecessors(node))
        out_nbrs = list(G.successors(node))

        in_weight  = sum(G[u][node].get("weight", 0) for u in in_nbrs)
        out_weight = sum(G[node][v].get("weight", 0) for v in out_nbrs)

        fan_in_ratio  = in_deg  / max(total, 1)
        fan_out_ratio = out_deg / max(total, 1)

        rows.append({
            "account_id"           : node,
            "graph_in_degree"      : in_deg,
            "graph_out_degree"     : out_deg,
            "graph_total_degree"   : total,
            "graph_unique_in_nbrs" : len(in_nbrs),
            "graph_unique_out_nbrs": len(out_nbrs),
            "graph_fan_in_ratio"   : fan_in_ratio,
            "graph_fan_out_ratio"  : fan_out_ratio,
            "graph_in_weight"      : in_weight,
            "graph_out_weight"     : out_weight,
            "graph_pagerank"       : pr.get(node, 0.0),
            "graph_betweenness"    : bc.get(node, 0.0),
        })

    gf = pd.DataFrame(rows).set_index("account_id")

    # Short-cycle participation: simple triangles
    logger.info("Computing triangles…")
    try:
        undirected = G.to_undirected()
        triangles  = nx.triangles(undirected)
        gf["graph_triangles"] = gf.index.map(triangles).fillna(0)
    except Exception as e:
        logger.warning("Triangle computation failed: %s", e)
        gf["graph_triangles"] = 0

    # Community detection (Louvain via greedy modularity)
    logger.info("Computing communities…")
    try:
        undirected = G.to_undirected()
        communities = nx.community.greedy_modularity_communities(undirected)
        comm_map = {}
        for cid, comm in enumerate(communities):
            for node in comm:
                comm_map[node] = cid
        gf["graph_community_id"] = gf.index.map(comm_map).fillna(-1).astype(int)
    except Exception as e:
        logger.warning("Community detection failed: %s", e)
        gf["graph_community_id"] = -1

    gf = gf.reset_index()
    logger.info("Graph features computed for %d accounts.", len(gf))
    return gf
