"""
Node Attributes Decorator.
Computes visual presentation attributes (size, glow, colors, 3D coordinates) matching TraceMesh Design System.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Tuple
from graph.shared.constants import (
    ROLE_CASH_OUT,
    ROLE_COLLECTOR,
    ROLE_MULE,
    ROLE_VICTIM,
)

# Canonical TraceMesh Design Palette
ROLE_COLORS = {
    ROLE_VICTIM: "#3B82F6",      # Blue / User shield
    ROLE_COLLECTOR: "#F59E0B",   # Amber / Orange aggregation point
    ROLE_MULE: "#EF4444",        # Crimson / High risk intermediary
    ROLE_CASH_OUT: "#A855F7",    # Purple / Terminal ATM sink
}


def decorate_node_visuals(
    node_data: Dict[str, Any],
    ring_type: str = "circular_flow",
    index: int = 0,
    total_nodes: int = 1
) -> Dict[str, Any]:
    """Decorates account node with 3D positions, radius, colors, and halo glows."""
    role = node_data.get("role", ROLE_MULE)
    risk = float(node_data.get("risk_score", 50.0))

    # Base size proportional to volume and risk
    base_radius = 0.8 + (risk / 100.0) * 0.7
    if role == ROLE_COLLECTOR:
        base_radius *= 1.3
    elif role == ROLE_CASH_OUT:
        base_radius *= 1.2

    # Color
    color = ROLE_COLORS.get(role, "#EF4444")

    # 3D Position Layout:
    # If circular flow, arrange in orbit
    if ring_type == "circular_flow":
        radius = 7.0
        angle = (index / max(total_nodes, 1)) * 2 * math.pi
        pos = [round(math.cos(angle) * radius, 2), round(math.sin(index * 1.5) * 1.2, 2), round(math.sin(angle) * radius, 2)]
    elif ring_type == "fan_in_fan_out":
        # Hierarchical tiered positioning
        if role == ROLE_VICTIM:
            pos = [-8.0, round((index - total_nodes / 2) * 2.0, 2), 0.0]
        elif role == ROLE_COLLECTOR:
            pos = [-2.0, 0.0, 0.0]
        elif role == ROLE_MULE:
            pos = [3.0, round((index - total_nodes / 2) * 2.0, 2), 0.0]
        else: # cash out
            pos = [8.0, round((index - total_nodes / 2) * 2.0, 2), 0.0]
    else:
        # Flow tier
        pos = [round((index - total_nodes / 2) * 3.5, 2), round(math.sin(index) * 2.0, 2), 0.0]

    node_data["color"] = color
    node_data["size"] = round(base_radius, 2)
    node_data["position"] = pos
    return node_data
