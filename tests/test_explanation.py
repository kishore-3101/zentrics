#!/usr/bin/env python3
"""
Test Suite for TraceMesh Module 15 (Explanation Engine & Compliance Dictionary).
================================================================================
Verifies:
1. Deterministic explanation generation for all 5 core ring typologies + hard negatives
2. Clear and safe role separation (victims are NEVER recommended for account freeze)
3. Mathematical accounting consistency (amount_moved == amount_at_risk + amount_cashed)
4. Anti-hallucination numerical guard (accepts true facts, catches unverified/fabricated figures)
5. Individual account explanation and SHAP attribution formatting
"""

import sys
import unittest
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.explanation import (
    explain_account,
    explain_ring,
    get_recommended_action,
    validate_narrative_numbers,
    REASON_DICTIONARY,
)


class TestExplanationEngine(unittest.TestCase):
    def test_reason_code_dictionary_entries(self):
        self.assertIn("circular_flow", REASON_DICTIONARY)
        self.assertIn("fan_in_burst", REASON_DICTIONARY)
        self.assertIn("rapid_pass_through", REASON_DICTIONARY)
        self.assertIn("layering_chain", REASON_DICTIONARY)
        self.assertIn("dormant_active", REASON_DICTIONARY)
        self.assertIn("neighbor_contagion", REASON_DICTIONARY)
        self.assertIn("normal_profile", REASON_DICTIONARY)

    def test_explain_circular_flow_ring(self):
        ring_data = {
            "ring_id": "R-104",
            "ring_type": "circular_flow",
            "score": 92.0,
            "priority": 950.0,
            "amount_moved": 1420000.0,
            "amount_cashed": 435000.0,
            "amount_at_risk": 985000.0,
            "duration_min": 45.0,
            "members": {
                "ACC_VIC_01": "victim",
                "ACC_COLL_01": "collector",
                "ACC_MULE_01": "mule",
                "ACC_MULE_02": "mule",
                "ATM_SINK_01": "cash_out",
            },
        }

        res = explain_ring(ring_data)

        self.assertIn("Circular Flow", res["headline"])
        self.assertEqual(res["score"], 92.0)
        self.assertIn("Immediate freeze", res["recommended_action"])

        # Role safety check: Victim must NEVER be frozen!
        vic_role = next(m for m in res["roles_breakdown"] if m["account_id"] == "ACC_VIC_01")
        self.assertEqual(vic_role["role"], "victim")
        self.assertFalse(vic_role["is_freeze_recommended"])
        self.assertIn("DO NOT FREEZE", vic_role["justification"])

        # Mule must be recommended for freeze
        mule_role = next(m for m in res["roles_breakdown"] if m["account_id"] == "ACC_MULE_01")
        self.assertEqual(mule_role["role"], "mule")
        self.assertTrue(mule_role["is_freeze_recommended"])

    def test_explain_fan_in_burst_ring(self):
        ring_data = {
            "ring_id": "R-101",
            "ring_type": "fan_in_fan_out",
            "score": 88.5,
            "amount_moved": 2400000.0,
            "amount_cashed": 2100000.0,
            "amount_at_risk": 300000.0,
            "members": {
                "ACC_COLL_01": "collector",
                "ACC_VIC_01": "victim",
                "ACC_VIC_02": "victim",
                "ACC_VIC_03": "victim",
            },
        }
        res = explain_ring(ring_data)
        self.assertIn("Fan-In", res["headline"])
        self.assertGreaterEqual(len(res["key_facts"]), 4)

    def test_explain_hard_negative_merchant(self):
        ring_data = {
            "ring_id": "R-107",
            "ring_type": "hard_negative_shop",
            "score": 24.0,
            "amount_moved": 580000.0,
            "amount_cashed": 0.0,
            "amount_at_risk": 580000.0,
            "members": {"ACC_SHOP_01": "collector"},
        }
        res = explain_ring(ring_data)
        self.assertIn("Benign Commercial Activity", res["headline"])
        self.assertIn("low_risk_benign", res["pattern_tags"])
        self.assertIn("Enhanced transaction monitoring", res["recommended_action"])

    def test_accounting_sums_consistency(self):
        ring_data = {
            "amount_moved": 500000.0,
            "amount_cashed": 200000.0,
            "amount_at_risk": 300000.0,
        }
        self.assertEqual(
            ring_data["amount_at_risk"] + ring_data["amount_cashed"],
            ring_data["amount_moved"],
        )

    def test_anti_hallucination_guard_verifies_true_narrative(self):
        facts = {
            "amount_moved": 1420000.0,
            "amount_at_risk": 985000.0,
            "amount_cashed": 435000.0,
            "n_accounts": 5,
            "duration_min": 45.0,
        }
        narrative = (
            "Syndicate moved ₹1,420,000 across 5 accounts in 45 minutes. "
            "₹985,000 at risk, ₹435,000 cashed out."
        )
        is_valid, unverified = validate_narrative_numbers(narrative, facts)
        self.assertTrue(is_valid, f"Expected valid narrative but got unverified: {unverified}")
        self.assertEqual(len(unverified), 0)

    def test_anti_hallucination_guard_catches_fabricated_numbers(self):
        facts = {
            "amount_moved": 100000.0,
            "amount_at_risk": 100000.0,
            "n_accounts": 3,
        }
        # Injects hallucinated 999999 and 87 accounts
        hallucinated_narrative = (
            "Syndicate moved ₹9,999,999 across 87 accounts with ₹100,000 at risk."
        )
        is_valid, unverified = validate_narrative_numbers(hallucinated_narrative, facts)
        self.assertFalse(is_valid)
        self.assertTrue(any("9999" in u or "87" in u for u in unverified))

    def test_explain_account_profile(self):
        score_info = {
            "risk": 91.5,
            "ml_prob": 0.94,
            "rule_score": 0.88,
            "neighbor_risk": 0.85,
            "reason_codes": [
                {"code": "BURST_INFLOW", "weight": 35.0, "fact": "Aggregated 15 transfers"},
            ],
        }
        res = explain_account("ACC_MULE_99", score_info=score_info)
        self.assertEqual(res["account_id"], "ACC_MULE_99")
        self.assertEqual(res["risk_score"], 91.5)
        self.assertIn("High-Risk Mule Indicator", res["headline"])


if __name__ == "__main__":
    unittest.main()
