#!/usr/bin/env python3
"""
Test Suite for TraceMesh Module 11 (Pipeline Runner & Real API).
================================================================
Verifies:
1. Deterministic SHA1 fingerprint generation (order-independent)
2. Jaccard set-similarity calculations
3. Case Linking Engine (new case creation, deduplication at >= 0.60 overlap, distinct cases)
4. Full pipeline run on canonical toy dataset
5. Generation of transactional PostgreSQL execution scripts
6. Production API endpoints and case action audit trail
"""

import json
import subprocess
import sys
import threading
import time
import unittest
import urllib.request
from http.server import HTTPServer
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.case_linking import (
    CaseLinkingEngine,
    CaseRecord,
    compute_fingerprint,
    jaccard_similarity,
)
from backend.pipeline import PipelineRunner
from backend.real_server import TraceMeshAPIHandler


class TestCaseLinkingEngine(unittest.TestCase):
    def test_compute_fingerprint_deterministic_and_order_independent(self):
        fp1 = compute_fingerprint(["ACC_01", "ACC_02", "ACC_03"])
        fp2 = compute_fingerprint(["ACC_03", "ACC_01", "ACC_02"])
        self.assertEqual(fp1, fp2)
        self.assertEqual(len(fp1), 16)

    def test_jaccard_similarity_calculations(self):
        s1 = {"A", "B", "C"}
        s2 = {"A", "B", "C"}
        self.assertEqual(jaccard_similarity(s1, s2), 1.0)

        s3 = {"D", "E"}
        self.assertEqual(jaccard_similarity(s1, s3), 0.0)

        # 3 out of 5 in union
        s4 = {"A", "B", "C", "D"}
        s5 = {"A", "B", "C", "E"}
        # Intersection = {A,B,C} (3), Union = {A,B,C,D,E} (5) -> 3/5 = 0.60
        self.assertAlmostEqual(jaccard_similarity(s4, s5), 0.60, places=4)

    def test_case_linking_new_case_creation(self):
        engine = CaseLinkingEngine()
        res = engine.link_ring(
            ring_id="R-001-01",
            member_accounts=["ACC_A", "ACC_B", "ACC_C"],
            run_id=1,
            priority=85.0,
        )
        self.assertTrue(res["is_new_case"])
        self.assertEqual(res["case_id"], 1)
        self.assertEqual(res["status"], "new")

    def test_case_linking_deduplication_at_high_overlap(self):
        engine = CaseLinkingEngine()
        # Seed initial case
        res1 = engine.link_ring(
            ring_id="R-001-01",
            member_accounts=["ACC_1", "ACC_2", "ACC_3", "ACC_4", "ACC_5"],
            run_id=1,
            priority=50.0,
        )
        self.assertTrue(res1["is_new_case"])
        self.assertEqual(res1["case_id"], 1)

        # Second run discovers ring with 4 out of 5 members shared (4/6 = 0.667 >= 0.60)
        res2 = engine.link_ring(
            ring_id="R-002-01",
            member_accounts=["ACC_1", "ACC_2", "ACC_3", "ACC_4", "ACC_6"],
            run_id=2,
            priority=95.0,
        )
        self.assertFalse(res2["is_new_case"])
        self.assertEqual(res2["case_id"], 1)
        self.assertGreaterEqual(res2["jaccard_score"], 0.60)

    def test_case_linking_creates_distinct_case_at_low_overlap(self):
        engine = CaseLinkingEngine()
        res1 = engine.link_ring(
            ring_id="R-001-01",
            member_accounts=["ACC_1", "ACC_2", "ACC_3"],
            run_id=1,
        )
        self.assertEqual(res1["case_id"], 1)

        # Disjoint ring
        res2 = engine.link_ring(
            ring_id="R-001-02",
            member_accounts=["ACC_X", "ACC_Y", "ACC_Z"],
            run_id=1,
        )
        self.assertTrue(res2["is_new_case"])
        self.assertEqual(res2["case_id"], 2)


