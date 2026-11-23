"""
TraceMesh Production API Service (Module 11 Deliverable 3)
==========================================================
Unified REST API service backing the TraceMesh Investigation Cockpit.
Implements all 11 endpoints from OpenAPI 3.1 specification (Module 2).

Database-First with Offline Resilience:
- Queries Supabase / PostgreSQL tables and views (v_alerts, rings, cases, case_actions, account_scores).
- Seamless fallback to local in-memory store and fixtures when database is offline.
- Handles analyst actions with append-only compliance audit trail.
- Zero-dependency standalone runner + FastAPI compatibility.
"""

from __future__ import annotations

import datetime
import json
import logging
import os
import sys
import threading
import time
from http import HTTPStatus
from http.server import HTTPServer, SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, unquote, urlparse

# Ensure project root is in sys.path for direct script execution
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.db import DB
from backend.mock_server import MockDataStore
from backend.simulation import SIMULATOR

logger = logging.getLogger("backend.real_server")

# Shared state store
STORE = MockDataStore()


class TraceMeshAPIHandler(SimpleHTTPRequestHandler):
    """HTTP request handler executing database queries with fixture fallbacks."""

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

    def _send_json_response(self, status: int, data: Any):
        body = json.dumps(data, indent=2, default=str).encode("utf-8")
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def handle(self):
        try:
            super().handle()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def finish(self):
        try:
            super().finish()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        query = parse_qs(parsed.query)

        # 1. Health
        if path == "/health":
            self.handle_health()
            return

        # 2. Alerts Queue
        if path == "/alerts":
            self.handle_alerts(query)
            return

        # 3. Overview Dashboard KPIs
        if path == "/overview":
            self.handle_overview()
            return

        # 4. Metrics & Evaluation
        if path == "/metrics":
            self.handle_metrics()
            return

        # 5. Timeline Replay
        if path.startswith("/rings/") and path.endswith("/timeline"):
            parts = path.split("/")
            if len(parts) == 4:
                ring_id = parts[2]
                self.handle_timeline(ring_id)
                return

        # 6. Single Ring Graph
        if path.startswith("/rings/"):
            parts = path.split("/")
            if len(parts) == 3:
                ring_id = parts[2]
                self.handle_ring(ring_id)
                return

        # 7a. All Cases
        if path == "/cases":
            self.handle_all_cases()
            return

        # 7b. Global Audit Logs
        if path in ("/audit/logs", "/cases/actions"):
            self.handle_audit_logs()
            return

        # 7c. Case Audit Trail
        if path.startswith("/cases/") and path.endswith("/actions"):
            parts = path.split("/")
            if len(parts) == 4:
                case_id = parts[2]
                self.handle_case_actions(case_id)
                return

        # 8. Single Account Profile
        if path.startswith("/accounts/"):
            parts = path.split("/")
            if len(parts) == 3:
                account_id = parts[2]
                self.handle_account(account_id)
                return

        # 9. Simulation State
        if path == "/simulation/state":
            self.handle_simulation_state()
            return

        self._send_json_response(HTTPStatus.NOT_FOUND, {"error": "Endpoint not found", "path": path})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b"{}"

        try:
            payload = json.loads(post_data.decode("utf-8")) if post_data else {}
        except json.JSONDecodeError:
            self._send_json_response(HTTPStatus.BAD_REQUEST, {"error": "Malformed JSON payload"})
            return

        # Ring Action (Freeze, Escalate, False Positive, Note)
        if path.startswith("/rings/") and path.endswith("/action"):
            parts = path.split("/")
            if len(parts) == 4:
                ring_id = parts[2]
                self.handle_ring_action(ring_id, payload)
                return

        # Simulation Controls
        if path.startswith("/simulation/"):
            action = path.replace("/simulation/", "")
            self.handle_simulation_action(action, payload)
            return

        self._send_json_response(HTTPStatus.NOT_FOUND, {"error": "Endpoint not found", "path": path})

    # -------------------------------------------------------------------------
    # Route Handlers
    # -------------------------------------------------------------------------

    def handle_health(self):
        db_ok, latency = DB.ping()
        resp = {
            "status": "healthy",
            "database": {
                "configured": DB.is_configured(),
                "connected": db_ok,
                "latency_ms": latency,
                "mode": "live_postgres" if db_ok else "resilient_fallback",
            },
            "environment": os.getenv("APP_ENV", "development"),
            "version": "2.0.0",
            "active_dataset": "toy",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        self._send_json_response(HTTPStatus.OK, resp)

    def handle_alerts(self, query: Dict[str, List[str]]):
        # Flatten query params
        filters = {k: v[0] if isinstance(v, list) and v else v for k, v in query.items()}

        # Delta polling check (Module 12d)
        if "since_event_id" in filters:
            try:
                sid = int(filters["since_event_id"])
                events = SIMULATOR.get_events(since_event_id=sid)
                self._send_json_response(HTTPStatus.OK, {
                    "events": events,
                    "latest_event_id": SIMULATOR.next_event_id,
                    "count": len(events),
                })
                return
            except ValueError:
                pass

        # Attempt DB query from v_alerts view
        try:
            if DB.is_configured():
                sql = "SELECT * FROM v_alerts ORDER BY priority DESC LIMIT 50;"
                rows = DB.query_json(sql)
                if rows:
                    self._send_json_response(HTTPStatus.OK, rows)
                    return
        except Exception as e:
            logger.warning("Database alert query failed, falling back to store: %s", e)

        # Fallback to in-memory store
        alerts = STORE.get_alerts(filters)
        self._send_json_response(HTTPStatus.OK, alerts)

    def handle_overview(self):
        try:
            if DB.is_configured():
                kpi_sql = (
                    "SELECT COUNT(*) AS active_rings, "
                    "COALESCE(SUM(amount_at_risk), 0) AS amount_at_risk, "
                    "COALESCE(SUM(n_accounts), 0) AS accounts_under_investigation "
                    "FROM v_alerts;"
                )
                kpi_res = DB.query_json(kpi_sql)
                rings_sql = (
                    "SELECT ring_id AS id, ring_type AS typology, score AS \"riskScore\", "
                    "amount_moved AS \"totalMoved\", amount_at_risk AS \"amountAtRisk\", "
                    "n_accounts AS \"accountCount\", status "
                    "FROM v_alerts ORDER BY priority DESC LIMIT 5;"
                )
                top_rings = DB.query_json(rings_sql)
                if kpi_res:
                    row = kpi_res[0]
                    store_ov = STORE.get_overview()
                    # Try to fetch recent activity from DB
                    recent_activity = store_ov.get("activity", [])
                    try:
                        act_rows = DB.query_json(
                            "SELECT ca.action_id::text AS id, ca.action AS kind, va.ring_id AS \"ringId\", "
                            "COALESCE(ca.note, 'Investigation action recorded') AS detail, "
                            "ca.actor, ca.ts AS \"occurredAt\" "
                            "FROM case_actions ca "
                            "JOIN v_alerts va ON va.case_id = ca.case_id "
                            "ORDER BY ca.ts DESC LIMIT 10;"
                        )
                        if act_rows:
                            recent_activity = act_rows
                    except Exception:
                        pass

                    overview_data = {
                        "kpis": {
                            "activeRings": row.get("active_rings", 7),
                            "amountAtRisk": float(row.get("amount_at_risk", 4995000.0)),
                            "accountsUnderInvestigation": row.get("accounts_under_investigation", 45),
                            "detectionRate": 92.5,
                            "alertReductionPct": 97.8,
                            "moneySaved": 1815000.0,
                        },
                        "rings": top_rings or store_ov.get("rings", []),
                        "alertVolume": store_ov.get("alertVolume", []),
                        "activity": recent_activity,
                        "detectionRate": 92.5,
                        "previousPeriod": store_ov.get("previousPeriod", {
                            "activeRings": 5,
                            "amountAtRisk": 3800000.0,
                            "accountsUnderInvestigation": 34,
                            "detectionRate": 88.0,
                        }),
                    }
                    self._send_json_response(HTTPStatus.OK, overview_data)
                    return
        except Exception as e:
            logger.warning("DB query for overview failed: %s", e)
        self._send_json_response(HTTPStatus.OK, STORE.get_overview())

    def handle_metrics(self):
        self._send_json_response(HTTPStatus.OK, STORE.get_metrics())

    def handle_ring(self, ring_id: str):
        try:
            if DB.is_configured():
                ring_sql = f"SELECT * FROM rings WHERE ring_id = '{ring_id}' LIMIT 1;"
                r_rows = DB.query_json(ring_sql)
                if r_rows:
                    r = r_rows[0]
                    node_sql = (
                        f"SELECT a.account_id, rm.role, a.kyc_level, a.account_type, a.city_cluster, "
                        f"a.declared_income_band, a.latitude, a.longitude, a.city "
                        f"FROM ring_members rm "
                        f"JOIN accounts a ON a.account_id = rm.account_id "
                        f"WHERE rm.ring_id = '{ring_id}';"
                    )
                    nodes = DB.query_json(node_sql)
                    edge_sql = (
                        f"SELECT t.txn_id, t.src_account, t.dst_account, t.amount, t.channel, t.ts, "
                        f"rt.hop_index, t.device_id, t.device_type, t.ip_address, t.latitude, t.longitude "
                        f"FROM ring_transactions rt "
                        f"JOIN transactions t ON t.txn_id = rt.txn_id "
                        f"WHERE rt.ring_id = '{ring_id}' "
                        f"ORDER BY rt.hop_index ASC, t.ts ASC;"
                    )
                    edges = DB.query_json(edge_sql)
                    ring_obj = {
                        "ring_id": r.get("ring_id"),
                        "fingerprint": r.get("fingerprint"),
                        "ring_type": r.get("ring_type"),
                        "score": r.get("score"),
                        "priority": r.get("priority"),
                        "amount_moved": float(r.get("amount_moved") or 0.0),
                        "amount_cashed": float(r.get("amount_cashed") or 0.0),
                        "amount_at_risk": float(r.get("amount_at_risk") or 0.0),
                        "duration_min": r.get("duration_min", 45.0),
                        "status": r.get("status", "new"),
                        "detected_at": r.get("detected_at"),
                        "pattern_tags": r.get("pattern_tags") or [],
                        "explanation": r.get("explanation", ""),
                        "recommended": r.get("recommended", ""),
                        "nodes": nodes,
                        "edges": edges,
                    }
                    self._send_json_response(HTTPStatus.OK, ring_obj)
                    return
        except Exception as e:
            logger.warning("DB query for ring %s failed: %s", ring_id, e)
        ring = STORE.get_ring(ring_id)
        if not ring:
            self._send_json_response(HTTPStatus.NOT_FOUND, {"error": f"Ring {ring_id} not found"})
            return
        self._send_json_response(HTTPStatus.OK, ring)

    def handle_timeline(self, ring_id: str):
        try:
            if DB.is_configured():
                edge_sql = (
                    f"SELECT t.txn_id, t.src_account, t.dst_account, t.amount, t.channel, t.ts, "
                    f"rt.hop_index, t.device_id, t.device_type, t.ip_address, t.latitude, t.longitude "
                    f"FROM ring_transactions rt "
                    f"JOIN transactions t ON t.txn_id = rt.txn_id "
                    f"WHERE rt.ring_id = '{ring_id}' "
                    f"ORDER BY rt.hop_index ASC, t.ts ASC;"
                )
                edges = DB.query_json(edge_sql)
                if edges:
                    timeline = [
                        {
                            "transaction_id": e["txn_id"],
                            "timestamp": e["ts"],
                            "timestampMs": int(datetime.datetime.fromisoformat(e["ts"].replace("Z", "+00:00")).timestamp() * 1000),
                            "src_account": e["src_account"],
                            "dst_account": e["dst_account"],
                            "amount": float(e["amount"]),
                            "channel": e["channel"],
                            "hop_index": e.get("hop_index", 1),
                            "is_suspicious": True,
                            "progress": hop_idx / max(len(edges), 1),
                            "device_id": e.get("device_id"),
                            "device_type": e.get("device_type"),
                            "ip_address": e.get("ip_address"),
                            "latitude": e.get("latitude"),
                            "longitude": e.get("longitude"),
                        }
                        for hop_idx, e in enumerate(edges, 1)
                    ]
                    self._send_json_response(HTTPStatus.OK, timeline)
                    return
        except Exception as e:
            logger.warning("DB query for timeline of ring %s failed: %s", ring_id, e)
        timeline = STORE.get_timeline(ring_id)
        if timeline is None:
            self._send_json_response(HTTPStatus.NOT_FOUND, {"error": f"Timeline for ring {ring_id} not found"})
            return
        self._send_json_response(HTTPStatus.OK, timeline)

    def handle_account(self, account_id: str):
        try:
            if DB.is_configured():
                sql = f"SELECT * FROM accounts WHERE account_id = '{account_id}' LIMIT 1;"
                rows = DB.query_json(sql)
                if rows:
                    acc = rows[0]
                    r_sql = f"SELECT ring_id, role FROM ring_members WHERE account_id = '{account_id}';"
                    rings = DB.query_json(r_sql)
                    acc["rings"] = rings
                    self._send_json_response(HTTPStatus.OK, acc)
                    return
        except Exception as e:
            logger.warning("DB query for account %s failed: %s", account_id, e)
        account = STORE.get_account(account_id)
        if not account:
            self._send_json_response(HTTPStatus.NOT_FOUND, {"error": f"Account {account_id} not found"})
            return
        self._send_json_response(HTTPStatus.OK, account)

    def handle_case_actions(self, case_id: str):
        if not case_id or case_id in ("undefined", "null"):
            self._send_json_response(HTTPStatus.OK, [])
            return

        try:
            cid = int(case_id)
        except (ValueError, TypeError):
            self._send_json_response(HTTPStatus.OK, [])
            return

        try:
            if DB.is_configured():
                act_sql = (
                    f"SELECT action_id, case_id, actor, action, from_status, to_status, note, ts "
                    f"FROM case_actions WHERE case_id = {cid} ORDER BY ts ASC, action_id ASC;"
                )
                rows = DB.query_json(act_sql)
                if rows:
                    actions = [
                        {
                            "action_id": r.get("action_id"),
                            "case_id": r.get("case_id"),
                            "actor": r.get("actor", "Lead AML Investigator"),
                            "action": r.get("action", "note"),
                            "from_status": r.get("from_status", "new"),
                            "to_status": r.get("to_status", "under_review"),
                            "notes": r.get("note", ""),
                            "ts": r.get("ts"),
                        }
                        for r in rows
                    ]
                    self._send_json_response(HTTPStatus.OK, actions)
                    return
        except Exception as e:
            logger.warning("DB query for case %s actions failed: %s", case_id, e)

        actions = STORE.get_case_actions(cid)
        self._send_json_response(HTTPStatus.OK, actions)

    def handle_all_cases(self):
        try:
            if DB.is_configured():
                sql_cases = """
                SELECT 
                  va.case_id,
                  va.ring_id,
                  va.fingerprint,
                  va.status,
                  va.priority,
                  va.score,
                  va.ring_type,
                  va.amount_moved,
                  va.amount_at_risk,
                  va.n_accounts,
                  va.n_victims,
                  va.assigned_to,
                  va.case_notes AS notes,
                  va.detected_at AS created_at,
                  COALESCE(MAX(ca.ts), va.detected_at) AS updated_at,
                  COUNT(ca.action_id)::int AS actions_count
                FROM v_alerts va
                LEFT JOIN case_actions ca ON ca.case_id = va.case_id
                GROUP BY va.case_id, va.ring_id, va.fingerprint, va.status, va.priority, va.score,
                         va.ring_type, va.amount_moved, va.amount_at_risk, va.n_accounts, va.n_victims,
                         va.assigned_to, va.case_notes, va.detected_at
                ORDER BY va.priority DESC
                """
                rows = DB.query_json(sql_cases)
                if rows:
                    self._send_json_response(HTTPStatus.OK, rows)
                    return
        except Exception as e:
            logger.warning("DB query for all cases failed: %s", e)

        cases = []
        for alert in STORE.alerts:
            cid = alert.get("case_id", 100)
            actions = STORE.cases_actions.get(str(cid), [])
            cases.append({
                "case_id": cid,
                "ring_id": alert.get("ring_id"),
                "fingerprint": alert.get("fingerprint"),
                "status": alert.get("status"),
                "priority": alert.get("priority"),
                "score": alert.get("score"),
                "ring_type": alert.get("ring_type"),
                "amount_moved": alert.get("amount_moved"),
                "amount_at_risk": alert.get("amount_at_risk"),
                "n_accounts": alert.get("n_accounts"),
                "n_victims": alert.get("n_victims"),
                "assigned_to": alert.get("assigned_to", alert.get("assignee", "Unassigned")),
                "notes": alert.get("case_notes", alert.get("explanation", "")),
                "created_at": alert.get("detected_at"),
                "updated_at": actions[-1]["ts"] if actions else alert.get("detected_at"),
                "actions_count": len(actions),
            })
        self._send_json_response(HTTPStatus.OK, cases)

    def handle_audit_logs(self):
        try:
            if DB.is_configured():
                sql_logs = """
                SELECT 
                  ca.action_id,
                  ca.case_id,
                  ca.actor,
                  ca.action,
                  ca.from_status,
                  ca.to_status,
                  ca.note AS notes,
                  ca.ts,
                  va.ring_id,
                  va.ring_type
                FROM case_actions ca
                JOIN v_alerts va ON va.case_id = ca.case_id
                ORDER BY ca.ts DESC
                """
                rows = DB.query_json(sql_logs)
                if rows:
                    self._send_json_response(HTTPStatus.OK, rows)
                    return
        except Exception as e:
            logger.warning("DB query for audit logs failed: %s", e)

        all_logs = []
        alert_map = {a.get("case_id"): a for a in STORE.alerts}
        for cid_str, actions in STORE.cases_actions.items():
            cid = int(cid_str) if cid_str.isdigit() else 100
            alert = alert_map.get(cid, {})
            for act in actions:
                all_logs.append({
                    "action_id": act.get("action_id"),
                    "case_id": act.get("case_id", cid),
                    "actor": act.get("actor", "Lead AML Investigator"),
                    "action": act.get("action", "note"),
                    "from_status": act.get("from_status"),
                    "to_status": act.get("to_status"),
                    "notes": act.get("note", act.get("notes", "")),
                    "ts": act.get("ts"),
                    "ring_id": alert.get("ring_id", f"R-{cid}"),
                    "ring_type": alert.get("ring_type", "circular_flow"),
                })
        all_logs.sort(key=lambda x: x.get("ts", ""), reverse=True)
        self._send_json_response(HTTPStatus.OK, all_logs)

    def handle_ring_action(self, ring_id: str, payload: Dict[str, Any]):
        action = payload.get("action")
        note = payload.get("note", "")
        actor = payload.get("actor", "compliance_analyst")

        if not action or action not in ("freeze", "escalate", "false_positive", "note", "status_change"):
            self._send_json_response(
                HTTPStatus.BAD_REQUEST,
                {"error": "Invalid action. Must be freeze, escalate, false_positive, note, or status_change."},
            )
            return

        res = STORE.execute_action(ring_id, payload)
        if not res:
            self._send_json_response(HTTPStatus.NOT_FOUND, {"error": f"Ring {ring_id} not found"})
            return

        # Attempt to also record in database case_actions and update ring/case status
        try:
            if DB.is_configured():
                cid = res.get("action", {}).get("case_id", 100)
                clean_note = note.replace("'", "''")
                new_status = res.get("action", {}).get("to_status", "under_review")
                sql = (
                    f"BEGIN;\n"
                    f"INSERT INTO case_actions (case_id, actor, action, note, to_status) "
                    f"VALUES ({cid}, '{actor}', '{action}', '{clean_note}', '{new_status}');\n"
                    f"UPDATE rings SET status = '{new_status}', blocked_at = timezone('utc', now()), "
                    f"blocked_reason = '{clean_note}', blocked_by = '{actor}' WHERE ring_id = '{ring_id}';\n"
                    f"UPDATE cases SET status = '{new_status}', updated_at = timezone('utc', now()) WHERE case_id = {cid};\n"
                    f"COMMIT;"
                )
                DB.execute(sql)
        except Exception as e:
            logger.warning("Failed to mirror action into PostgreSQL: %s", e)

        self._send_json_response(HTTPStatus.OK, res)

    def handle_simulation_state(self):
        self._send_json_response(HTTPStatus.OK, SIMULATOR.get_state())

    def handle_simulation_action(self, action: str, payload: Dict[str, Any]):
        if action == "start":
            res = SIMULATOR.start()
        elif action == "pause":
            res = SIMULATOR.pause()
        elif action == "reset":
            res = SIMULATOR.reset()
        elif action == "speed":
            speed_val = payload.get("speed", 1.0)
            res = SIMULATOR.set_speed(speed_val)
        elif action == "inject_ring":
            typology = payload.get("typology", "circular_flow")
            difficulty = payload.get("difficulty", "medium")
            amount = float(payload.get("amount", 250000.0))
            res = SIMULATOR.inject_ring(typology=typology, difficulty=difficulty, amount_base=amount)

            # Mirror injected ring into STORE so /alerts, /rings/{id}, and /timeline find it immediately
            ring_id = res["ring_id"]
            txns = res.get("transactions", [])
            accounts = list({t["src_account"] for t in txns} | {t["dst_account"] for t in txns})

            nodes = []
            for idx, acc in enumerate(accounts):
                role = "collector" if "COLL" in acc else ("mule" if "HOP" in acc or "ACC" in acc else "victim")
                nodes.append({
                    "account_id": acc,
                    "role": role,
                    "risk_score": 92.0,
                    "position": [-6.0 + (idx % 3) * 6.0, (idx // 3) * 3.0 - 2.0, 0.0],
                    "total_incoming": res["amount_moved"],
                    "total_outgoing": res["amount_moved"],
                    "city_cluster": "tier1_delhi" if idx % 2 == 0 else "tier1_mumbai",
                    "bank_id": "SBI_INJ",
                    "kyc_level": "minimal",
                    "account_type": "current",
                    "open_date": "2026-01-01",
                    "declared_income_band": "low",
                    "is_injected": True,
                })

            edges = []
            for hop, t in enumerate(txns, 1):
                edges.append({
                    "txn_id": t["txn_id"],
                    "src_account": t["src_account"],
                    "dst_account": t["dst_account"],
                    "amount": t["amount"],
                    "ts": t["ts"],
                    "channel": t.get("channel", "UPI"),
                    "hop_index": hop,
                    "is_suspicious": True,
                    "is_injected": True,
                })

            new_alert = {
                "case_id": int(time.time()) % 10000,
                "ring_id": ring_id,
                "fingerprint": f"fp_{ring_id.lower()}",
                "ring_type": typology,
                "score": 92.5,
                "priority": round(92.5 * (res["amount_moved"] / 1000.0), 1),
                "amount_moved": res["amount_moved"],
                "amount_cashed": 0.0,
                "amount_at_risk": res["amount_moved"],
                "duration_min": 25.0,
                "n_accounts": len(accounts),
                "n_victims": 1,
                "status": "new",
                "detected_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "assignee": "Unassigned",
                "pattern_tags": [typology, "live_injected", difficulty],
                "explanation": f"Live injected {typology.replace('_', ' ')} syndicate comprising {len(accounts)} accounts.",
                "is_injected": True,
            }

            STORE.alerts.insert(0, new_alert)
            STORE.rings[ring_id] = {
                **new_alert,
                "nodes": nodes,
                "edges": edges,
            }
            STORE.timelines[ring_id] = [
                {
                    "txn_id": e["txn_id"],
                    "ts": e["ts"],
                    "timestampMs": int(datetime.datetime.fromisoformat(e["ts"].replace("Z", "+00:00")).timestamp() * 1000),
                    "src_account": e["src_account"],
                    "dst_account": e["dst_account"],
                    "amount": e["amount"],
                    "channel": e["channel"],
                    "hop_index": e["hop_index"],
                    "is_suspicious": True,
                    "progress": hop_idx / max(len(edges), 1),
                }
                for hop_idx, e in enumerate(edges, 1)
            ]

            # Mirror injected ring into Supabase PostgreSQL database if available
            try:
                if DB.is_configured():
                    stmts = ["BEGIN;"]
                    # 1. Accounts
                    for idx, acc in enumerate(accounts):
                        role = "collector" if "COLL" in acc else ("mule" if "HOP" in acc or "ACC" in acc else "victim")
                        lat = 28.6139 if idx % 2 == 0 else 19.0760
                        lng = 77.2090 if idx % 2 == 0 else 72.8777
                        city = "Delhi" if idx % 2 == 0 else "Mumbai"
                        cluster = nodes[idx]["city_cluster"] if idx < len(nodes) else "tier1_delhi"
                        stmts.append(
                            f"INSERT INTO accounts (account_id, open_date, kyc_level, account_type, city_cluster, declared_income_band, bank_id, latitude, longitude, city) "
                            f"VALUES ('{acc}', '2026-01-01', 'minimal', 'current', '{cluster}', 'low', 'SBI_INJ', {lat}, {lng}, '{city}') "
                            f"ON CONFLICT (account_id) DO NOTHING;"
                        )
                    # 2. Transactions
                    for hop, t in enumerate(txns, 1):
                        tid = t["txn_id"]
                        src = t["src_account"]
                        dst = t["dst_account"]
                        amt = float(t["amount"])
                        ts = t["ts"]
                        ch = t.get("channel", "UPI")
                        ip = f"192.168.1.{10 + hop}"
                        dev_id = f"dev_{src.lower()}"
                        lat = 28.6139 if hop % 2 == 0 else 19.0760
                        lng = 77.2090 if hop % 2 == 0 else 72.8777
                        stmts.append(
                            f"INSERT INTO transactions (txn_id, ts, src_account, dst_account, amount, channel, is_injected, injection_id, device_id, device_type, ip_address, latitude, longitude) "
                            f"VALUES ('{tid}', '{ts}', '{src}', '{dst}', {amt}, '{ch}', TRUE, '{ring_id}', '{dev_id}', 'Mobile', '{ip}', {lat}, {lng}) "
                            f"ON CONFLICT (txn_id) DO NOTHING;"
                        )
                    # 3. Rings
                    now_iso = new_alert["detected_at"]
                    case_num = new_alert["case_id"]
                    priority_val = new_alert["priority"]
                    amt_moved = new_alert["amount_moved"]
                    n_accs = len(accounts)
                    clean_expl = new_alert["explanation"].replace("'", "''")
                    stmts.append(
                        f"INSERT INTO rings (ring_id, run_id, fingerprint, ring_type, score, priority, amount_moved, amount_cashed, amount_at_risk, duration_min, n_accounts, n_victims, status, detected_at, explanation) "
                        f"VALUES ('{ring_id}', 1, 'fp_{ring_id.lower()}', '{typology}', 92.5, {priority_val}, {amt_moved}, 0.0, {amt_moved}, 25.0, {n_accs}, 1, 'new', '{now_iso}', '{clean_expl}') "
                        f"ON CONFLICT (run_id, ring_id) DO UPDATE SET status = 'new', detected_at = '{now_iso}';"
                    )
                    # 4. Ring Members
                    for idx, acc in enumerate(accounts):
                        role = "collector" if "COLL" in acc else ("mule" if "HOP" in acc or "ACC" in acc else "victim")
                        stmts.append(
                            f"INSERT INTO ring_members (run_id, ring_id, account_id, role) "
                            f"VALUES (1, '{ring_id}', '{acc}', '{role}') "
                            f"ON CONFLICT DO NOTHING;"
                        )
                    # 5. Ring Transactions
                    for hop, t in enumerate(txns, 1):
                        stmts.append(
                            f"INSERT INTO ring_transactions (run_id, ring_id, txn_id, hop_index) "
                            f"VALUES (1, '{ring_id}', '{t['txn_id']}', {hop}) "
                            f"ON CONFLICT DO NOTHING;"
                        )
                    # 6. Cases
                    stmts.append(
                        f"INSERT INTO cases (case_id, status, priority, assigned_to, notes, created_at, updated_at) "
                        f"VALUES ({case_num}, 'new', {priority_val}, 'Unassigned', 'Automated alert for live injected ring {ring_id}', '{now_iso}', '{now_iso}') "
                        f"ON CONFLICT (case_id) DO NOTHING;"
                    )
                    stmts.append("COMMIT;")
                    DB.execute("\n".join(stmts))
                    logger.info("Successfully mirrored live injected ring %s into PostgreSQL database", ring_id)
            except Exception as e:
                logger.warning("Failed to mirror injected ring into database: %s", e)
        else:
            self._send_json_response(HTTPStatus.BAD_REQUEST, {"error": f"Unknown simulation action '{action}'"})
            return

        self._send_json_response(HTTPStatus.OK, res)


def run_server(port: int = 8000, host: str = "0.0.0.0"):
    server = ThreadingHTTPServer((host, port), TraceMeshAPIHandler)
    server.daemon_threads = True
    print("=" * 70)
    print(f" TRACEMESH PRODUCTION API SERVER (Module 11)")
    print(f" Listening at : http://{host}:{port}")
    print(f" Database URL : {DB.db_url or 'Offline (Resilient Fallback Active)'}")
    print("=" * 70)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        server.server_close()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run_server(port=port)
