"""
TraceMesh / MuleNet - Native Vercel Serverless Python Function
==============================================================
Zero-dependency, high-performance Serverless Function for Vercel.
Handles all MuleNet backend requests:
- /health
- /alerts
- /rings, /rings/{id}, /rings/{id}/timeline, /rings/{id}/action
- /cases/{id}/actions
- /metrics, /overview
- /simulation/run, /simulation/inject_ring, /simulation/state, /simulation/start, /pause, /reset, /speed
"""

from __future__ import annotations

import json
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any, Dict
from urllib.parse import parse_qs, urlparse

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.detection_engine import DETECTION_ENGINE
from backend.mock_server import STORE


class handler(BaseHTTPRequestHandler):
    def end_headers(self):
        # Enable complete CORS for all Vercel domains
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, Accept")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def send_json(self, status_code: int, data: Any):
        body = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self) -> Dict[str, Any]:
        content_len = int(self.headers.get("Content-Length", 0))
        if content_len == 0:
            return {}
        try:
            raw = self.rfile.read(content_len).decode("utf-8")
            return json.loads(raw)
        except Exception:
            return {}

    def _normalize_path(self, raw_path: str) -> str:
        # Strip query parameters and optional leading '/api' prefix
        path = urlparse(raw_path).path.rstrip("/")
        if path.startswith("/api"):
            path = path[4:]
        if not path:
            path = "/"
        return path

    def do_GET(self):
        path = self._normalize_path(self.path)
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)

        if path in ("", "/"):
            self.send_json(HTTPStatus.OK, {
                "service": "MuleNet Financial Crime Detection Engine",
                "version": "2.0.0",
                "status": "online",
                "platform": "Vercel Serverless",
            })
            return

        if path == "/health":
            self.send_json(HTTPStatus.OK, {
                "status": "ok",
                "database": "online",
                "detection_engine": "active",
                "model": "XGBoost 63-Feature Calibrated Classifier",
                "platform": "Vercel Serverless",
            })
            return

        if path == "/alerts":
            with STORE.lock:
                alerts = list(STORE.alerts)
                st = qs.get("status", [None])[0]
                rt = qs.get("ring_type", [None])[0]
                if st:
                    alerts = [a for a in alerts if a.get("status") == st]
                if rt:
                    alerts = [a for a in alerts if a.get("ring_type") == rt]
                self.send_json(HTTPStatus.OK, alerts)
            return

        if path == "/overview":
            self.send_json(HTTPStatus.OK, STORE.get_overview())
            return

        if path == "/metrics":
            self.send_json(HTTPStatus.OK, STORE.get_metrics())
            return

        if path == "/cases":
            with STORE.lock:
                cases = [
                    {
                        "case_id": a.get("case_id", 100),
                        "ring_id": a["ring_id"],
                        "status": a.get("status", "new"),
                        "priority": a.get("priority", 80),
                        "assignee": a.get("assigned_to", "Autonomous AI Shield"),
                        "amount_moved": a.get("amount_moved", 500000),
                        "detected_at": a.get("detected_at"),
                    }
                    for a in STORE.alerts[:25]
                ]
                self.send_json(HTTPStatus.OK, cases)
            return

        if path.startswith("/cases/") and path.endswith("/actions"):
            parts = path.strip("/").split("/")
            if len(parts) == 3:
                try:
                    cid = int(parts[1])
                    self.send_json(HTTPStatus.OK, STORE.get_case_actions(cid))
                    return
                except ValueError:
                    pass

        if path == "/rings":
            with STORE.lock:
                self.send_json(HTTPStatus.OK, list(STORE.rings.values())[:50])
            return

        if path.startswith("/rings/") and path.endswith("/timeline"):
            parts = path.strip("/").split("/")
            if len(parts) == 3:
                rid = parts[1]
                self.send_json(HTTPStatus.OK, STORE.get_timeline(rid))
                return

        if path.startswith("/rings/"):
            rid = path.replace("/rings/", "").strip("/")
            ring = STORE.get_ring(rid)
            if ring:
                self.send_json(HTTPStatus.OK, ring)
            else:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": f"Ring '{rid}' not found"})
            return

        if path.startswith("/accounts/"):
            aid = path.replace("/accounts/", "").strip("/")
            acct = STORE.get_account(aid)
            if acct:
                self.send_json(HTTPStatus.OK, acct)
            else:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": f"Account '{aid}' not found"})
            return

        if path == "/simulation/state":
            self.send_json(HTTPStatus.OK, STORE.get_simulation_state())
            return

        self.send_json(HTTPStatus.NOT_FOUND, {"error": f"Not found: {path}"})

    def do_POST(self):
        path = self._normalize_path(self.path)
        payload = self.read_json_body()

        if path in ("/simulation/run", "/simulation/inject_ring", "/simulation/custom", "/simulation/simulate"):
            result = STORE.inject_ring(payload)
            self.send_json(HTTPStatus.OK, result)
            return

        if path == "/simulation/start":
            self.send_json(HTTPStatus.OK, STORE.start_simulation())
            return

        if path == "/simulation/pause":
            self.send_json(HTTPStatus.OK, STORE.pause_simulation())
            return

        if path == "/simulation/reset":
            self.send_json(HTTPStatus.OK, STORE.reset_simulation())
            return

        if path == "/simulation/speed":
            speed = float(payload.get("speed", 1.0))
            self.send_json(HTTPStatus.OK, STORE.set_simulation_speed(speed))
            return

        if path.startswith("/rings/") and path.endswith("/action"):
            parts = path.strip("/").split("/")
            if len(parts) == 3:
                rid = parts[1]
                result = STORE.apply_ring_action(rid, payload)
                self.send_json(HTTPStatus.OK, result)
                return

        self.send_json(HTTPStatus.NOT_FOUND, {"error": f"Not found: {path}"})
