"""
TraceMesh Graph Configuration.
Configurable thresholds, parameters, and time windows.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict


GRAPH_CONFIG = {
    # Detectors configuration
    "detectors": {
        "fan_in": {
            "min_unique_senders": 5,      # Tuned for high precision in transaction networks
            "time_window_hours": 24,       # Flexible window
            "min_amount": 100.0,
            "min_burst_volume": 1000.0,
        },
        "fan_out": {
            "min_unique_receivers": 4,
            "time_window_hours": 24,
            "min_amount": 100.0,
            "min_burst_volume": 1000.0,
        },
        "rapid_pass_through": {
            "pass_through_ratio": 0.80,    # Outflow / Inflow >= 80%
            "time_window_minutes": 60,     # Outflow within 60 minutes of inflow
            "min_amount": 500.0,
        },
        "layering_chain": {
            "min_hops": 3,
            "max_hops": 6,
            "amount_similarity_pct": 0.20, # ±20% amount decay/tolerance
            "max_hop_delay_minutes": 120,  # Max delay between consecutive hops
            "min_amount": 500.0,
        },
        "circular_flow": {
            "min_cycle_len": 3,
            "max_cycle_len": 5,
            "time_window_hours": 24,
            "amount_similarity_pct": 0.25, # Cycle amount decay tolerance
        },
        "dormant_activation": {
            "inactivity_days": 60,
            "volume_multiplier": 3.0,
            "min_reactivation_amount": 1000.0,
        },
    },

    # Ring analysis and clustering
    "ring_analysis": {
        "high_risk_threshold": 60.0,
        "medium_risk_threshold": 40.0,
        "min_ring_size": 3,
        "max_ring_size": 50,
        "resolution": 1.0,                 # Louvain resolution
        "separate_shared_mules": True,      # Separate shared mules via articulation points
    },

    # Financial Exposure Scoring
    "scoring": {
        "score_weight_mean_risk": 0.35,
        "score_weight_max_risk": 0.20,
        "score_weight_exposure": 0.25,
        "score_weight_velocity": 0.10,
        "score_weight_pattern_diversity": 0.10,
    },

    # Streaming & Sliding Window
    "streaming": {
        "window_duration_minutes": 1440,   # 24 hours sliding window
        "slide_step_minutes": 60,
        "edge_ttl_days": 7,
    },
}
