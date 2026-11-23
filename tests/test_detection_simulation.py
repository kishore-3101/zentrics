"""
Test Autonomous ML Detection Engine Simulation Integration
==========================================================
Verifies that simulation runs evaluate transaction topology through
the Detection Engine and XGBoost model dynamically rather than using
hardcoded risk scores or static freeze targets.
"""

import unittest
from backend.detection_engine import DETECTION_ENGINE
from backend.mock_server import STORE
from backend.real_server import TraceMeshAPIHandler


class TestDetectionSimulation(unittest.TestCase):
    def test_dynamic_detection_evaluation(self):
        payload = {
            "scenario_name": "Dynamic Multi-Hop Smurfing Test",
            "total_amount": 750000.0,
            "channel": "IMPS",
            "typology": "layering_chain",
            "victim": {
                "account_id": "ACC_TEST_VIC_01",
                "name": "Aarav Gupta",
                "city": "Bengaluru",
                "latitude": 12.9716,
                "longitude": 77.5946,
            },
            "hacker": {
                "account_id": "ACC_TEST_HACK_02",
                "name": "Syndicate Collector",
                "city": "Jaipur",
                "latitude": 26.9124,
                "longitude": 75.7873,
                "device_type": "Kali Linux / Tor Proxy Node",
            },
            "distributor": {
                "account_id": "ACC_TEST_DIST_03",
                "name": "Syndicate Distributor",
                "city": "Delhi",
                "latitude": 28.6139,
                "longitude": 77.2090,
            },
            "intermediator": {
                "account_id": "ACC_TEST_MULE_04",
                "name": "Layering Mule Conduit",
                "city": "Kanpur",
                "latitude": 26.4499,
                "longitude": 80.3319,
            },
            "cash_out": {
                "account_id": "ACC_TEST_SINK_05",
                "name": "ATM Terminal Hub",
                "city": "Kolkata",
                "latitude": 22.5726,
                "longitude": 88.3639,
            },
            "block_policy": {
                "enabled": True,
            },
        }

        eval_res = DETECTION_ENGINE.evaluate_scenario(payload)
        self.assertTrue(eval_res["success"])
        self.assertEqual(len(eval_res["entities"]), 5)
        self.assertEqual(len(eval_res["transactions"]), 4)

        # 1. Victim must have minimal ML probability & not blocked
        vic = next(e for e in eval_res["entities"] if e["account_id"] == "ACC_TEST_VIC_01")
        self.assertLess(vic["ml_prob"], 0.20)
        self.assertFalse(vic.get("is_blocked", False))

        # 2. Containment should be decided dynamically by engine
        blocked_info = eval_res["blocked_info"]
        self.assertIsNotNone(blocked_info)
        self.assertTrue(blocked_info["is_blocked"])
        self.assertIn("Autonomous AI Shield Freeze", blocked_info["blocked_reason"])
        self.assertIn("XGBoost ML Confidence", blocked_info["blocked_reason"])

        # 3. Test mock store inject_ring returns dynamic evaluation
        mock_res = STORE.inject_ring(payload)
        self.assertTrue(mock_res["success"])
        self.assertIn("detection_results", mock_res)
        self.assertIn("detected_ml_prob", mock_res["detection_results"])


if __name__ == "__main__":
    unittest.main()
