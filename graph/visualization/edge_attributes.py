"""
Edge Attributes Decorator.
Computes Bezier curves, stroke weights, neon glows, and channel styling.
"""

from __future__ import annotations

import math
from typing import Any, Dict


def decorate_edge_visuals(edge_data: Dict[str, Any]) -> Dict[str, Any]:
    """Decorates transaction edge with stroke widths, neon glow, and channel styling."""
    amount = float(edge_data.get("amount", 1000.0))
    is_suspicious = edge_data.get("is_suspicious", True)

    # Stroke width logarithmic scaling: 1.0 to 5.0
    stroke_width = max(1.2, min(5.5, math.log10(max(amount, 100.0)) * 1.1))

    # Color
    if is_suspicious:
        color = "#00E69A" if amount > 500000 else "#EF4444" # Emerald flow or High-risk Red
    else:
        color = "#527565" # Muted green

    edge_data["stroke_width"] = round(stroke_width, 2)
    edge_data["color"] = color
    edge_data["neon_glow"] = is_suspicious
    return edge_data
