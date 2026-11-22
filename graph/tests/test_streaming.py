import pytest
from datetime import datetime, timedelta
import networkx as nx

from graph.streaming.incremental_builder import IncrementalBuilder
from graph.streaming.sliding_window import SlidingWindowManager
from graph.streaming.event_processor import EventProcessor


def test_incremental_builder_and_deduplication():
    G = nx.MultiDiGraph()
    builder = IncrementalBuilder(G)

    base_ts = datetime(2026, 3, 10, 10, 0, 0)
    # Ingest new transaction
    is_new, affected = builder.ingest_transaction("TXN_01", "ACC_1", "ACC_2", 15000.0, base_ts)
    assert is_new is True
    assert "ACC_1" in affected and "ACC_2" in affected
    assert G.number_of_edges() == 1

    # Ingest duplicate transaction ID
    is_new2, affected2 = builder.ingest_transaction("TXN_01", "ACC_1", "ACC_2", 15000.0, base_ts)
    assert is_new2 is False
    assert G.number_of_edges() == 1


def test_sliding_window_expiration():
    G = nx.MultiDiGraph()
    builder = IncrementalBuilder(G)
    window_mgr = SlidingWindowManager(G, window_duration_minutes=60, edge_ttl_days=1)

    t0 = datetime(2026, 3, 1, 10, 0, 0)
    builder.ingest_transaction("OLD_TXN", "ACC_1", "ACC_2", 5000.0, t0)
    assert G.number_of_edges() == 1

    # Advance time by 3 days
    t_new = datetime(2026, 3, 4, 10, 0, 0)
    evicted, affected = window_mgr.advance_time(t_new)
    assert evicted == 1
    assert G.number_of_edges() == 0
