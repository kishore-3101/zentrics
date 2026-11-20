"""
tests/test_graph_builder.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
import pytest
from src.graph_builder import build_graph, compute_graph_features


def make_txns():
    return pd.DataFrame({
        "src_account"       : ["A1", "A2", "A3"],
        "dst_account"       : ["A2", "A3", "A1"],
        "amount"            : [100.0, 200.0, 50.0],
        "ts"                : pd.to_datetime(["2024-01-01", "2024-01-01", "2024-01-01"]),
        "transaction_status": ["Success", "Success", "Success"],
    })


def make_accounts():
    return pd.DataFrame({"account_id": ["A1", "A2", "A3"]})


def test_graph_builds_correct_edges():
    G = build_graph(make_txns())
    assert G.number_of_edges() == 3
    assert G.has_edge("A1", "A2")


def test_graph_features_shape():
    G  = build_graph(make_txns())
    gf = compute_graph_features(G, make_accounts())
    assert len(gf) == 3
    assert "graph_pagerank" in gf.columns


def test_in_out_degree():
    G  = build_graph(make_txns())
    gf = compute_graph_features(G, make_accounts())
    gf = gf.set_index("account_id")
    assert gf.loc["A1", "graph_in_degree"] == 1
    assert gf.loc["A1", "graph_out_degree"] == 1


def test_empty_graph():
    df = pd.DataFrame(columns=["src_account", "dst_account", "amount", "ts"])
    G  = build_graph(df)
    assert G.number_of_nodes() == 0
