"""
TraceMesh Graph Builder.
Constructs directed weighted timestamped NetworkX MultiDiGraph from accounts and transactions.
Provides time-windowed subgraphs, k-hop neighborhoods, and suspicious subgraph extraction.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple
import pandas as pd
import networkx as nx

from graph.construction.node_manager import NodeManager
from graph.construction.edge_manager import EdgeManager
from graph.shared.schemas import AccountNode, TransactionEdge
from graph.shared.utilities import parse_timestamp

logger = logging.getLogger(__name__)


class GraphBuilder:
    """Production Graph Builder for Financial Crime Intelligence."""

    def __init__(self):
        self.G = nx.MultiDiGraph()
        self.node_manager = NodeManager(self.G)
        self.edge_manager = EdgeManager(self.G)

    def build_from_dataframes(
        self,
        transactions_df: pd.DataFrame,
        accounts_df: Optional[pd.DataFrame] = None
    ) -> nx.MultiDiGraph:
        """Constructs the full financial multigraph from accounts and transactions dataframes."""
        logger.info("Initializing GraphBuilder...")
        if accounts_df is not None and not accounts_df.empty:
            self.node_manager.load_accounts_dataframe(accounts_df)
            logger.info("Loaded %d account nodes.", len(self.G.nodes))

        tx_count = self.edge_manager.load_transactions_dataframe(transactions_df)
        logger.info("Loaded %d transaction edges.", tx_count)

        self.node_manager.update_flow_metrics()
        logger.info("Updated flow metrics for %d nodes.", len(self.G.nodes))
        return self.G

    def get_time_window_subgraph(
        self,
        start_time: Any,
        end_time: Any
    ) -> nx.MultiDiGraph:
        """Returns a subgraph containing only transaction edges within [start_time, end_time]."""
        st = parse_timestamp(start_time)
        et = parse_timestamp(end_time)

        subG = nx.MultiDiGraph()
        # Copy relevant edges
        for u, v, key, data in self.G.edges(keys=True, data=True):
            edge_ts = data.get("timestamp")
            if edge_ts and (st is None or edge_ts >= st) and (et is None or edge_ts <= et):
                if not subG.has_node(u):
                    subG.add_node(u, **self.G.nodes[u])
                if not subG.has_node(v):
                    subG.add_node(v, **self.G.nodes[v])
                subG.add_edge(u, v, key=key, **data)
        return subG

    def get_k_hop_neighborhood(
        self,
        account_ids: Iterable[str],
        k: int = 1,
        direction: str = "both"
    ) -> nx.MultiDiGraph:
        """
        Extracts k-hop neighborhood subgraph around target account_ids.
        direction: 'in', 'out', or 'both'.
        """
        target_nodes = set(account_ids)
        current_layer = set(target_nodes)
        all_nodes = set(target_nodes)

        for _ in range(k):
            next_layer = set()
            for node in current_layer:
                if not self.G.has_node(node):
                    continue
                if direction in ("out", "both"):
                    for _, succ in self.G.out_edges(node):
                        if succ not in all_nodes:
                            next_layer.add(succ)
                if direction in ("in", "both"):
                    for pred, _ in self.G.in_edges(node):
                        if pred not in all_nodes:
                            next_layer.add(pred)
            all_nodes.update(next_layer)
            current_layer = next_layer

        return self.G.subgraph(all_nodes).copy()

    def get_suspicious_subgraph(
        self,
        suspicious_accounts: Iterable[str],
        include_1hop_counterparties: bool = True
    ) -> nx.MultiDiGraph:
        """
        Extracts the suspicious transaction subgraph composed of flagged accounts and optionally
        their 1-hop counterparties (victims and cash-out sinks).
        """
        susp_set = set(suspicious_accounts)
        if not include_1hop_counterparties:
            return self.G.subgraph(susp_set).copy()

        return self.get_k_hop_neighborhood(susp_set, k=1, direction="both")
