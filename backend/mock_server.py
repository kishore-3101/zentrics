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

def find_fixtures_dir() -> Path:
    candidates = [
        Path(__file__).resolve().parent / "fixtures",
        Path.cwd() / "fixtures",
        Path.cwd() / "backend" / "fixtures",
        Path(__file__).resolve().parent.parent / "backend" / "fixtures",
        Path("/var/task/fixtures"),
        Path("/var/task/backend/fixtures"),
    ]
    for c in candidates:
        if c.exists() and (c / "alerts.json").exists():
            return c
    return Path(__file__).resolve().parent / "fixtures"

FIXTURES_DIR = find_fixtures_dir()

def load_json_file(filename: str, default: Any) -> Any:
    for base in [
        FIXTURES_DIR,
        Path(__file__).resolve().parent / "fixtures",
        Path.cwd() / "fixtures",
        Path.cwd() / "backend" / "fixtures",
        Path("/var/task/fixtures"),
        Path("/var/task/backend/fixtures"),
    ]:
        p = base / filename
        if p.exists():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
    return default

# -----------------------------------------------------------------------------
# In-Memory State Store (Mutable for live analyst actions & simulation controls)
# -----------------------------------------------------------------------------
class MockDataStore:
    def __init__(self):
        self.lock = threading.RLock()
        self.load_fixtures()

    def load_fixtures(self):
        with self.lock:
            # Load alerts
            self.alerts = load_json_file("alerts.json", [])
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
            self.rings = load_json_file("rings.json", {})

            # Load timelines
            self.timelines = load_json_file("timelines.json", {})

            # Load accounts
            self.accounts = load_json_file("accounts.json", {})

            # Load cases actions
            self.cases_actions = load_json_file("cases_actions.json", {})

            # Load metrics
            self.metrics = load_json_file("metrics.json", {})
            if not self.metrics.get("curves"):
                self.metrics["curves"] = {
                    "pr_curve": [
                        {"threshold": 0.1, "recall": 99.2, "precision": 52.1, "fpr": 18.5, "tpr": 99.2},
                        {"threshold": 0.3, "recall": 96.5, "precision": 74.3, "fpr": 8.2, "tpr": 96.5},
                        {"threshold": 0.5, "recall": 92.5, "precision": 88.6, "fpr": 3.1, "tpr": 92.5},
                        {"threshold": 0.7, "recall": 88.7, "precision": 91.4, "fpr": 1.8, "tpr": 88.7},
                        {"threshold": 0.85, "recall": 76.4, "precision": 96.2, "fpr": 0.6, "tpr": 76.4},
                        {"threshold": 0.95, "recall": 54.1, "precision": 98.9, "fpr": 0.1, "tpr": 54.1},
                    ],
                    "roc_curve": [
                        {"fpr": 0.0, "tpr": 0.0, "threshold": 1.0},
                        {"fpr": 0.1, "tpr": 54.1, "threshold": 0.95},
                        {"fpr": 0.6, "tpr": 76.4, "threshold": 0.85},
                        {"fpr": 1.8, "tpr": 88.7, "threshold": 0.7},
                        {"fpr": 3.1, "tpr": 92.5, "threshold": 0.5},
                        {"fpr": 8.2, "tpr": 96.5, "threshold": 0.3},
                        {"fpr": 18.5, "tpr": 99.2, "threshold": 0.1},
                        {"fpr": 100.0, "tpr": 100.0, "threshold": 0.0},
                    ]
                }
            if not self.metrics.get("overall"):
                self.metrics["overall"] = {
                    "precision": 91.4, "recall": 88.7, "f1": 90.0, "pr_auc": 0.942, "ring_recall": 92.5, "fpr": 1.8
                }
            if not self.metrics.get("comparison"):
                self.metrics["comparison"] = [
                    {"metric": "PR-AUC", "baseline_rules": 0.612, "graph_rules": 0.785, "ml_only": 0.834, "full_fusion": 0.942},
                    {"metric": "F1-Score", "baseline_rules": 58.4, "graph_rules": 74.2, "ml_only": 81.1, "full_fusion": 90.0},
                    {"metric": "Ring Recall @ 70%", "baseline_rules": 42.1, "graph_rules": 71.5, "ml_only": 68.4, "full_fusion": 92.5},
                    {"metric": "False Positive Rate", "baseline_rules": 14.8, "graph_rules": 6.9, "ml_only": 5.2, "full_fusion": 1.8},
                ]
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

            # Ensure R-104 and demo-ring are in self.rings
            if not self.rings.get("R-104"):
                demo_r = {
                    "ring_id": "R-104",
                    "fingerprint": "fp_r104",
                    "ring_type": "circular",
                    "score": 94.2,
                    "priority": 96.5,
                    "amount_moved": 750000.0,
                    "amount_cashed": 0.0,
                    "amount_at_risk": 750000.0,
                    "duration_min": 34.0,
                    "status": "active",
                    "detected_at": "2026-03-10T10:49:00Z",
                    "pattern_tags": ["circular_routing", "rapid_cycling", "layering"],
                    "explanation": {
                        "rule_score": 92.0,
                        "ml_probability": 0.95,
                        "graph_risk": 0.94,
                        "primary_typology": "Circular Flow / Churning",
                        "detection_summary": "Circular routing between multiple accounts to obscure source of funds.",
                        "top_risk_factors": [
                            {"factor": "Closed Cycle Flow", "weight": 45.0, "description": "Funds return to initiator within 34 minutes."},
                            {"factor": "Rapid Pass-Through", "weight": 35.0, "description": "Average retention time < 6 minutes."}
                        ]
                    },
                    "nodes": [
                        {"account_id": "ACC_VICTIM_401", "role": "victim", "risk_score": 12.0, "ml_prob": 0.08, "rule_score": 0.1, "neighbor_risk": 0.15, "open_date": "2019-04-12", "kyc_level": "full", "account_type": "savings", "city_cluster": "MUMBAI", "declared_income_band": "mid", "bank_id": "TRACE_BANK", "total_incoming": 800000.0, "total_outgoing": 750000.0, "transaction_count": 3, "reason_codes": [], "is_frozen": False, "position": [-8.0, 0.5, 0.0]},
                        {"account_id": "ACC_MULE_401", "role": "collector", "risk_score": 88.0, "ml_prob": 0.91, "rule_score": 0.85, "neighbor_risk": 0.89, "open_date": "2026-01-15", "kyc_level": "minimal", "account_type": "current", "city_cluster": "DELHI", "declared_income_band": "low", "bank_id": "TRACE_BANK", "total_incoming": 750000.0, "total_outgoing": 745000.0, "transaction_count": 8, "reason_codes": [], "is_frozen": False, "position": [-4.0, 2.5, 1.2]},
                        {"account_id": "ACC_MULE_402", "role": "mule", "risk_score": 92.0, "ml_prob": 0.94, "rule_score": 0.89, "neighbor_risk": 0.92, "open_date": "2026-02-01", "kyc_level": "minimal", "account_type": "current", "city_cluster": "BANGALORE", "declared_income_band": "low", "bank_id": "FAST_BANK", "total_incoming": 745000.0, "total_outgoing": 740000.0, "transaction_count": 12, "reason_codes": [], "is_frozen": False, "position": [0.0, 0.0, -1.0]},
                        {"account_id": "ACC_MULE_403", "role": "cash_out", "risk_score": 95.0, "ml_prob": 0.97, "rule_score": 0.94, "neighbor_risk": 0.95, "open_date": "2026-02-10", "kyc_level": "minimal", "account_type": "savings", "city_cluster": "KOLKATA", "declared_income_band": "low", "bank_id": "SAFE_BANK", "total_incoming": 740000.0, "total_outgoing": 735000.0, "transaction_count": 15, "reason_codes": [], "is_frozen": False, "position": [8.0, -1.5, 0.0]}
                    ],
                    "edges": [
                        {"txn_id": "TXN_401_01", "src_account": "ACC_VICTIM_401", "dst_account": "ACC_MULE_401", "amount": 750000.0, "channel": "UPI", "ts": "2026-03-10T10:15:00Z", "hop_index": 1, "is_suspicious": True},
                        {"txn_id": "TXN_401_02", "src_account": "ACC_MULE_401", "dst_account": "ACC_MULE_402", "amount": 745000.0, "channel": "IMPS", "ts": "2026-03-10T10:22:00Z", "hop_index": 2, "is_suspicious": True},
                        {"txn_id": "TXN_401_03", "src_account": "ACC_MULE_402", "dst_account": "ACC_MULE_403", "amount": 740000.0, "channel": "RTGS", "ts": "2026-03-10T10:35:00Z", "hop_index": 3, "is_suspicious": True}
                    ]
                }
                self.rings["R-104"] = demo_r
                self.rings["demo-ring"] = demo_r

            # Load overview
            self.overview = load_json_file("overview.json", {
                "kpis": {"totalMonitoredAccounts": 25000, "activeRings": 24, "atRiskVolume": 18500000, "frozenVolume": 14200000},
                "rings": [],
                "alertVolume": [],
                "activity": [],
                "detectionRate": 96.4,
                "previousPeriod": {"activeRings": 28, "atRiskVolume": 22000000}
            })

            # Load simulation
            self.simulation = load_json_file("simulation.json", {"status": "idle", "speed": 1.0, "current_step": 0})
            self.delta_events: List[Dict[str, Any]] = []

            self.next_action_id = 2000
            self.next_event_id = 500
            self._sim_state_file = Path("/tmp/tracemesh_sim_state.json")
            self._load_sim_state()

    def _save_sim_state(self):
        """Persists simulated rings, alerts, timelines, and case actions to /tmp across serverless invocations."""
        try:
            sim_rings = {k: v for k, v in self.rings.items() if v.get("is_simulation") or k.startswith("SIM-")}
            sim_alerts = [a for a in self.alerts if a.get("is_simulation") or str(a.get("ring_id", "")).startswith("SIM-")]
            frozen_overrides = {
                a.get("ring_id"): {
                    "status": a.get("status"),
                    "assigned_to": a.get("assigned_to"),
                    "case_notes": a.get("case_notes"),
                    "amount_at_risk": a.get("amount_at_risk"),
                    "amount_cashed": a.get("amount_cashed"),
                    "blocked_info": self.rings.get(a.get("ring_id", ""), {}).get("blocked_info"),
                }
                for a in self.alerts
                if a.get("status") in ("frozen", "escalated", "false_positive", "under_review")
            }
            sim_timelines = {k: self.timelines[k] for k in sim_rings if k in self.timelines}
            sim_actions = {
                str(r.get("case_id")): self.cases_actions[str(r.get("case_id"))]
                for r in sim_rings.values()
                if str(r.get("case_id")) in self.cases_actions
            }
            state = {
                "sim_rings": sim_rings,
                "sim_alerts": sim_alerts,
                "sim_timelines": sim_timelines,
                "sim_actions": sim_actions,
                "frozen_overrides": frozen_overrides,
                "delta_events": self.delta_events[-50:],
                "next_action_id": self.next_action_id,
                "next_event_id": self.next_event_id,
            }
            self._sim_state_file.write_text(json.dumps(state), encoding="utf-8")
        except Exception:
            pass

    def _load_sim_state(self):
        """Loads persisted simulation state from /tmp if available."""
        try:
            if not getattr(self, "_sim_state_file", None) or not self._sim_state_file.exists():
                return
            state = json.loads(self._sim_state_file.read_text(encoding="utf-8"))
            for k, v in state.get("sim_rings", {}).items():
                self.rings[k] = v
            for k, v in state.get("sim_timelines", {}).items():
                self.timelines[k] = v
            for k, v in state.get("sim_actions", {}).items():
                self.cases_actions[k] = v

            existing_ids = {a.get("ring_id") for a in self.alerts}
            for a in reversed(state.get("sim_alerts", [])):
                if a.get("ring_id") not in existing_ids:
                    self.alerts.insert(0, a)
                    existing_ids.add(a.get("ring_id"))

            for rid, ov in state.get("frozen_overrides", {}).items():
                for a in self.alerts:
                    if a.get("ring_id") == rid:
                        if ov.get("status"):
                            a["status"] = ov["status"]
                        if ov.get("assigned_to") is not None:
                            a["assigned_to"] = ov["assigned_to"]
                        if ov.get("case_notes") is not None:
                            a["case_notes"] = ov["case_notes"]
                        if ov.get("amount_at_risk") is not None:
                            a["amount_at_risk"] = ov["amount_at_risk"]
                        if ov.get("amount_cashed") is not None:
                            a["amount_cashed"] = ov["amount_cashed"]
                if rid in self.rings and ov.get("status"):
                    self.rings[rid]["status"] = ov["status"]
                    if ov.get("blocked_info"):
                        self.rings[rid]["blocked_info"] = ov["blocked_info"]
                    if ov["status"] == "frozen":
                        for node in self.rings[rid].get("nodes", []):
                            if node.get("role") != "victim":
                                node["is_frozen"] = True
                                node["is_blocked"] = True

            if state.get("delta_events"):
                self.delta_events = state["delta_events"]
            self.next_action_id = max(self.next_action_id, int(state.get("next_action_id", 2000)))
            self.next_event_id = max(self.next_event_id, int(state.get("next_event_id", 500)))
        except Exception:
            pass

    def get_alerts(self, filters: Dict[str, Any]) -> Any:
        with self.lock:
            self._load_sim_state()
            since_ev = filters.get("since_event_id")
            if since_ev is not None:
                try:
                    since_id = int(since_ev)
                    new_events = [e for e in self.delta_events if e.get("event_id", 0) > since_id]
                    return {
                        "events": copy.deepcopy(new_events),
                        "latest_event_id": self.next_event_id,
                    }
                except (ValueError, TypeError):
                    pass
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

        # Sort simulated alerts newest first, then priority descending
        res.sort(key=lambda x: (1 if x.get("is_simulation") else 0, x.get("detected_at", ""), x.get("priority", 0)), reverse=True)

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
                self._load_sim_state()
                ring = self.rings.get(normalized)
            if not ring:
                for k, v in self.rings.items():
                    if k.lower() == normalized.lower():
                        return copy.deepcopy(v)
            # Only fall back to demo ring when default/demo-ring alias is requested
            if not ring and normalized.lower() in ("", "demo-ring", "demo_ring", "demoring", "default", "sample"):
                ring = self.rings.get("R-104") or self.rings.get("demo-ring")
            return copy.deepcopy(ring) if ring else None

    def get_timeline(self, ring_id: str) -> List[Dict[str, Any]]:
        normalized = unquote(ring_id).strip()
        with self.lock:
            timeline = self.timelines.get(normalized)
            if not timeline:
                self._load_sim_state()
                timeline = self.timelines.get(normalized)
            if not timeline and normalized in self.rings:
                edges = self.rings[normalized].get("edges", [])
                if edges:
                    total = max(len(edges), 1)
                    timeline = [
                        {
                            "txn_id": e.get("txn_id"),
                            "ts": e.get("ts"),
                            "src_account": e.get("src_account"),
                            "dst_account": e.get("dst_account"),
                            "amount": e.get("amount"),
                            "channel": e.get("channel"),
                            "hop_index": e.get("hop_index", idx),
                            "is_suspicious": e.get("is_suspicious", True),
                            "progress": idx / total,
                        }
                        for idx, e in enumerate(edges, 1)
                    ]
            if not timeline and normalized.lower() in ("", "demo-ring", "demo_ring", "r-104"):
                timeline = self.timelines.get("R-104", [])
            return copy.deepcopy(timeline or [])

    def get_account(self, account_id: str) -> Optional[Dict[str, Any]]:
        normalized = unquote(account_id).strip()
        with self.lock:
            self._load_sim_state()
            acc = self.accounts.get(normalized)
            return copy.deepcopy(acc) if acc else None

    def get_case_actions(self, case_id: int) -> List[Dict[str, Any]]:
        with self.lock:
            self._load_sim_state()
            actions = self.cases_actions.get(str(case_id), [])
            return copy.deepcopy(actions)

    def execute_action(self, ring_id: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        normalized = unquote(ring_id).strip()
        action_type = payload.get("action", "note")
        actor = payload.get("actor", "analyst_on_duty")
        note = payload.get("note", "")
        to_status = payload.get("to_status")
        assigned_to = payload.get("assigned_to")

        with self.lock:
            self._load_sim_state()
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

            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

            if action_type == "freeze":
                target_alert["amount_at_risk"] = 0.0
                target_alert["amount_cashed"] = 0.0

            # Update ring graph state & enforce freeze across non-victim accounts
            frozen_accounts: List[str] = []
            if normalized in self.rings:
                ring_obj = self.rings[normalized]
                ring_obj["status"] = target_status
                if action_type == "freeze":
                    ring_obj["amount_at_risk"] = 0.0
                    ring_obj["amount_cashed"] = 0.0
                    primary_frozen_node = None
                    for node in ring_obj.get("nodes", []):
                        if node.get("role") != "victim":
                            node["is_frozen"] = True
                            node["is_blocked"] = True
                            node["blocked_by"] = actor
                            node["blocked_at"] = now_iso
                            node["blocked_reason"] = note or f"Precautionary account freeze enforced on {node.get('account_id')} under PMLA Sec 5."
                            frozen_accounts.append(node.get("account_id", ""))
                            if primary_frozen_node is None and node.get("role") in ("mule", "collector"):
                                primary_frozen_node = node
                            if node.get("account_id") in self.accounts:
                                self.accounts[node["account_id"]]["is_frozen"] = True
                                self.accounts[node["account_id"]]["is_blocked"] = True

                    # Block cash-out extraction edge
                    edges = ring_obj.get("edges", [])
                    if edges:
                        edges[-1]["is_blocked"] = True
                        edges[-1]["status"] = "blocked"
                        edges[-1]["blocked_reason"] = note or "Terminal cash-out blocked via analyst freeze enforcement."

                    if primary_frozen_node:
                        ring_obj["blocked_info"] = {
                            "is_blocked": True,
                            "blocked_account": primary_frozen_node.get("account_id"),
                            "blocked_city": primary_frozen_node.get("city") or primary_frozen_node.get("city_cluster", "Regional Hub"),
                            "blocked_reason": note or primary_frozen_node.get("blocked_reason"),
                            "amount_saved": ring_obj.get("amount_moved", target_alert.get("amount_moved", 0.0)),
                        }

            # Sync overview ring status & activity feed
            for r in self.overview.get("rings", []):
                if r.get("id") == normalized:
                    r["status"] = target_status
                    if action_type == "freeze":
                        r["amountAtRisk"] = 0.0

            self.overview.setdefault("activity", []).insert(0, {
                "id": f"act_{self.next_action_id + 1}",
                "action": action_type,
                "ringId": normalized,
                "actor": actor,
                "timestamp": now_iso,
                "note": note or f"Status updated to {target_status}",
            })
            self.overview["activity"] = self.overview["activity"][:20]

            # Create immutable audit record
            self.next_action_id += 1
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
            self._save_sim_state()

            return {
                "alert": copy.deepcopy(target_alert),
                "action": copy.deepcopy(new_action),
                "frozen_accounts": frozen_accounts,
                "ring": copy.deepcopy(self.rings.get(normalized)),
            }

    def get_metrics(self) -> Dict[str, Any]:
        with self.lock:
            return copy.deepcopy(self.metrics)

    def get_overview(self) -> Dict[str, Any]:
        with self.lock:
            self._load_sim_state()
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

    def reset_simulation(self) -> Dict[str, Any]:
        with self.lock:
            try:
                if self._sim_state_file.exists():
                    self._sim_state_file.unlink()
            except Exception:
                pass
            self.load_fixtures()
            self.simulation["status"] = "idle"
            self.simulation["speed"] = 1.0
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
            raw_edges = eval_res.get("edges") or eval_res.get("transactions", [])
            blocked_info = eval_res["blocked_info"]
            detection_results = eval_res["detection_results"]
            block_enabled = bool(blocked_info and blocked_info.get("is_blocked"))
            blocked_account_id = blocked_info.get("blocked_account") if blocked_info else None
            blocked_reason = blocked_info.get("blocked_reason") if blocked_info else None
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
            self.next_event_id += 1
            self.next_action_id += 1

            nodes = []
            for ent in entity_list:
                role_mapped = (
                    "victim"
                    if ent["role"] == "victim"
                    else ("cash_out" if ent["role"] == "cash_out" else ("collector" if ent["role"] == "hacker" else "mule"))
                )
                node_obj = {
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
                    "blocked_by": ent.get("blocked_by"),
                    "blocked_at": ent.get("blocked_at"),
                    "blocked_reason": ent.get("blocked_reason"),
                    "position": ent["position"],
                    "total_incoming": ent.get("total_incoming", 0.0),
                    "total_outgoing": ent.get("total_outgoing", 0.0),
                    "transaction_count": ent.get("transaction_count", 0),
                    "kyc_level": ent.get("kyc_level", "minimal"),
                    "account_type": "savings" if ent["role"] == "victim" else ("sink" if ent["role"] == "cash_out" else "current"),
                    "open_date": ent.get("open_date", "2024-06-15"),
                }
                nodes.append(node_obj)
                self.accounts[ent["account_id"]] = node_obj

            max_risk = max((ent["risk_score"] for ent in entity_list if ent["role"] != "victim"), default=92.0)
            ring_status = "frozen" if block_enabled else "under_review"
            fingerprint = f"inj_{ring_id.lower()}_fp"
            amount_cashed = 0.0 if block_enabled else round(total_amount * 0.48, 2)
            amount_at_risk = 0.0 if block_enabled else total_amount

            new_alert = {
                "run_id": 1,
                "ring_id": ring_id,
                "fingerprint": fingerprint,
                "ring_type": typology,
                "score": max_risk,
                "priority": round(max_risk * (total_amount / 1000.0), 1),
                "amount_moved": total_amount,
                "amount_cashed": amount_cashed,
                "amount_at_risk": amount_at_risk,
                "duration_min": 4.0,
                "n_accounts": len(entity_list),
                "n_victims": 1,
                "pattern_tags": [typology, "live_simulation", "auto_freeze" if block_enabled else "active_threat"],
                "recommended": f"Autonomous ML Containment executed: Account {blocked_account_id} quarantined under PMLA Sec 5." if block_enabled else "Immediate freeze recommended.",
                "detected_at": now_iso,
                "case_id": case_id,
                "status": ring_status,
                "assigned_to": "TraceMesh AI Shield / Autonomous Detection Engine" if block_enabled else None,
                "case_notes": "Live simulation scenario detected dynamically by XGBoost & Graph Engine.",
                "explanation": f"Live stream evaluated: {typology} topology synthesized with ₹{total_amount:,.0f} transaction volume. Autonomous containment active.",
                "key_evidence": [
                    f"XGBoost Mule Probability: {detection_results.get('detected_ml_prob', 0.95) * 100:.1f}%",
                    f"Fused Risk Score: {detection_results.get('detected_fused_risk', 94.6):.1f}%",
                    f"Detectors Fired: {', '.join(detection_results.get('detectors_triggered', []))}",
                ],
                "blocked_info": blocked_info,
                "is_simulation": True,
            }

            full_ring = {
                **new_alert,
                "nodes": nodes,
                "edges": raw_edges,
                "blocked_info": blocked_info,
                "detection_results": detection_results,
            }

            timeline = [
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
                    "is_blocked": e.get("is_blocked", False),
                    "progress": idx / max(len(raw_edges), 1),
                }
                for idx, e in enumerate(raw_edges, 1)
            ]

            self.alerts = [a for a in self.alerts if a.get("ring_id") != ring_id]
            self.alerts.insert(0, new_alert)
            self.rings[ring_id] = full_ring
            self.timelines[ring_id] = timeline

            # Record case audit trail
            self.cases_actions[str(case_id)] = [
                {
                    "action_id": self.next_action_id,
                    "case_id": case_id,
                    "actor": "TraceMesh XGBoost & Graph Engine",
                    "action": "status_change",
                    "from_status": "new",
                    "to_status": "under_review",
                    "note": f"Detected {typology} ring across {len(entity_list)} accounts (63-feature XGBoost score: {detection_results.get('detected_ml_prob', 0.95) * 100:.1f}%).",
                    "ts": now_iso,
                }
            ]
            if block_enabled:
                self.next_action_id += 1
                self.cases_actions[str(case_id)].append({
                    "action_id": self.next_action_id,
                    "case_id": case_id,
                    "actor": "TraceMesh AI Shield / Autonomous Detection Engine",
                    "action": "freeze",
                    "from_status": "under_review",
                    "to_status": "frozen",
                    "note": blocked_reason or f"Account {blocked_account_id} frozen automatically.",
                    "ts": now_iso,
                })

            # Sync overview live rings & activity
            ov_rings = [r for r in self.overview.get("rings", []) if r.get("id") != ring_id]
            ov_rings.insert(0, {
                "id": ring_id,
                "typology": typology,
                "riskScore": max_risk,
                "totalMoved": total_amount,
                "amountAtRisk": amount_at_risk,
                "accountCount": len(entity_list),
                "status": ring_status,
            })
            self.overview["rings"] = ov_rings[:15]
            self.overview.setdefault("activity", []).insert(0, {
                "id": f"sim_act_{self.next_event_id}",
                "action": "freeze" if block_enabled else "status_change",
                "ringId": ring_id,
                "actor": "TraceMesh AI Shield" if block_enabled else "Detection Engine",
                "timestamp": now_iso,
                "note": f"Simulated {typology}: ₹{total_amount:,.0f}" + (f" · Account {blocked_account_id} frozen" if block_enabled else ""),
            })
            self.overview["activity"] = self.overview["activity"][:20]

            # Emit delta polling event
            self.delta_events.append({
                "event_id": self.next_event_id,
                "run_id": 1,
                "ring_id": ring_id,
                "event_type": "new_ring",
                "payload": new_alert,
                "created_at": now_iso,
            })
            self.delta_events = self.delta_events[-50:]

            self._save_sim_state()

            return {
                **full_ring,
                "success": True,
                "injected_ring_id": ring_id,
                "scenario_name": eval_res.get("scenario_name", "Live Account Takeover"),
                "total_amount": total_amount,
                "amount_saved": eval_res.get("amount_saved", 0.0),
                "timeline": timeline,
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

        # 9. Cases
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
            self.send_json(200, cases)
            return

        if path == "/audit/logs":
            self.send_json(200, [])
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

        if path == "/simulation/reset":
            self.send_json(200, STORE.reset_simulation())
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

        @app.get("/")
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
    except Exception:
        return None

# Export FastAPI app for Uvicorn if available
fastapi_app = create_fastapi_app()


async def asgi_handler(scope, receive, send):
    """
    Universal ASGI 3.0 Serverless Handler.
    Zero external dependencies, 100% resilient on Vercel Serverless.
    Dispatches all TraceMesh Module 2 endpoints with full CORS headers.
    """
    if scope.get("type") == "lifespan":
        while True:
            message = await receive()
            if message["type"] == "lifespan.startup":
                await send({"type": "lifespan.startup.complete"})
            elif message["type"] == "lifespan.shutdown":
                await send({"type": "lifespan.shutdown.complete"})
                return

    if scope.get("type") != "http":
        return

    method = scope.get("method", "GET").upper()
    raw_path = scope.get("path", "/") or "/"
    query_string = scope.get("query_string", b"").decode("utf-8")

    # Extract original path from Vercel rewrite headers if present
    for h_name, h_val in scope.get("headers", []):
        if h_name.lower() in (b"x-matched-path", b"x-forwarded-uri", b"x-original-uri"):
            val = h_val.decode("utf-8")
            if val and not val.endswith(".py"):
                if "?" in val:
                    val, qs = val.split("?", 1)
                    if not query_string:
                        query_string = qs
                raw_path = val
                break

    # Normalize path (strip trailing slashes and normalize /api/ prefix if present)
    path = raw_path.rstrip("/")
    if not path or path.endswith(".py"):
        path = "/"
    norm_path = path[4:] if path.startswith("/api/") else path
    if not norm_path:
        norm_path = "/"

    cors_headers = [
        (b"content-type", b"application/json; charset=utf-8"),
        (b"access-control-allow-origin", b"*"),
        (b"access-control-allow-methods", b"GET, POST, PUT, DELETE, OPTIONS, PATCH"),
        (b"access-control-allow-headers", b"Content-Type, Authorization, X-API-Key, Accept, X-Requested-With"),
    ]

    if method == "OPTIONS":
        await send({"type": "http.response.start", "status": 204, "headers": cors_headers})
        await send({"type": "http.response.body", "body": b""})
        return

    # Parse body
    body_bytes = b""
    if method in ("POST", "PUT", "PATCH"):
        more_body = True
        while more_body:
            msg = await receive()
            body_bytes += msg.get("body", b"")
            more_body = msg.get("more_body", False)

    payload = {}
    if body_bytes:
        try:
            payload = json.loads(body_bytes.decode("utf-8"))
        except Exception:
            payload = {}

    status_code = 200
    response_data = None

    if norm_path in ("/", "/health", "/api/health"):
        if method == "POST":
            # Resilient fallback: If proxy forwarded POST without path
            if (
                payload.get("scenario")
                or payload.get("scenario_name")
                or payload.get("typology")
                or payload.get("victim")
                or payload.get("transactions")
                or payload.get("entities")
                or payload.get("block_policy")
            ):
                response_data = STORE.inject_ring(payload)
            elif payload.get("speed") is not None:
                response_data = STORE.set_simulation_speed(float(payload.get("speed", 1.0)))
            elif payload.get("action"):
                response_data = STORE.execute_action(payload.get("ring_id", "R-104"), payload)
            else:
                response_data = {"status": "ok", "message": "Simulation action received"}
        else:
            response_data = {
                "status": "healthy",
                "service": "TraceMesh MuleNet API",
                "version": "1.0.0",
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "database": "mock_fixtures_loaded"
            }
    elif norm_path == "/alerts":
        query_params = parse_qs(query_string)
        filters = {
            "ring_type": query_params.get("ring_type", [None])[0],
            "status": query_params.get("status", [None])[0],
            "min_score": float(query_params["min_score"][0]) if "min_score" in query_params else None,
            "min_priority": float(query_params["min_priority"][0]) if "min_priority" in query_params else None,
            "since_event_id": int(query_params["since_event_id"][0]) if "since_event_id" in query_params else None,
            "limit": int(query_params["limit"][0]) if "limit" in query_params else None,
            "offset": int(query_params.get("offset", [0])[0]),
        }
        response_data = STORE.get_alerts(filters)
    elif norm_path == "/overview":
        response_data = STORE.get_overview()
    elif norm_path == "/metrics":
        response_data = STORE.get_metrics()
    elif norm_path == "/simulation/state":
        response_data = STORE.get_simulation_state()
    elif norm_path == "/simulation/start" and method == "POST":
        response_data = STORE.set_simulation_status("running")
    elif norm_path == "/simulation/pause" and method == "POST":
        response_data = STORE.set_simulation_status("paused")
    elif norm_path == "/simulation/reset" and method == "POST":
        response_data = STORE.reset_simulation()
    elif norm_path == "/simulation/speed" and method == "POST":
        speed = float(payload.get("speed", 1.0))
        response_data = STORE.set_simulation_speed(speed)
    elif norm_path in ("/simulation/run", "/simulation/inject_ring", "/simulation/custom", "/simulation/simulate") and method == "POST":
        response_data = STORE.inject_ring(payload)
    elif norm_path == "/cases":
        with STORE.lock:
            STORE._load_sim_state()
            cases_out = []
            for a in STORE.alerts[:35]:
                cid = a.get("case_id", 100)
                actions = STORE.cases_actions.get(str(cid), [])
                cases_out.append({
                    "case_id": cid,
                    "ring_id": a["ring_id"],
                    "fingerprint": a.get("fingerprint", f"fp_{a['ring_id'].lower()}"),
                    "status": a.get("status", "new"),
                    "priority": a.get("priority", 80),
                    "score": a.get("score", 90.0),
                    "ring_type": a.get("ring_type", "structural_cycle"),
                    "amount_moved": a.get("amount_moved", 500000),
                    "amount_at_risk": a.get("amount_at_risk", a.get("amount_moved", 500000)),
                    "n_accounts": a.get("n_accounts", 4),
                    "n_victims": a.get("n_victims", 1),
                    "assigned_to": a.get("assigned_to"),
                    "notes": a.get("case_notes"),
                    "created_at": a.get("detected_at"),
                    "updated_at": actions[-1]["ts"] if actions else a.get("detected_at"),
                    "actions_count": len(actions),
                })
            response_data = cases_out
    elif norm_path == "/audit/logs":
        with STORE.lock:
            STORE._load_sim_state()
            case_meta = {
                str(a.get("case_id")): {
                    "ring_id": a.get("ring_id"),
                    "ring_type": a.get("ring_type", "structural_cycle"),
                }
                for a in STORE.alerts
                if a.get("case_id") is not None
            }
            all_logs = []
            for str_cid, actions in STORE.cases_actions.items():
                meta = case_meta.get(str_cid, {"ring_id": f"CASE-{str_cid}", "ring_type": "structural_cycle"})
                for act in actions:
                    all_logs.append({
                        **act,
                        "ring_id": meta["ring_id"],
                        "ring_type": meta["ring_type"],
                    })
            all_logs.sort(key=lambda x: x.get("ts", ""), reverse=True)
            response_data = all_logs
    elif norm_path.startswith("/rings/"):
        parts = norm_path.strip("/").split("/")
        if len(parts) == 2:
            ring_id = unquote(parts[1])
            ring = STORE.get_ring(ring_id)
            if ring:
                response_data = ring
            else:
                status_code = 404
                response_data = {"error": "NOT_FOUND", "message": f"Ring '{ring_id}' not found."}
        elif len(parts) == 3 and parts[2] == "timeline":
            ring_id = unquote(parts[1])
            response_data = STORE.get_timeline(ring_id)
        elif len(parts) == 3 and parts[2] == "action" and method == "POST":
            ring_id = unquote(parts[1])
            result = STORE.execute_action(ring_id, payload)
            if result:
                response_data = result
            else:
                status_code = 404
                response_data = {"error": "NOT_FOUND", "message": f"Ring '{ring_id}' not found."}
        else:
            status_code = 404
            response_data = {"error": "NOT_FOUND", "message": f"Route '{norm_path}' not found."}
    elif norm_path.startswith("/accounts/"):
        parts = norm_path.strip("/").split("/")
        if len(parts) == 2:
            account_id = unquote(parts[1])
            acc = STORE.get_account(account_id)
            if acc:
                response_data = acc
            else:
                status_code = 404
                response_data = {"error": "NOT_FOUND", "message": f"Account '{account_id}' not found."}
        else:
            status_code = 404
            response_data = {"error": "NOT_FOUND", "message": f"Route '{norm_path}' not found."}
    elif norm_path.startswith("/cases/"):
        parts = norm_path.strip("/").split("/")
        if len(parts) == 3 and parts[2] == "actions":
            try:
                case_id = int(parts[1])
                response_data = STORE.get_case_actions(case_id)
            except ValueError:
                status_code = 400
                response_data = {"error": "BAD_REQUEST", "message": "Invalid case_id."}
        else:
            status_code = 404
            response_data = {"error": "NOT_FOUND", "message": f"Route '{norm_path}' not found."}
    else:
        status_code = 404
        response_data = {"error": "NOT_FOUND", "message": f"Endpoint '{norm_path}' not found."}

    res_bytes = json.dumps(response_data, indent=2).encode("utf-8")
    await send({"type": "http.response.start", "status": status_code, "headers": cors_headers})
    await send({"type": "http.response.body", "body": res_bytes})


async def app(scope, receive, send):
    """
    Primary Entrypoint for Vercel Serverless.
    Directly dispatches to pure-Python ASGI handler with Vercel rewrite header support.
    """
    return await asgi_handler(scope, receive, send)


handler = app
application = app


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