class TestPipelineRunner(unittest.TestCase):
    def setUp(self):
        self.toy_dir = PROJECT_ROOT / "data" / "toy"
        self.runner = PipelineRunner(dataset_path=self.toy_dir)

    def test_pipeline_execution_on_toy_dataset(self):
        res = self.runner.run(dataset_name="toy", run_id=1)

        self.assertEqual(res["run_id"], 1)
        self.assertEqual(res["n_accounts"], 10)
        self.assertEqual(res["n_txns"], 30)
        self.assertGreater(res["n_hits"], 0)
        self.assertGreater(res["n_rings"], 0)
        self.assertGreater(res["n_cases"], 0)

        # Verify candidate ring structure
        ring = self.runner.rings[0]
        self.assertIn("R-001", ring.ring_id)
        self.assertGreater(ring.amount_moved, 0.0)
        self.assertGreater(ring.score, 0.0)
        self.assertIn("mule", ring.members.values())

    def test_sql_transaction_generation(self):
        self.runner.run(dataset_name="toy", run_id=1)
        sql = self.runner.generate_pipeline_run_sql(run_id=1, dataset_id="toy", elapsed_s=0.05)

        self.assertIn("BEGIN;", sql)
        self.assertIn("INSERT INTO pipeline_runs", sql)
        self.assertIn("INSERT INTO detector_hits", sql)
        self.assertIn("INSERT INTO account_scores", sql)
        self.assertIn("INSERT INTO cases", sql)
        self.assertIn("INSERT INTO case_fingerprints", sql)
        self.assertIn("INSERT INTO rings", sql)
        self.assertIn("INSERT INTO ring_members", sql)
        self.assertIn("INSERT INTO ring_transactions", sql)
        self.assertIn("COMMIT;", sql)


class TestProductionAPI(unittest.TestCase):
    TEST_HOST = "127.0.0.1"
    TEST_PORT = 8991

    @classmethod
    def setUpClass(cls):
        cls.server = HTTPServer((cls.TEST_HOST, cls.TEST_PORT), TraceMeshAPIHandler)
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        time.sleep(0.1)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def _get(self, path: str):
        url = f"http://{self.TEST_HOST}:{self.TEST_PORT}{path}"
        req = urllib.request.Request(url, method="GET")
        with self.opener.open(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))

    def _post(self, path: str, payload: dict):
        url = f"http://{self.TEST_HOST}:{self.TEST_PORT}{path}"
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, method="POST", headers={"Content-Type": "application/json"})
        with self.opener.open(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))

    def test_api_health_endpoint(self):
        status, body = self._get("/health")
        self.assertEqual(status, 200)
        self.assertIn("status", body)
        self.assertIn("database", body)

    def test_api_alerts_endpoint(self):
        status, body = self._get("/alerts")
        self.assertEqual(status, 200)
        self.assertIsInstance(body, list)
        self.assertGreater(len(body), 0)

    def test_api_overview_endpoint(self):
        status, body = self._get("/overview")
        self.assertEqual(status, 200)
        self.assertIn("kpis", body)

    def test_api_ring_and_timeline_endpoints(self):
        status, ring = self._get("/rings/R-104")
        self.assertEqual(status, 200)
        self.assertEqual(ring["ring_id"], "R-104")
        self.assertIn("nodes", ring)
        self.assertIn("edges", ring)

        t_status, timeline = self._get("/rings/R-104/timeline")
        self.assertEqual(t_status, 200)
        self.assertIsInstance(timeline, list)
        self.assertGreater(len(timeline), 0)

    def test_api_ring_action_and_case_audit_trail(self):
        payload = {
            "action": "freeze",
            "note": "Freezing ring member accounts due to circular flow detection.",
            "actor": "senior_analyst_raj",
        }
        status, res = self._post("/rings/R-104/action", payload)
        self.assertEqual(status, 200)
        self.assertEqual(res["action"]["action"], "freeze")
        self.assertEqual(res["alert"]["status"], "frozen")

        # Verify audit history
        a_status, actions = self._get("/cases/104/actions")
        self.assertEqual(a_status, 200)
        self.assertIsInstance(actions, list)
        self.assertGreater(len(actions), 0)
        self.assertEqual(actions[-1]["action"], "freeze")


if __name__ == "__main__":
    unittest.main()
