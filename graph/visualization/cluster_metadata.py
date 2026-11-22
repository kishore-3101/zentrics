"""
Cluster Metadata and Boundary Enclosure.
Computes bounding hull and cluster centroid coordinates for visual cluster grouping.
"""

from __future__ import annotations

from typing import Any, Dict, List


def compute_cluster_metadata(nodes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculates centroid, spatial bounding box, and dispersion radius for a ring cluster."""
    if not nodes:
        return {"centroid": [0, 0, 0], "radius": 5.0}

    positions = [n.get("position", [0, 0, 0]) for n in nodes]
    n_count = len(positions)

    cx = sum(p[0] for p in positions) / n_count
    cy = sum(p[1] for p in positions) / n_count
    cz = sum(p[2] for p in positions) / n_count

    max_dist = max(
        ((p[0] - cx)**2 + (p[1] - cy)**2 + (p[2] - cz)**2)**0.5
        for p in positions
    )

    return {
        "centroid": [round(cx, 2), round(cy, 2), round(cz, 2)],
        "radius": round(max(3.0, max_dist + 1.5), 2),
        "node_count": n_count,
    }
