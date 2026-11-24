#!/usr/bin/env python3
"""
TraceMesh Mock Server (Module 2)
================================
Provides a production-grade mock API server for TraceMesh dashboard development.
Serves full fixtures for all 5 mule ring typologies, mixed syndicates, and hard negatives.

Execution:
  Option A (Standard FastAPI/Uvicorn):
    uvicorn backend.mock_server:app --host 0.0.0.0 --port 8000 --reload

  Option B (Standalone Zero-Dependency Fallback):
    python3 backend/mock_server.py [--port 8000]
"""

from __future__ import annotations

import copy
import datetime
import json
import os
import sys
import threading
from http import HTTPStatus
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, unquote, urlparse

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    from backend.detection_engine import DETECTION_ENGINE
except ImportError:
    from detection_engine import DETECTION_ENGINE

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"

# -----------------------------------------------------------------------------
# In-Memory State Store (Mutable for live analyst actions & simulation controls)
# -----------------------------------------------------------------------------
class MockDataStore:
    def __init__(self):
        self.lock = threading.Lock()
        self.load_fixtures()

    def load_fixtures(self):
        with self.lock:
            # Load alerts
            with open(FIXTURES_DIR / "alerts.json", "r", encoding="utf-8") as f:
                self.alerts: List[Dict[str, Any]] = json.load(f)
            for a in self.alerts:
                if not a.get("fingerprint"):
                    a["fingerprint"] = f"fp_{a.get('ring_id', 'unknown').lower()}"
                if "amount_moved" not in a:
                    a["amount_moved"] = a.get("amount_at_risk", 0.0)
                if "amount_cashed" not in a:
                    a["amount_cashed"] = 0.0
                if "duration_min" not in a:
                    a["duration_min"] = 30.0
                if "n_accounts" not in a:
                    a["n_accounts"] = a.get("member_count", 3)
                if "n_victims" not in a:
                    a["n_victims"] = 1

            # Load rings
            with open(FIXTURES_DIR / "rings.json", "r", encoding="utf-8") as f:
                self.rings: Dict[str, Dict[str, Any]] = json.load(f)

            # Load timelines
            with open(FIXTURES_DIR / "timelines.json", "r", encoding="utf-8") as f:
                self.timelines: Dict[str, List[Dict[str, Any]]] = json.load(f)

            # Load accounts
            with open(FIXTURES_DIR / "accounts.json", "r", encoding="utf-8") as f:
                self.accounts: Dict[str, Dict[str, Any]] = json.load(f)

            # Load cases actions
            with open(FIXTURES_DIR / "cases_actions.json", "r", encoding="utf-8") as f:
                self.cases_actions: Dict[str, List[Dict[str, Any]]] = json.load(f)

            # Load metrics
            with open(FIXTURES_DIR / "metrics.json", "r", encoding="utf-8") as f:
                self.metrics: Dict[str, Any] = json.load(f)
                if "by_typology_difficulty" in self.metrics and "typologyBreakdown" not in self.metrics:
                    self.metrics["typologyBreakdown"] = self.metrics["by_typology_difficulty"]
                if "alert_reduction" in self.metrics and "operationalImpact" not in self.metrics:
                    ar = self.metrics["alert_reduction"]
                    self.metrics["operationalImpact"] = {
                        "totalAccountAlerts": ar.get("baseline_alerts", 412),
                        "consolidatedRings": ar.get("ring_cases", 18),
                        "reductionPercentage": ar.get("reduction_pct", 97.8),
                        "simulatedMoneySaved": 38400000,
                    }

            # Load overview
            with open(FIXTURES_DIR / "overview.json", "r", encoding="utf-8") as f:
                self.overview: Dict[str, Any] = json.load(f)

            # Load simulation
            with open(FIXTURES_DIR / "simulation.json", "r", encoding="utf-8") as f:
                self.simulation: Dict[str, Any] = json.load(f)

            self.next_action_id = 2000
            self.next_event_id = 500

    def get_alerts(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        with self.lock:
            res = copy.deepcopy(self.alerts)

        # Apply query filters
        ring_type = filters.get("ring_type")
        if ring_type:
            res = [a for a in res if a.get("ring_type") == ring_type]

        status = filters.get("status")
        if status:
            res = [a for a in res if a.get("status") == status]

        min_score = filters.get("min_score")
        if min_score is not None:
            try:
                ms = float(min_score)
                res = [a for a in res if a.get("score", 0) >= ms]
            except ValueError:
                pass

        min_priority = filters.get("min_priority")
        if min_priority is not None:
            try:
                mp = float(min_priority)
                res = [a for a in res if a.get("priority", 0) >= mp]
            except ValueError:
                pass

        # Sort by priority descending
        res.sort(key=lambda x: x.get("priority", 0), reverse=True)

        offset = int(filters.get("offset", 0))
        limit = filters.get("limit")
        if limit:
            res = res[offset : offset + int(limit)]
        elif offset:
            res = res[offset:]

        return res

    def get_ring(self, ring_id: str) -> Optional[Dict[str, Any]]:
        normalized = unquote(ring_id).strip()
        with self.lock:
            ring = self.rings.get(normalized)
            if not ring:
                # Fallback alias for convenience
                ring = self.rings.get("R-104")
            return copy.deepcopy(ring) if ring else None

    def get_timeline(self, ring_id: str) -> List[Dict[str, Any]]:
        normalized = unquote(ring_id).strip()
        with self.lock:
            timeline = self.timelines.get(normalized)
            if not timeline:
                timeline = self.timelines.get("R-104", [])
            return copy.deepcopy(timeline)

    def get_account(self, account_id: str) -> Optional[Dict[str, Any]]:
        normalized = unquote(account_id).strip()
        with self.lock:
            acc = self.accounts.get(normalized)
            return copy.deepcopy(acc) if acc else None

    def get_case_actions(self, case_id: int) -> List[Dict[str, Any]]:
        with self.lock:
            actions = self.cases_actions.get(str(case_id), [])
            # Return sorted latest first or chronological
            return copy.deepcopy(actions)

    def execute_action(self, ring_id: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        normalized = unquote(ring_id).strip()
        action_type = payload.get("action", "note")
        actor = payload.get("actor", "analyst_on_duty")
        note = payload.get("note", "")
        to_status = payload.get("to_status")
        assigned_to = payload.get("assigned_to")

        with self.lock:
            # Find alert
            target_alert = None
            for a in self.alerts:
                if a.get("ring_id") == normalized:
                    target_alert = a
                    break

            if not target_alert:
                return None

            case_id = target_alert.get("case_id", 100)
            from_status = target_alert.get("status")

            # Determine new status
            if action_type == "freeze":
                target_status = "frozen"
            elif action_type == "escalate":
                target_status = "escalated"
            elif action_type == "false_positive":
                target_status = "false_positive"
            elif action_type == "status_change" and to_status:
                target_status = to_status
            else:
                target_status = from_status

            target_alert["status"] = target_status
            if assigned_to:
                target_alert["assigned_to"] = assigned_to
            if note:
                target_alert["case_notes"] = note

            # Update ring graph state
            if normalized in self.rings:
                self.rings[normalized]["status"] = target_status
                if action_type == "freeze":
                    for node in self.rings[normalized].get("nodes", []):
                        if node.get("role") in ["collector", "mule"]:
                            node["is_frozen"] = True

            # Create immutable audit record
            self.next_action_id += 1
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
            new_action = {
                "action_id": self.next_action_id,
                "case_id": case_id,
                "actor": actor,
                "action": action_type,
                "from_status": from_status,
                "to_status": target_status,
                "note": note,
                "ts": now_iso,
            }

            str_cid = str(case_id)
            if str_cid not in self.cases_actions:
                self.cases_actions[str_cid] = []
            self.cases_actions[str_cid].append(new_action)

            return {
                "alert": copy.deepcopy(target_alert),
                "action": copy.deepcopy(new_action),
            }

    def get_metrics(self) -> Dict[str, Any]:
        with self.lock:
            return copy.deepcopy(self.metrics)

    def get_overview(self) -> Dict[str, Any]:
        with self.lock:
            return copy.deepcopy(self.overview)

    def get_simulation_state(self) -> Dict[str, Any]:
        with self.lock:
            return copy.deepcopy(self.simulation)

    def set_simulation_status(self, status: str) -> Dict[str, Any]:
        with self.lock:
            self.simulation["status"] = status
            return copy.deepcopy(self.simulation)

    def set_simulation_speed(self, speed: float) -> Dict[str, Any]:
        with self.lock:
            self.simulation["speed"] = speed
            return copy.deepcopy(self.simulation)

    def inject_ring(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        with self.lock:
            # Dynamically evaluate scenario through AutonomousDetectionEngine
            eval_res = DETECTION_ENGINE.evaluate_scenario(payload)
            ring_id = eval_res["ring_id"]
            case_id = eval_res["case_id"]
            typology = eval_res["typology"]
            total_amount = eval_res["total_amount"]
            entity_list = eval_res["entities"]
            raw_edges = eval_res.get("edges") or [t for t in eval_res["transactions"] if not t.get("is_blocked") and t.get("amount", 0) > 0]
            blocked_info = eval_res["blocked_info"]
            detection_results = eval_res["detection_results"]
            block_enabled = bool(blocked_info and blocked_info.get("is_blocked"))
            blocked_account_id = blocked_info.get("blocked_account") if blocked_info else None
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
            self.next_event_id += 1

            nodes = []
            for ent in entity_list:
                role_mapped = "victim" if ent["role"] == "victim" else ("cash_out" if ent["role"] == "cash_out" else ("collector" if ent["role"] == "hacker" else "mule"))
                nodes.append({
                    "account_id": ent["account_id"],
                    "role": role_mapped,
                    "actual_role": ent["role"],
                    "holder_name": ent["name"],
                    "risk_score": ent["risk_score"],
                    "ml_prob": ent.get("ml_prob", 0.0),
                    "rule_score": ent.get("rule_score", 0.0),
                    "neighbor_risk": ent.get("neighbor_risk", 0.0),
                    "reason_codes": ent.get("reason_codes", []),
                    "city": ent["city"],
                    "city_cluster": ent["city_cluster"],
                    "latitude": ent["latitude"],
                    "longitude": ent["longitude"],
                    "device_id": ent["device_id"],
                    "device_type": ent["device_type"],
                    "ip_address": ent["ip_address"],
                    "bank_id": ent["bank_id"],
                    "is_frozen": ent.get("is_frozen", False),
                    "is_blocked": ent.get("is_blocked", False),
                    "blocked_reason": ent.get("blocked_reason"),
                    "position": ent["position"],
                    "total_incoming": ent.get("total_incoming", 0.0),
                    "total_outgoing": ent.get("total_outgoing", 0.0),
                    "transaction_count": ent.get("transaction_count", 0),
                    "kyc_level": ent.get("kyc_level", "minimal"),
                    "account_type": "savings" if ent["role"] == "victim" else ("sink" if ent["role"] == "cash_out" else "current"),
                    "open_date": ent.get("open_date", "2024-06-15"),
                })

            max_risk = max((ent["risk_score"] for ent in entity_list if ent["role"] != "victim"), default=92.0)
            ring_status = "frozen" if block_enabled else "under_review"

            new_alert = {
                "run_id": 1,
                "ring_id": ring_id,
                "fingerprint": f"inj_{ring_id.lower()}_fp",
                "ring_type": typology,
                "score": max_risk,
                "priority": round(max_risk * (total_amount / 1000.0), 1),
                "amount_moved": total_amount,
                "amount_cashed": 0.0 if block_enabled else round(total_amount * 0.48, 2),
                "amount_at_risk": 0.0 if block_enabled else total_amount,
                "duration_min": 4.0,
                "n_accounts": len(entity_list),
                "n_victims": 1,
                "pattern_tags": [typology, "live_simulation", "auto_freeze" if block_enabled else "active_threat"],
                "recommended": f"Autonomous ML Containment executed: Account {blocked_account_id} quarantined under PMLA Sec 5." if block_enabled else "Immediate freeze recommended.",
                "detected_at": now_iso,
                "case_id": case_id,
                "status": ring_status,
                "assigned_to": "TraceMesh AI Shield / Autonomous Detection Engine" if block_enabled else None,
                "case_notes": f"Live simulation scenario detected dynamically by XGBoost & Graph Engine.",
                "explanation": f"Live stream evaluated: {typology} topology synthesized with ₹{total_amount:,.0f} transaction volume. Autonomous containment active.",
                "key_evidence": [
                    f"XGBoost Mule Probability: {detection_results.get('detected_ml_prob', 0.95)*100:.1f}%",
                    f"Fused Risk Score: {detection_results.get('detected_fused_risk', 94.6):.1f}%",
                    f"Triggered reason: {detection_results.get('detected_freeze_reason', 'Threshold exceeded')}",
                ],
                "blocked_info": blocked_info,
                "is_simulation": True,
            }

            self.alerts.insert(0, new_alert)
            self.rings[ring_id] = {
                **new_alert,
                "nodes": nodes,
                "edges": raw_edges,
                "blocked_info": blocked_info,
                "detection_results": detection_results,
            }

            return {
                "success": True,
                "injected_ring_id": ring_id,
                "ring_id": ring_id,
                "case_id": case_id,
                "scenario_name": eval_res.get("scenario_name", "Live Account Takeover"),
                "total_amount": total_amount,
                "blocked_info": blocked_info,
                "detection_results": detection_results,
                "nodes": nodes,
                "edges": raw_edges,
                "txns_injected": len(raw_edges),
            }


STORE = MockDataStore()


# -----------------------------------------------------------------------------
# Standalone HTTP Server (Standard Library Fallback)
# -----------------------------------------------------------------------------
class MockRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS for frontend Vite/React dev servers
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")
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

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        query = {k: v[0] for k, v in parse_qs(parsed.query).items()}

        # 1. Health
        if path == "/health" or path == "":
            self.send_json(200, {
                "status": "healthy",
                "service": "TraceMesh Mock API Server",
                "version": "1.0.0",
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "database": "mock_fixtures_loaded"
            })
            return

        # 2. Alerts
        if path == "/alerts":
            alerts = STORE.get_alerts(query)
            self.send_json(200, alerts)
            return

        # 3. Overview
        if path == "/overview":
            self.send_json(200, STORE.get_overview())
            return

        # 4. Metrics
        if path == "/metrics":
            self.send_json(200, STORE.get_metrics())
            return

        # 5. Simulation State
        if path == "/simulation/state":
            self.send_json(200, STORE.get_simulation_state())
            return

        # 6. Ring Endpoints
        parts = path.split("/")
        # /rings/{ring_id}
        if len(parts) == 3 and parts[1] == "rings":
            ring_id = parts[2]
            ring = STORE.get_ring(ring_id)
            if ring:
                self.send_json(200, ring)
            else:
                self.send_json(404, {"error": "NOT_FOUND", "message": f"Ring '{ring_id}' not found."})
            return

        # /rings/{ring_id}/timeline
        if len(parts) == 4 and parts[1] == "rings" and parts[3] == "timeline":
            ring_id = parts[2]
            timeline = STORE.get_timeline(ring_id)
            self.send_json(200, timeline)
            return

        # 7. Case Actions: /cases/{case_id}/actions
        if len(parts) == 4 and parts[1] == "cases" and parts[3] == "actions":
            try:
                case_id = int(parts[2])
                actions = STORE.get_case_actions(case_id)
                self.send_json(200, actions)
            except ValueError:
                self.send_json(400, {"error": "BAD_REQUEST", "message": "case_id must be integer."})
            return

        # 8. Account: /accounts/{account_id}
        if len(parts) == 3 and parts[1] == "accounts":
            account_id = parts[2]
            acc = STORE.get_account(account_id)
            if acc:
                self.send_json(200, acc)
            else:
                self.send_json(404, {"error": "NOT_FOUND", "message": f"Account '{account_id}' not found."})
            return

        self.send_json(404, {"error": "NOT_FOUND", "message": f"Path '{path}' not found."})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        payload = self.read_json_body()
        parts = path.split("/")

        # 1. /rings/{ring_id}/action
        if len(parts) == 4 and parts[1] == "rings" and parts[3] == "action":
            ring_id = parts[2]
            result = STORE.execute_action(ring_id, payload)
            if result:
                self.send_json(200, result)
            else:
                self.send_json(404, {"error": "NOT_FOUND", "message": f"Ring '{ring_id}' not found."})
            return

        # 2. Simulation Controls
        if path == "/simulation/start":
            self.send_json(200, STORE.set_simulation_status("running"))
            return

        if path == "/simulation/pause":
            self.send_json(200, STORE.set_simulation_status("paused"))
            return

        if path == "/simulation/speed":
            speed = float(payload.get("speed", 1.0))
            self.send_json(200, STORE.set_simulation_speed(speed))
            return

        if path in ("/simulation/inject_ring", "/simulation/run", "/simulation/custom", "/simulation/simulate"):
            result = STORE.inject_ring(payload)
            self.send_json(200, result)
            return

        self.send_json(404, {"error": "NOT_FOUND", "message": f"Action path '{path}' not found."})


# -----------------------------------------------------------------------------
# Optional FastAPI Integration
# -----------------------------------------------------------------------------
def create_fastapi_app():
    try:
        from fastapi import FastAPI, HTTPException, Query, Request, status
        from fastapi.middleware.cors import CORSMiddleware
        from fastapi.responses import JSONResponse

        app = FastAPI(
            title="TraceMesh Mock API Server",
            version="1.0.0",
            description="Mock API serving Module 2 contracts and fixtures for frontend development."
        )

        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        @app.get("/health")
        def health():
            return {
                "status": "healthy",
                "service": "TraceMesh FastAPI Mock Server",
                "version": "1.0.0",
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "database": "mock_fixtures_loaded"
            }

        @app.get("/alerts")
        def get_alerts(
            ring_type: Optional[str] = None,
            status: Optional[str] = None,
            min_score: Optional[float] = None,
            min_priority: Optional[float] = None,
            since_event_id: Optional[int] = None,
            limit: Optional[int] = None,
            offset: int = 0
        ):
            filters = {
                "ring_type": ring_type,
                "status": status,
                "min_score": min_score,
                "min_priority": min_priority,
                "since_event_id": since_event_id,
                "limit": limit,
                "offset": offset,
            }
            return STORE.get_alerts(filters)

        @app.get("/rings/{ring_id}")
        def get_ring(ring_id: str):
            ring = STORE.get_ring(ring_id)
            if not ring:
                raise HTTPException(status_code=404, detail=f"Ring '{ring_id}' not found.")
            return ring

        @app.get("/rings/{ring_id}/timeline")
        def get_ring_timeline(ring_id: str):
            return STORE.get_timeline(ring_id)

        @app.get("/accounts/{account_id}")
        def get_account(account_id: str):
            acc = STORE.get_account(account_id)
            if not acc:
                raise HTTPException(status_code=404, detail=f"Account '{account_id}' not found.")
            return acc

        @app.post("/rings/{ring_id}/action")
        def post_ring_action(ring_id: str, payload: Dict[str, Any]):
            result = STORE.execute_action(ring_id, payload)
            if not result:
                raise HTTPException(status_code=404, detail=f"Ring '{ring_id}' not found.")
            return result

        @app.get("/cases/{case_id}/actions")
        def get_case_actions(case_id: int):
            return STORE.get_case_actions(case_id)

        @app.get("/metrics")
        def get_metrics():
            return STORE.get_metrics()

        @app.get("/overview")
        def get_overview():
            return STORE.get_overview()

        @app.get("/simulation/state")
        def get_simulation_state():
            return STORE.get_simulation_state()

        @app.post("/simulation/start")
        def post_simulation_start():
            return STORE.set_simulation_status("running")

        @app.post("/simulation/pause")
        def post_simulation_pause():
            return STORE.set_simulation_status("paused")

        @app.post("/simulation/reset")
        def post_simulation_reset():
            return STORE.reset_simulation()

        @app.post("/simulation/speed")
        def post_simulation_speed(payload: Dict[str, Any]):
            speed = float(payload.get("speed", 1.0))
            return STORE.set_simulation_speed(speed)

        @app.post("/simulation/inject_ring")
        def post_simulation_inject(payload: Dict[str, Any]):
            return STORE.inject_ring(payload)

        @app.post("/simulation/run")
        def post_simulation_run(payload: Dict[str, Any]):
            return STORE.inject_ring(payload)

        @app.post("/simulation/custom")
        def post_simulation_custom(payload: Dict[str, Any]):
            return STORE.inject_ring(payload)

        @app.post("/simulation/simulate")
        def post_simulation_simulate(payload: Dict[str, Any]):
            return STORE.inject_ring(payload)

        @app.get("/cases")
        def get_cases():
            with STORE.lock:
                return [
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

        return app
    except ImportError:
        return None

# Export FastAPI app for Uvicorn if available
app = create_fastapi_app()


# -----------------------------------------------------------------------------
# Main CLI Entry Point
# -----------------------------------------------------------------------------
def run_standalone(host: str = "0.0.0.0", port: int = 8000):
    server_address = (host, port)
    httpd = HTTPServer(server_address, MockRequestHandler)
    print(f"===============================================================")
    print(f" TraceMesh Mock API Server running at http://{host}:{port}")
    print(f" Serving 11 endpoints with full fixtures & in-memory state")
    print(f" OpenAPI contract: docs/openapi.yaml")
    print(f" Press Ctrl+C to stop.")
    print(f"===============================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Mock Server...")
        httpd.server_close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="TraceMesh Mock Server")
    parser.add_argument("--host", default="0.0.0.0", help="Bind address")
    parser.add_argument("--port", type=int, default=8000, help="Listen port")
    args = parser.parse_args()

    # If uvicorn is available and user wants to run with uvicorn
    if app is not None and "uvicorn" in sys.modules:
        import uvicorn
        uvicorn.run(app, host=args.host, port=args.port)
    else:
        run_standalone(host=args.host, port=args.port)
