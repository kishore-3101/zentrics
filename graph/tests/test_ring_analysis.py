import pytest
from datetime import datetime, timedelta
import networkx as nx

from graph.construction.edge_manager import EdgeManager
from graph.ring_analysis.community_detection import detect_communities
from graph.ring_analysis.role_assignment import assign_account_roles
from graph.ring_analysis.ring_extraction import RingExtractor
from graph.ring_analysis.financial_exposure import calculate_financial_exposure
from graph.shared.constants import ROLE_CASH_OUT, ROLE_COLLECTOR, ROLE_MULE, ROLE_VICTIM
from graph.shared.schemas import DetectorHit


def test_shared_mule_separation_articulation_points():
    """
    Test Module 7 Deliverable 2:
    Two rings sharing one mule are not wrongly merged into a single mega-ring.
    Ring 1: A -> B -> C -> A
    Ring 2: D -> E -> F -> D
    Shared bridge: C connected to D. C is an articulation point.
    """
    G = nx.MultiDiGraph()
    em = EdgeManager(G)
    base_ts = datetime(2026, 3, 10, 10, 0, 0)

    # Ring 1
    em.add_transaction_edge("T1", "A", "B", 10000.0, base_ts)
    em.add_transaction_edge("T2", "B", "C", 9800.0, base_ts + timedelta(minutes=5))
    em.add_transaction_edge("T3", "C", "A", 9500.0, base_ts + timedelta(minutes=10))

    # Shared connector
    em.add_transaction_edge("T_bridge", "C", "D", 5000.0, base_ts + timedelta(minutes=12))

    # Ring 2
    em.add_transaction_edge("T4", "D", "E", 4800.0, base_ts + timedelta(minutes=15))
    em.add_transaction_edge("T5", "E", "F", 4600.0, base_ts + timedelta(minutes=20))
    em.add_transaction_edge("T6", "F", "D", 4500.0, base_ts + timedelta(minutes=25))

    extractor = RingExtractor({"min_ring_size": 3, "separate_shared_mules": True})
    susp_accounts = {"A", "B", "C", "D", "E", "F"}
    hits = [
        DetectorHit("A", "circular_flow"),
        DetectorHit("B", "circular_flow"),
        DetectorHit("C", "circular_flow"),
        DetectorHit("D", "circular_flow"),
        DetectorHit("E", "circular_flow"),
        DetectorHit("F", "circular_flow"),
    ]
    risks = {acct: 85.0 for acct in susp_accounts}

    rings = extractor.extract_rings(G, susp_accounts, hits, risks)

    # Should separate into 2 rings!
    assert len(rings) == 2
    member_sets = [set(r.members) for r in rings]
    # C should be preserved in both or bridge safely
    assert any({"A", "B"}.issubset(s) for s in member_sets)
    assert any({"E", "F"}.issubset(s) for s in member_sets)


def test_role_assignment():
    G = nx.MultiDiGraph()
    em = EdgeManager(G)
    base_ts = datetime(2026, 3, 10, 10, 0, 0)

    # VICTIM -> COLLECTOR -> MULE -> CASH_OUT
    em.add_transaction_edge("T1", "V1", "COL1", 10000.0, base_ts)
    em.add_transaction_edge("T2", "COL1", "M1", 9500.0, base_ts + timedelta(minutes=5))
    em.add_transaction_edge("T3", "M1", "SINK1", 9000.0, base_ts + timedelta(minutes=10))

    hits = [DetectorHit("COL1", "fan_in_burst")]
    risks = {"V1": 20.0, "COL1": 85.0, "M1": 90.0, "SINK1": 50.0}
    cluster = {"V1", "COL1", "M1", "SINK1"}

    roles = assign_account_roles(cluster, G, hits, risks, sink_accounts={"SINK1"})

    assert roles["V1"] == ROLE_VICTIM
    assert roles["COL1"] == ROLE_COLLECTOR
    assert roles["M1"] == ROLE_MULE
    assert roles["SINK1"] == ROLE_CASH_OUT
