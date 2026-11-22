"""
Graph Serializer for API and Frontend Integration.
Converts in-memory RingCandidate and MultiDiGraph structures into typed JSON responses
matching OpenAPI 3.1 and frontend TypeScript models.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
import networkx as nx

from graph.shared.schemas import RingCandidate
from graph.visualization.cluster_metadata import compute_cluster_metadata
from graph.visualization.edge_attributes import decorate_edge_visuals
from graph.visualization.node_attributes import decorate_node_visuals

logger = logging.getLogger(__name__)


class GraphSerializer:
    """Serializes graph objects to strict JSON-compatible dicts."""

    @staticmethod
    def serialize_ring(ring: RingCandidate) -> Dict[str, Any]:
        """Serializes RingCandidate to GET /rings/{id} JSON schema."""
        nodes = ring.nodes or []
        edges = ring.edges or []

        # Decorate visuals
        decorated_nodes = []
        for idx, n in enumerate(nodes):
            decorated_nodes.append(
                decorate_node_visuals(dict(n), ring.ring_type, idx, len(nodes))
            )

        decorated_edges = []
        for e in edges:
            decorated_edges.append(decorate_edge_visuals(dict(e)))

        cluster_meta = compute_cluster_metadata(decorated_nodes)

        return {
            "ring_id": ring.ring_id,
            "fingerprint": ring.fingerprint,
            "ring_type": ring.ring_type,
            "score": round(ring.score, 1),
            "priority": round(ring.priority, 1),
            "amount_moved": round(ring.amount_moved, 2),
            "amount_cashed": round(ring.amount_cashed, 2),
            "amount_at_risk": round(ring.amount_at_risk, 2),
            "duration_min": round(ring.duration_min, 1),
            "status": ring.status,
            "detected_at": ring.detected_at or "2026-03-10T10:45:00Z",
            "pattern_tags": ring.pattern_tags,
            "explanation": ring.explanation,
            "cluster_metadata": cluster_meta,
            "nodes": decorated_nodes,
            "edges": decorated_edges,
        }

    @staticmethod
    def serialize_timeline(ring: RingCandidate) -> List[Dict[str, Any]]:
        """Serializes edges to GET /rings/{id}/timeline chronological replay schema."""
        edges = sorted(ring.edges or [], key=lambda e: e.get("ts", ""))
        if not edges:
            return []

        timeline_events = []
        n_edges = len(edges)
        for idx, edge in enumerate(edges):
            progress = round(idx / max(1, n_edges - 1), 2)
            timeline_events.append({
                "txn_id": edge.get("txn_id", ""),
                "ts": edge.get("ts", ""),
                "timestampMs": idx * 60000,
                "src_account": edge.get("src_account", ""),
                "dst_account": edge.get("dst_account", ""),
                "amount": float(edge.get("amount", 0.0)),
                "channel": edge.get("channel", "UPI"),
                "hop_index": idx + 1,
                "is_suspicious": edge.get("is_suspicious", True),
                "progress": progress,
            })
        return timeline_events
