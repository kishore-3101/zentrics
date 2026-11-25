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
        self.assertFalse(vic.get("is_frozen", False))

        # 2. Every mule account in the syndicate must be blocked & frozen!
        mules = [e for e in eval_res["entities"] if e["account_id"] != "ACC_TEST_VIC_01"]
        self.assertEqual(len(mules), 4)
        for m in mules:
            self.assertTrue(m.get("is_blocked", False), f"Mule {m['account_id']} should be blocked")
            self.assertTrue(m.get("is_frozen", False), f"Mule {m['account_id']} should be frozen")

        # 3. Containment should be decided dynamically by engine
        blocked_info = eval_res["blocked_info"]
        self.assertIsNotNone(blocked_info)
        self.assertTrue(blocked_info["is_blocked"])
        self.assertIn("Autonomous AI Shield Freeze", blocked_info["blocked_reason"])
        self.assertIn("XGBoost ML Confidence", blocked_info["blocked_reason"])

        # 4. Outflow from frozen account must be intercepted & blocked on final cash-out!
        txns = eval_res["transactions"]
        hop4 = next(t for t in txns if t["hop_index"] == 4)
        self.assertTrue(hop4["is_blocked"])
        self.assertEqual(hop4["status"], "blocked")

        # 5. Executed edges must have all 4 hops with hop 4 blocked so UI can animate and render the route!
        self.assertEqual(len(eval_res["edges"]), 4)
        self.assertEqual(eval_res["amount_cashed"], 0.0)
        self.assertEqual(eval_res["amount_saved"], 750000.0)

        # 6. Test mock store inject_ring returns dynamic evaluation
        mock_res = STORE.inject_ring(payload)
        self.assertTrue(mock_res["success"])
        self.assertIn("detection_results", mock_res)
        self.assertIn("detected_ml_prob", mock_res["detection_results"])

    def test_custom_simulation_settings_and_cities(self):
        # Scenario with customized cities: Chennai -> Mumbai -> Dubai -> Singapore -> Ahmedabad
        custom_payload = {
            "scenario_name": "Offshore Trade Smurfing Loop",
            "total_amount": 1850000.0,
            "channel": "NEFT",
            "typology": "circular_flow",
            "victim": {
                "account_id": "ACC_VIC_CHENNAI",
                "name": "Sundararajan Corp",
                "city": "Chennai",
                "latitude": 13.0827,
                "longitude": 80.2707,
            },
            "hacker": {
                "account_id": "ACC_HACK_MUMBAI",
                "name": "Operator Alpha",
                "city": "Mumbai",
                "latitude": 19.0760,
                "longitude": 72.8777,
            },
            "distributor": {
                "account_id": "ACC_DIST_DUBAI",
                "name": "Dubai Offshore Trading Co",
                "city": "Dubai",
                "latitude": 25.2048,
                "longitude": 55.2708,
            },
            "intermediator": {
                "account_id": "ACC_MULE_SINGAPORE",
                "name": "Lion City Conduit Pte",
                "city": "Singapore",
                "latitude": 1.3521,
                "longitude": 103.8198,
            },
            "cash_out": {
                "account_id": "ACC_SINK_AHMEDABAD",
                "name": "Bullion Exchange Terminal",
                "city": "Ahmedabad",
                "latitude": 23.0225,
                "longitude": 72.5714,
            },
            "block_policy": {
                "enabled": True,
                "blocked_target": "auto",
            },
        }

        eval_res = DETECTION_ENGINE.evaluate_scenario(custom_payload)
        self.assertTrue(eval_res["success"])
        self.assertEqual(eval_res["total_amount"], 1850000.0)

        # Confirm all 5 custom cities are preserved accurately
        cities = [e["city"] for e in eval_res["entities"]]
        self.assertEqual(cities, ["Chennai", "Mumbai", "Dubai", "Singapore", "Ahmedabad"])

        # Check that 3D positions exist for all nodes
        for ent in eval_res["entities"]:
            self.assertIn("position", ent)
            self.assertEqual(len(ent["position"]), 3)

        # Check transactions link the custom cities
        txns = eval_res["transactions"]
        self.assertEqual(len(txns), 4)
        self.assertEqual(txns[0]["src_city"], "Chennai")
        self.assertEqual(txns[0]["dst_city"], "Mumbai")
        self.assertEqual(txns[1]["src_city"], "Mumbai")
        self.assertEqual(txns[1]["dst_city"], "Dubai")


if __name__ == "__main__":
    unittest.main()
