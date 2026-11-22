import pytest
from datetime import datetime, timedelta
import networkx as nx

from graph.construction.edge_manager import EdgeManager
from graph.detection.detector_engine import DetectorEngine
from graph.detection.circular_flow import CircularFlowDetector
from graph.detection.fan_in import FanInDetector
from graph.detection.fan_out import FanOutDetector
from graph.detection.rapid_pass_through import RapidPassThroughDetector
from graph.detection.layering import LayeringChainDetector
from graph.detection.dormant_activation import DormantActivationDetector
from graph.shared.constants import (
    DETECTOR_CIRCULAR,
    DETECTOR_DORMANT,
    DETECTOR_FAN_IN,
    DETECTOR_FAN_OUT,
    DETECTOR_LAYERING,
    DETECTOR_PASS_THROUGH,
)


def test_circular_flow_detector():
    G = nx.MultiDiGraph()
    em = EdgeManager(G)
    base_ts = datetime(2026, 3, 10, 10, 0, 0)

    # 3-cycle: A -> B -> C -> A
    em.add_transaction_edge("T1", "A", "B", 10000.0, base_ts)
    em.add_transaction_edge("T2", "B", "C", 9800.0, base_ts + timedelta(minutes=10))
    em.add_transaction_edge("T3", "C", "A", 9500.0, base_ts + timedelta(minutes=20))

    detector = CircularFlowDetector()
    hits = detector.detect(G)

    assert len(hits) == 3
    hit_accounts = {h.account_id for h in hits}
    assert hit_accounts == {"A", "B", "C"}
    assert hits[0].code == DETECTOR_CIRCULAR


def test_rapid_pass_through_detector():
    G = nx.MultiDiGraph()
    em = EdgeManager(G)
    base_ts = datetime(2026, 3, 10, 10, 0, 0)

    # Inflow to MULE, forwarded within 10 minutes
    em.add_transaction_edge("T1", "VICTIM", "MULE", 50000.0, base_ts)
    em.add_transaction_edge("T2", "MULE", "SINK", 48000.0, base_ts + timedelta(minutes=10))

    detector = RapidPassThroughDetector()
    hits = detector.detect(G)

    assert len(hits) == 1
    assert hits[0].account_id == "MULE"
    assert hits[0].code == DETECTOR_PASS_THROUGH
    assert hits[0].evidence["pass_through_ratio"] >= 0.80


def test_fan_in_detector():
    G = nx.MultiDiGraph()
    em = EdgeManager(G)
    base_ts = datetime(2026, 3, 10, 10, 0, 0)

    # 5 distinct senders to COLLECTOR
    for i in range(5):
        em.add_transaction_edge(f"T{i}", f"SENDER_{i}", "COLLECTOR", 2000.0, base_ts + timedelta(minutes=i*5))

    detector = FanInDetector({"min_unique_senders": 5, "time_window_hours": 24, "min_amount": 100.0, "min_burst_volume": 5000.0})
    hits = detector.detect(G)

    assert len(hits) == 1
    assert hits[0].account_id == "COLLECTOR"
    assert hits[0].code == DETECTOR_FAN_IN


def test_fan_out_detector():
    G = nx.MultiDiGraph()
    em = EdgeManager(G)
    base_ts = datetime(2026, 3, 10, 10, 0, 0)

    # 4 distinct receivers from DISTRIBUTOR
    for i in range(4):
        em.add_transaction_edge(f"T{i}", "DISTRIBUTOR", f"RCV_{i}", 3000.0, base_ts + timedelta(minutes=i*5))

    detector = FanOutDetector({"min_unique_receivers": 4, "time_window_hours": 24, "min_amount": 100.0, "min_burst_volume": 5000.0})
    hits = detector.detect(G)

    assert len(hits) == 1
    assert hits[0].account_id == "DISTRIBUTOR"
    assert hits[0].code == DETECTOR_FAN_OUT
