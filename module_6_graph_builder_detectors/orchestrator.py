"""Detector orchestration and explainable rule scoring for Module 6."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import networkx as nx
import pandas as pd

from shared.config import load_config
from shared.models import Hit
from module_6_graph_builder_detectors.detectors.fan_in_burst import detect_fan_in_burst
from module_6_graph_builder_detectors.detectors.fan_out_split import detect_fan_out_split
from module_6_graph_builder_detectors.detectors.rapid_pass_through import detect_rapid_pass_through
from module_6_graph_builder_detectors.detectors.layering_chain import detect_layering_chain
from module_6_graph_builder_detectors.detectors.circular_flow import detect_circular_flow
from module_6_graph_builder_detectors.detectors.dormant_activation import detect_dormant_activation


def run_detectors(
    graph: nx.MultiDiGraph,
    config: Optional[Dict[str, Any]] = None,
    daily_summary_df: Optional[pd.DataFrame] = None,
) -> List[Hit]:
    """Execute all configured rule detectors on the transaction multigraph.

    Returns a standardized list of Hit records.
    """
    cfg = load_config(config)

    all_hits: List[Hit] = []

    # 1. Fan-in burst
    all_hits.extend(detect_fan_in_burst(graph, cfg))

    # 2. Fan-out split
    all_hits.extend(detect_fan_out_split(graph, cfg))

    # 3. Rapid pass-through
    all_hits.extend(detect_rapid_pass_through(graph, cfg))

    # 4. Layering chain
    all_hits.extend(detect_layering_chain(graph, cfg))

    # 5. Circular flow
    all_hits.extend(detect_circular_flow(graph, cfg))

    # 6. Dormant activation
    all_hits.extend(detect_dormant_activation(graph, cfg, daily_summary_df=daily_summary_df))

    # Deduplicate identical hits
    unique_hits: List[Hit] = []
    seen = set()
    for h in all_hits:
        key = (h.account_id, h.code, str(h.window_start), str(h.window_end))
        if key not in seen:
            seen.add(key)
            unique_hits.append(h)

    return unique_hits


def rule_scores(
    hits: List[Hit],
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, float]:
    """Calculate normalized rule scores [0.0, 1.0] per account from detector hits.

    Uses an explainable Noisy-OR accumulation model to prevent runaway score inflation
    from multiple or duplicate hits while appropriately rewarding pattern diversity.
    """
    cfg = load_config(config)
    detector_cfgs = cfg.get("detectors", {})
    scoring_cfg = cfg.get("scoring", {})
    sev_multipliers = scoring_cfg.get("severity_multipliers", {
        "low": 0.5,
        "medium": 0.75,
        "high": 1.0,
        "critical": 1.25,
    })

    # Group hits by account
    account_hits: Dict[str, List[Hit]] = {}
    for h in hits:
        account_hits.setdefault(h.account_id, []).append(h)

    scores: Dict[str, float] = {}

    for acc_id, h_list in account_hits.items():
        # Noisy-OR combination: Score = 1 - prod(1 - P_i)
        complement_prob = 1.0

        for h in h_list:
            base_w = float(detector_cfgs.get(h.code, {}).get("weight", 0.25))
            sev_mult = float(sev_multipliers.get(h.severity, 1.0))
            p_i = min(0.95, base_w * sev_mult)
            complement_prob *= (1.0 - p_i)

        score = 1.0 - complement_prob
        scores[acc_id] = round(max(0.0, min(1.0, score)), 4)

    return scores
