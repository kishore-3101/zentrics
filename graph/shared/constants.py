"""
TraceMesh Graph Shared Constants.
"""

from typing import Dict, List

# Detection Hit Codes
DETECTOR_FAN_IN = "fan_in_burst"
DETECTOR_FAN_OUT = "fan_out_split"
DETECTOR_PASS_THROUGH = "rapid_pass_through"
DETECTOR_LAYERING = "layering_chain"
DETECTOR_CIRCULAR = "circular_flow"
DETECTOR_DORMANT = "dormant_activation"

ALL_DETECTOR_CODES = [
    DETECTOR_FAN_IN,
    DETECTOR_FAN_OUT,
    DETECTOR_PASS_THROUGH,
    DETECTOR_LAYERING,
    DETECTOR_CIRCULAR,
    DETECTOR_DORMANT,
]

# Account Roles
ROLE_VICTIM = "victim"
ROLE_COLLECTOR = "collector"
ROLE_MULE = "mule"
ROLE_CASH_OUT = "cash_out"

ALL_ROLES = [ROLE_VICTIM, ROLE_COLLECTOR, ROLE_MULE, ROLE_CASH_OUT]

# Ring Typologies
TYPOLOGY_CIRCULAR_FLOW = "circular_flow"
TYPOLOGY_FAN_IN_FAN_OUT = "fan_in_fan_out"
TYPOLOGY_RAPID_PASS_THROUGH = "rapid_pass_through"
TYPOLOGY_LAYERING_CHAIN = "layering_chain"
TYPOLOGY_DORMANT_ACTIVATION = "dormant_activation"
TYPOLOGY_COMPLEX_HYBRID = "complex_hybrid"

# Severity levels
SEVERITY_LOW = "low"
SEVERITY_MEDIUM = "medium"
SEVERITY_HIGH = "high"
SEVERITY_CRITICAL = "critical"
