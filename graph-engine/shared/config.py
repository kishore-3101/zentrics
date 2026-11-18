"""Configuration loader for TraceMesh."""

from __future__ import annotations

import os
from typing import Any, Dict, Optional
import yaml

DEFAULT_CONFIG: Dict[str, Any] = {
    "graph": {
        "required_account_columns": ["account_id"],
        "required_transaction_columns": [
            "transaction_id", "sender_account", "receiver_account",
            "amount", "timestamp", "transaction_status", "channel"
        ],
        "account_attributes": [
            "account_type", "account_open_date", "account_age_days",
            "kyc_status", "occupation", "city", "branch_id"
        ],
        "window_presets_minutes": {"10m": 10, "1h": 60, "24h": 1440, "7d": 10080},
        "known_sinks": []
    },
    "detectors": {
        "fan_in_burst": {
            "enabled": True,
            "window_minutes": 60,
            "min_senders": 5,
            "min_amount": 1000.0,
            "weight": 0.25
        },
        "fan_out_split": {
            "enabled": True,
            "window_minutes": 60,
            "min_recipients": 4,
            "min_amount": 1000.0,
            "inflow_lookback_minutes": 60,
            "weight": 0.25
        },
        "rapid_pass_through": {
            "enabled": True,
            "max_delay_minutes": 30,
            "min_forward_ratio": 0.80,
            "max_forward_ratio": 1.25,
            "min_amount": 500.0,
            "weight": 0.30
        },
        "layering_chain": {
            "enabled": True,
            "min_hops": 3,
            "max_hops": 6,
            "max_hop_delay_minutes": 60,
            "amount_tolerance": 0.20,
            "min_amount": 500.0,
            "weight": 0.30
        },
        "circular_flow": {
            "enabled": True,
            "min_cycle_length": 3,
            "max_cycle_length": 5,
            "max_cycle_duration_hours": 24,
            "amount_tolerance": 0.25,
            "weight": 0.35
        },
        "dormant_active": {
            "enabled": True,
            "dormant_days_threshold": 30,
            "min_recent_txns": 3,
            "volume_multiplier": 3.0,
            "weight": 0.20
        }
    },
    "scoring": {
        "method": "noisy_or",
        "severity_multipliers": {
            "low": 0.5,
            "medium": 0.75,
            "high": 1.0,
            "critical": 1.25
        }
    },
    "clustering": {
        "suspicious_score_threshold": 0.30,
        "min_ring_size": 3,
        "max_ring_size": 50,
        "community_algorithm": "louvain",
        "separate_shared_mules": True,
        "min_shared_mule_component_size": 3
    },
    "ring_scoring": {
        "weights": {
            "mean_risk": 0.35,
            "max_risk": 0.20,
            "amount_factor": 0.15,
            "speed_factor": 0.15,
            "pattern_diversity": 0.15
        },
        "action_thresholds": {
            "freeze_and_escalate": 80.0,
            "watchlist_review": 50.0,
            "monitor": 0.0
        }
    },
    "streaming": {
        "window_minutes": 60,
        "re_eval_neighborhood_hops": 2,
        "alert_score_threshold": 50.0,
        "high_priority_score_threshold": 80.0,
        "max_event_history": 10000
    }
}


def load_config(config_path_or_dict: Optional[Any] = None) -> Dict[str, Any]:
    """Load configuration from file path or dictionary, falling back to defaults."""
    if isinstance(config_path_or_dict, dict):
        cfg = DEFAULT_CONFIG.copy()
        _deep_update(cfg, config_path_or_dict)
        return cfg

    if config_path_or_dict and os.path.isfile(config_path_or_dict):
        try:
            with open(config_path_or_dict, "r", encoding="utf-8") as f:
                loaded = yaml.safe_load(f)
                if isinstance(loaded, dict):
                    cfg = DEFAULT_CONFIG.copy()
                    _deep_update(cfg, loaded)
                    return cfg
        except Exception as e:
            print(f"Warning: Failed to load config from {config_path_or_dict}: {e}. Using defaults.")

    # Try default config location
    default_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "detection_config.yaml")
    if os.path.isfile(default_path):
        try:
            with open(default_path, "r", encoding="utf-8") as f:
                loaded = yaml.safe_load(f)
                if isinstance(loaded, dict):
                    cfg = DEFAULT_CONFIG.copy()
                    _deep_update(cfg, loaded)
                    return cfg
        except Exception:
            pass

    return DEFAULT_CONFIG.copy()


def _deep_update(target: dict, source: dict) -> None:
    for k, v in source.items():
        if isinstance(v, dict) and k in target and isinstance(target[k], dict):
            _deep_update(target[k], v)
        else:
            target[k] = v
