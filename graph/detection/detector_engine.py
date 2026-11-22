"""
Detector Engine Orchestrator.
Orchestrates execution of the 6 rule detectors and computes per-account rule scores (0-1).
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any, Dict, List, Optional, Set
import networkx as nx
import pandas as pd

from graph.config.graph_config import GRAPH_CONFIG
from graph.detection.fan_in import FanInDetector
from graph.detection.fan_out import FanOutDetector
from graph.detection.rapid_pass_through import RapidPassThroughDetector
from graph.detection.layering import LayeringChainDetector
from graph.detection.circular_flow import CircularFlowDetector
from graph.detection.dormant_activation import DormantActivationDetector
from graph.shared.constants import (
    ALL_DETECTOR_CODES,
    DETECTOR_CIRCULAR,
    DETECTOR_DORMANT,
    DETECTOR_FAN_IN,
    DETECTOR_FAN_OUT,
    DETECTOR_LAYERING,
    DETECTOR_PASS_THROUGH,
)
from graph.shared.schemas import DetectorHit

logger = logging.getLogger(__name__)


# Detector code to canonical SHAP weight mapping
DETECTOR_WEIGHTS = {
    DETECTOR_CIRCULAR: 0.35,
    DETECTOR_LAYERING: 0.30,
    DETECTOR_PASS_THROUGH: 0.25,
    DETECTOR_FAN_IN: 0.20,
    DETECTOR_FAN_OUT: 0.20,
    DETECTOR_DORMANT: 0.15,
}


class DetectorEngine:
    """Production detection engine orchestrating all 6 structural & behavioral detectors."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        cfg = config or GRAPH_CONFIG.get("detectors", {})
        self.fan_in_detector = FanInDetector(cfg.get("fan_in"))
        self.fan_out_detector = FanOutDetector(cfg.get("fan_out"))
        self.rapid_pass_through_detector = RapidPassThroughDetector(cfg.get("rapid_pass_through"))
        self.layering_detector = LayeringChainDetector(cfg.get("layering_chain"))
        self.circular_detector = CircularFlowDetector(cfg.get("circular_flow"))
        self.dormant_detector = DormantActivationDetector(cfg.get("dormant_activation"))

    def run_all(self, G: nx.MultiDiGraph) -> List[DetectorHit]:
        """Runs all 6 detectors on the graph and aggregates unique explainable hits."""
        logger.info("Executing DetectorEngine across %d nodes, %d edges...", len(G.nodes), len(G.edges))
        all_hits: List[DetectorHit] = []

        # 1. Circular Flow
        circ_hits = self.circular_detector.detect(G)
        logger.info("Circular Flow: %d hits", len(circ_hits))
        all_hits.extend(circ_hits)

        # 2. Rapid Pass-Through
        pt_hits = self.rapid_pass_through_detector.detect(G)
        logger.info("Rapid Pass-Through: %d hits", len(pt_hits))
        all_hits.extend(pt_hits)

        # 3. Layering Chain
        layer_hits = self.layering_detector.detect(G)
        logger.info("Layering Chain: %d hits", len(layer_hits))
        all_hits.extend(layer_hits)

        # 4. Fan-In Burst
        fi_hits = self.fan_in_detector.detect(G)
        logger.info("Fan-In Burst: %d hits", len(fi_hits))
        all_hits.extend(fi_hits)

        # 5. Fan-Out Split
        fo_hits = self.fan_out_detector.detect(G)
        logger.info("Fan-Out Split: %d hits", len(fo_hits))
        all_hits.extend(fo_hits)

        # 6. Dormant Activation
        da_hits = self.dormant_detector.detect(G)
        logger.info("Dormant Activation: %d hits", len(da_hits))
        all_hits.extend(da_hits)

        logger.info("DetectorEngine completed. Total hits: %d", len(all_hits))
        return all_hits

    def compute_account_rule_scores(
        self,
        hits: List[DetectorHit],
        all_account_ids: Optional[Set[str]] = None
    ) -> Dict[str, float]:
        """
        Computes normalized per-account rule score in [0.0, 1.0] from hits.
        Uses non-linear saturation so diverse pattern hits compound safely without exceeding 1.0.
        """
        account_scores: Dict[str, float] = {}
        if all_account_ids:
            for acct in all_account_ids:
                account_scores[acct] = 0.0

        hits_by_acct = defaultdict(list)
        for h in hits:
            hits_by_acct[h.account_id].append(h)

        for acct_id, acct_hits in hits_by_acct.items():
            raw_weight = sum(DETECTOR_WEIGHTS.get(h.code, 0.15) for h in acct_hits)
            # Add diversity bonus: accounts with multiple different detectors firing
            unique_codes = {h.code for h in acct_hits}
            diversity_multiplier = 1.0 + 0.15 * max(0, len(unique_codes) - 1)
            fused_score = min(1.0, raw_weight * diversity_multiplier)
            account_scores[acct_id] = round(fused_score, 4)

        return account_scores
