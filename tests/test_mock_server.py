#!/usr/bin/env python3
"""
Test Suite for TraceMesh Module 2 Mock Server.
Verifies all 11 OpenAPI endpoints, response shapes, and state mutations.
Zero external dependencies (uses standard library http.client and unittest).
"""

import json
import threading
import time
import unittest
import urllib.request
import urllib.error
from http.server import HTTPServer
from pathlib import Path
import sys

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.mock_server import MockRequestHandler, STORE

TEST_HOST = "127.0.0.1"
TEST_PORT = 8899

class TestMockServer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Reset store fixtures
        STORE.load_fixtures()

        # Start mock server on dedicated test port in a background daemon thread
        cls.server = HTTPServer((TEST_HOST, TEST_PORT), MockRequestHandler)
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        time.sleep(0.1)  # Brief warm-up

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def _get(self, path: str):
        url = f"http://{TEST_HOST}:{TEST_PORT}{path}"
        req = urllib.request.Request(url, method="GET")
        with self.opener.open(req) as response:
            status = response.status
            body = json.loads(response.read().decode("utf-8"))
            return status, body

    def _post(self, path: str, payload: dict):
        url = f"http://{TEST_HOST}:{TEST_PORT}{path}"
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, method="POST", headers={"Content-Type": "application/json"})
        with self.opener.open(req) as response:
            status = response.status
            body = json.loads(response.read().decode("utf-8"))
            return status, body

    # 1. Health check
    def test_01_health_check(self):
        status, body = self._get("/health")
        self.assertEqual(status, 200)
        self.assertEqual(body.get("status"), "healthy")
        self.assertEqual(body.get("service"), "TraceMesh Mock API Server")

    # 2. Alerts endpoint
    def test_02_get_alerts_all(self):
        status, alerts = self._get("/alerts")
        self.assertEqual(status, 200)
        self.assertIsInstance(alerts, list)
        self.assertGreaterEqual(len(alerts), 7)

        # Check required fields on first alert
        first = alerts[0]
        for field in ["ring_id", "fingerprint", "ring_type", "score", "priority", "amount_moved", "status"]:
            self.assertIn(field, first, f"Missing field {field}")

    def test_03_get_alerts_filtering(self):
        status, filtered = self._get("/alerts?status=new")
        self.assertEqual(status, 200)
        for a in filtered:
            self.assertEqual(a["status"], "new")

        status, filtered_type = self._get("/alerts?ring_type=structural_cycle")
        self.assertEqual(status, 200)
        for a in filtered_type:
            self.assertEqual(a["ring_type"], "structural_cycle")

    # 3. Ring Graph endpoint
    def test_04_get_ring_graph_all_typologies(self):
        for ring_id in ["R-101", "R-102", "R-103", "R-104", "R-105", "R-106", "R-107"]:
            status, ring = self._get(f"/rings/{ring_id}")
            self.assertEqual(status, 200, f"Failed for {ring_id}")
            self.assertEqual(ring["ring_id"], ring_id)
            self.assertIn("nodes", ring)
            self.assertIn("edges", ring)
            self.assertGreater(len(ring["nodes"]), 0)

    # 4. Ring Timeline endpoint
    def test_05_get_ring_timeline(self):
        status, timeline = self._get("/rings/R-104/timeline")
        self.assertEqual(status, 200)
        self.assertIsInstance(timeline, list)
        self.assertGreater(len(timeline), 0)
        for event in timeline:
            self.assertIn("txn_id", event)
            self.assertIn("progress", event)
            self.assertIn("amount", event)

    # 5. Account Detail endpoint
    def test_06_get_account_detail(self):
        status, acc = self._get("/accounts/ACC_MULE_401")
        self.assertEqual(status, 200)
        self.assertEqual(acc["account_id"], "ACC_MULE_401")
        self.assertIn("risk_score", acc)
        self.assertIn("reason_codes", acc)
        self.assertIn("detector_hits", acc)

    # 6. Case Actions & Audit Trail
    def test_07_post_action_and_audit(self):
        # Freeze R-104
        payload = {
            "action": "freeze",
            "actor": "Lead_Analyst_Kishore",
            "note": "Urgent debit-freeze on circular loop."
        }
        status, res = self._post("/rings/R-104/action", payload)
        self.assertEqual(status, 200)
        self.assertIn("alert", res)
        self.assertIn("action", res)
        self.assertEqual(res["alert"]["status"], "frozen")
        self.assertEqual(res["action"]["action"], "freeze")

        # Verify audit history
        case_id = res["alert"]["case_id"]
        status, actions = self._get(f"/cases/{case_id}/actions")
        self.assertEqual(status, 200)
        self.assertIsInstance(actions, list)
        recent_action = actions[-1]
        self.assertEqual(recent_action["actor"], "Lead_Analyst_Kishore")
        self.assertEqual(recent_action["action"], "freeze")

    # 7. Metrics endpoint
    def test_08_get_metrics(self):
        status, metrics = self._get("/metrics")
        self.assertEqual(status, 200)
        self.assertIn("overall", metrics)
        self.assertIn("comparison", metrics)
        self.assertIn("curves", metrics)
        self.assertIn("alert_reduction", metrics)
        self.assertEqual(metrics["overall"]["pr_auc"], 0.942)
        self.assertEqual(metrics["alert_reduction"]["reduction_pct"], 97.8)

    # 8. Overview endpoint
    def test_09_get_overview(self):
        status, overview = self._get("/overview")
        self.assertEqual(status, 200)
        self.assertIn("kpis", overview)
        self.assertIn("rings", overview)
        self.assertIn("alertVolume", overview)
        self.assertIn("activity", overview)

    # 9. Simulation controls
    def test_10_simulation_workflow(self):
        # Check initial state
        status, state = self._get("/simulation/state")
        self.assertEqual(status, 200)
        self.assertIn("status", state)

        # Start simulation
        status, state = self._post("/simulation/start", {})
        self.assertEqual(status, 200)
        self.assertEqual(state["status"], "running")

        # Set speed
        status, state = self._post("/simulation/speed", {"speed": 5})
        self.assertEqual(status, 200)
        self.assertEqual(state["speed"], 5)

        # Pause simulation
        status, state = self._post("/simulation/pause", {})
        self.assertEqual(status, 200)
        self.assertEqual(state["status"], "paused")

        # Inject ring
        status, inj = self._post("/simulation/inject_ring", {"ring_type": "structural_cycle", "difficulty": "hard"})
        self.assertEqual(status, 200)
        self.assertTrue(inj["success"])
        self.assertIn("injected_ring_id", inj)

        # Verify new alert appears in alert queue
        status, alerts = self._get("/alerts")
        alert_ids = [a["ring_id"] for a in alerts]
        self.assertIn(inj["injected_ring_id"], alert_ids)


if __name__ == "__main__":
    unittest.main()
