import pytest
from datetime import datetime
import pandas as pd
import networkx as nx

from graph.construction.graph_builder import GraphBuilder
from graph.construction.node_manager import NodeManager
from graph.construction.edge_manager import EdgeManager


def test_node_manager_add_and_enrich():
    G = nx.MultiDiGraph()
    mgr = NodeManager(G)
    mgr.add_or_update_node("ACC_TEST_01", account_type="savings", kyc_status="full", initial_balance=50000.0)

    assert G.has_node("ACC_TEST_01")
    node = mgr.get_node("ACC_TEST_01")
    assert node["kyc_status"] == "full"
    assert node["initial_balance"] == 50000.0


def test_edge_manager_multigraph_parallel_edges():
    G = nx.MultiDiGraph()
    mgr = EdgeManager(G)

    k1 = mgr.add_transaction_edge("TXN_01", "ACC_A", "ACC_B", 1000.0, "2026-03-10T10:00:00Z")
    k2 = mgr.add_transaction_edge("TXN_02", "ACC_A", "ACC_B", 2000.0, "2026-03-10T10:05:00Z")

    assert k1 is not None and k2 is not None
    assert G.number_of_edges() == 2
    assert G.has_edge("ACC_A", "ACC_B", key="TXN_01")
    assert G.has_edge("ACC_A", "ACC_B", key="TXN_02")


def test_graph_builder_from_dfs():
    accounts_df = pd.DataFrame([
        {"account_id": "ACC_1", "account_type": "savings", "kyc_status": "full", "initial_balance": 10000.0},
        {"account_id": "ACC_2", "account_type": "current", "kyc_status": "minimal", "initial_balance": 5000.0},
        {"account_id": "ACC_3", "account_type": "atm", "kyc_status": "minimal", "initial_balance": 0.0},
    ])
    txns_df = pd.DataFrame([
        {"transaction_id": "T1", "src_account": "ACC_1", "dst_account": "ACC_2", "amount": 2500.0, "ts": "2026-03-10T10:00:00Z"},
        {"transaction_id": "T2", "src_account": "ACC_2", "dst_account": "ACC_3", "amount": 2400.0, "ts": "2026-03-10T10:10:00Z"},
    ])

    builder = GraphBuilder()
    G = builder.build_from_dataframes(txns_df, accounts_df)

    assert G.number_of_nodes() == 3
    assert G.number_of_edges() == 2
    assert builder.node_manager.sink_accounts == {"ACC_3"}
    assert G.nodes["ACC_1"]["total_outgoing"] == 2500.0
    assert G.nodes["ACC_2"]["total_incoming"] == 2500.0
