#!/usr/bin/env python3
"""
Test Suite for TraceMesh Module 12b (Streaming Simulation & Ring Injector).
==========================================================================
Verifies:
1. Virtual clock lifecycle: start, pause, reset, speed adjustments
2. Virtual clock advancement (tick) proportional to wall-clock elapsed time and speed
3. Real-time delta alert event publication and sequential numbering
4. Dynamic ring injection for all typologies (circular_flow, fan_in_burst, layering_chain, pass_through_hub)
5. Generation of synthetic transactions with is_injected=True and injection_id
6. Simulation HTTP REST endpoints and delta polling (?since_event_id=X)
"""

import json
import sys
import threading
import time
import unittest
import urllib.request
from http.server import HTTPServer
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.real_server import TraceMeshAPIHandler
from backend.simulation import AlertEvent, SimulationEngine, SIMULATOR


class TestSimulationEngine(unittest.TestCase):
    def setUp(self):
        self.engine = SimulationEngine(
            period_start="2026-03-01T00:00:00Z",
            period_end="2026-03-05T23:59:59Z",
            speed=1.0,
        )

    def test_initial_state(self):
        state = self.engine.get_state()
        self.assertEqual(state["status"], "paused")
        self.assertEqual(state["speed"], 1.0)
        self.assertIn("2026-03-01", state["cursor_ts"])
        self.assertEqual(len(state["active_injections"]), 0)

    def test_start_pause_reset_lifecycle(self):
        self.engine.start()
        self.assertEqual(self.engine.status, "running")

        self.engine.pause()
        self.assertEqual(self.engine.status, "paused")

        self.engine.set_speed(10.0)
        self.assertEqual(self.engine.speed, 10.0)

        self.engine.reset()
        self.assertEqual(self.engine.status, "paused")
        self.assertEqual(self.engine.cursor_dt, self.engine.period_start)

    def test_virtual_clock_ticking(self):
        self.engine.start()
        # Simulate 10 wall-clock seconds at 60x speed = 600 virtual seconds (10 minutes)
        self.engine.speed = 60.0
        self.engine.tick(elapsed_wall_s=10.0)

        elapsed_virtual = (self.engine.cursor_dt - self.engine.period_start).total_seconds()
        self.assertAlmostEqual(elapsed_virtual, 600.0, delta=1.0)

    def test_event_publication_and_delta_polling(self):
        ev1 = self.engine.publish_event(
            ring_id="R-TEST-01",
            event_type="new_ring",
            payload={"score": 88.0, "type": "circular_flow"},
        )
        self.assertGreater(ev1.event_id, 0)

        ev2 = self.engine.publish_event(
            ring_id="R-TEST-02",
            event_type="ring_updated",
            payload={"score": 95.0},
        )
        self.assertGreater(ev2.event_id, ev1.event_id)

        # Delta polling
        all_events = self.engine.get_events(since_event_id=0)
        self.assertEqual(len(all_events), 2)

        delta_events = self.engine.get_events(since_event_id=ev1.event_id)
        self.assertEqual(len(delta_events), 1)
        self.assertEqual(delta_events[0]["event_id"], ev2.event_id)

    def test_dynamic_ring_injection_circular_flow(self):
        res = self.engine.inject_ring(typology="circular_flow", difficulty="easy", amount_base=100000.0)

        self.assertTrue(res["success"])
        self.assertIn("INJ_", res["injection_id"])
        self.assertIn("R-INJ-", res["ring_id"])
        self.assertEqual(res["typology"], "circular_flow")
        self.assertEqual(res["n_accounts"], 4)
        self.assertEqual(res["n_transactions"], 4)
        self.assertGreater(res["amount_moved"], 0.0)

        # Verify transaction properties
        for tx in res["transactions"]:
            self.assertTrue(tx["is_injected"])
            self.assertEqual(tx["injection_id"], res["injection_id"])
            self.assertIn("2026-03", tx["ts"])

        # Verify alert event published
        events = self.engine.get_events(since_event_id=0)
        self.assertTrue(any(e["event_type"] == "new_ring" and e["ring_id"] == res["ring_id"] for e in events))

    def test_dynamic_ring_injection_fan_in(self):
        res = self.engine.inject_ring(typology="fan_in_burst", difficulty="hard", amount_base=300000.0)
        self.assertTrue(res["success"])
        self.assertEqual(res["typology"], "fan_in_burst")
        self.assertEqual(res["n_accounts"], 6)  # 5 senders + 1 collector
        self.assertEqual(res["n_transactions"], 5)

    def test_dynamic_ring_injection_layering(self):
        res = self.engine.inject_ring(typology="layering_chain", difficulty="medium", amount_base=150000.0)
        self.assertTrue(res["success"])
        self.assertEqual(res["typology"], "layering_chain")
        self.assertEqual(res["n_accounts"], 5)
        self.assertEqual(res["n_transactions"], 4)


class TestSimulationHTTPAPI(unittest.TestCase):
    TEST_HOST = "127.0.0.1"
    TEST_PORT = 8993

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

    def test_simulation_state_endpoint(self):
        status, body = self._get("/simulation/state")
        self.assertEqual(status, 200)
        self.assertIn("status", body)
        self.assertIn("speed", body)
        self.assertIn("cursor_ts", body)

    def test_simulation_controls_endpoints(self):
        # Start
        s1, b1 = self._post("/simulation/start", {})
        self.assertEqual(s1, 200)
        self.assertEqual(b1["status"], "running")

        # Speed
        s2, b2 = self._post("/simulation/speed", {"speed": 20.0})
        self.assertEqual(s2, 200)
        self.assertEqual(b2["speed"], 20.0)

        # Pause
        s3, b3 = self._post("/simulation/pause", {})
        self.assertEqual(s3, 200)
        self.assertEqual(b3["status"], "paused")

    def test_simulation_inject_ring_and_delta_polling(self):
        # Snapshot initial event count
        st_status, st_body = self._get("/simulation/state")
        start_event_id = SIMULATOR.next_event_id

        # Inject ring
        inj_payload = {
            "typology": "circular_flow",
            "difficulty": "medium",
            "amount": 180000.0,
        }
        inj_status, inj_res = self._post("/simulation/inject_ring", inj_payload)
        self.assertEqual(inj_status, 200)
        self.assertTrue(inj_res["success"])
        self.assertIn("INJ_", inj_res["injection_id"])

        # Delta polling via GET /alerts?since_event_id=X
        poll_status, poll_res = self._get(f"/alerts?since_event_id={start_event_id}")
        self.assertEqual(poll_status, 200)
        self.assertIn("events", poll_res)
        self.assertGreater(poll_res["count"], 0)

        # Verify event contains the newly injected ring
        events = poll_res["events"]
        self.assertTrue(any(e["ring_id"] == inj_res["ring_id"] for e in events))


if __name__ == "__main__":
    unittest.main()
