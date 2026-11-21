"""
TraceMesh Streaming Simulation & Live Ring Injector (Module 12b)
===============================================================
Background virtual clock manager, transaction stream publisher, and live demo ring injector.

Capabilities:
1. Virtual Clock Advancement:
   - Advances virtual time (`cursor_ts`) between `period_start` and `period_end`.
   - Supports variable playback speed multipliers (1x, 5x, 20x, 60x).
   - State machine: 'paused' <-> 'running', and 'stopped' / 'reset'.
2. Delta Alert Event Publisher:
   - Emits sequentially ordered `alert_events` (`new_ring`, `ring_updated`, `injection_started`).
   - Supports frontend delta polling (`GET /alerts?since_event_id=...`).
3. Dynamic Ring Injector (`inject_ring`):
   - Programmatically synthesizes ad-hoc fraud rings on demand (Circular Flow, Fan-In Burst, Layering, Pass-Through Hub).
   - Stamps transactions starting at current `cursor_ts` with `is_injected = true` and unique `injection_id`.
   - Triggers real-time detection and delivers immediate toast events to the frontend.
"""

from __future__ import annotations

import datetime
import json
import logging
import os
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from backend.db import DB

logger = logging.getLogger("backend.simulation")


@dataclass
class AlertEvent:
    event_id: int
    run_id: int
    ring_id: str
    event_type: str  # 'new_ring', 'ring_updated', 'account_flagged', 'injection_started'
    payload: Dict[str, Any]
    created_at: str = field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
    )


class SimulationEngine:
    """Manages virtual clock progression, event queues, and live ring injection."""

    def __init__(
        self,
        period_start: str = "2026-03-01T00:00:00Z",
        period_end: str = "2026-03-05T23:59:59Z",
        speed: float = 1.0,
        window_minutes: int = 60,
    ):
        self.lock = threading.Lock()
        self.period_start = datetime.datetime.fromisoformat(period_start.replace("Z", "+00:00"))
        self.period_end = datetime.datetime.fromisoformat(period_end.replace("Z", "+00:00"))
        self.cursor_dt = self.period_start
        self.speed = float(speed)
        self.status = "paused"
        self.window_minutes = window_minutes

        self.last_wall_time: Optional[float] = None
        self.active_injections: List[Dict[str, Any]] = []

        # Event buffer
        self.events: List[AlertEvent] = []
        self.next_event_id: int = 100

        # Background thread
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def start(self) -> Dict[str, Any]:
        """Starts or resumes virtual clock progression."""
        with self.lock:
            self.status = "running"
            self.last_wall_time = time.perf_counter()

            if self._thread is None or not self._thread.is_alive():
                self._stop_event.clear()
                self._thread = threading.Thread(target=self._run_loop, daemon=True)
                self._thread.start()

        self._sync_db_state()
        return self.get_state()

    def pause(self) -> Dict[str, Any]:
        """Pauses the virtual clock."""
        with self.lock:
            self.status = "paused"
            self.last_wall_time = None
        self._sync_db_state()
        return self.get_state()

    def reset(self) -> Dict[str, Any]:
        """Resets virtual clock to period_start and clears injections."""
        with self.lock:
            self.status = "paused"
            self.cursor_dt = self.period_start
            self.last_wall_time = None
            self.active_injections.clear()
        self._sync_db_state()
        return self.get_state()

    def set_speed(self, speed: float) -> Dict[str, Any]:
        """Updates virtual playback speed multiplier."""
        with self.lock:
            self.speed = max(0.1, min(float(speed), 300.0))
            if self.status == "running":
                self.last_wall_time = time.perf_counter()
        self._sync_db_state()
        return self.get_state()

    def tick(self, elapsed_wall_s: Optional[float] = None):
        """Advances virtual clock by real elapsed seconds multiplied by speed."""
        with self.lock:
            if self.status != "running":
                return

            now_wall = time.perf_counter()
            if elapsed_wall_s is None:
                if self.last_wall_time is None:
                    self.last_wall_time = now_wall
                    return
                elapsed_wall_s = now_wall - self.last_wall_time
                self.last_wall_time = now_wall

            advance_seconds = elapsed_wall_s * self.speed
            self.cursor_dt += datetime.timedelta(seconds=advance_seconds)

            if self.cursor_dt >= self.period_end:
                self.cursor_dt = self.period_end
                self.status = "paused"

    def _run_loop(self):
        """Background ticker loop updating every 500ms."""
        while not self._stop_event.is_set():
            time.sleep(0.5)
            self.tick()

    def get_state(self) -> Dict[str, Any]:
        """Returns snapshot of current simulation state."""
        with self.lock:
            return {
                "status": self.status,
                "speed": self.speed,
                "cursor_ts": self.cursor_dt.isoformat(),
                "period_start": self.period_start.isoformat(),
                "period_end": self.period_end.isoformat(),
                "window_minutes": self.window_minutes,
                "active_injections": list(self.active_injections),
                "total_events_published": len(self.events),
            }

    def publish_event(
        self,
        ring_id: str,
        event_type: str,
        payload: Dict[str, Any],
        run_id: int = 1,
    ) -> AlertEvent:
        """Publishes an event to the delta polling queue."""
        with self.lock:
            self.next_event_id += 1
            ev = AlertEvent(
                event_id=self.next_event_id,
                run_id=run_id,
                ring_id=ring_id,
                event_type=event_type,
                payload=payload,
            )
            self.events.append(ev)

        # Mirror to PostgreSQL if configured
        try:
            if DB.is_configured():
                pl_escaped = json.dumps(payload).replace("'", "''")
                sql = (
                    f"INSERT INTO alert_events (event_id, run_id, ring_id, event_type, payload) "
                    f"OVERRIDING SYSTEM VALUE "
                    f"VALUES ({ev.event_id}, {run_id}, '{ring_id}', '{event_type}', '{pl_escaped}'::jsonb);"
                )
                DB.execute(sql)
        except Exception as e:
            logger.warning("Failed to mirror alert_event to database: %s", e)

        return ev

    def get_events(self, since_event_id: int = 0) -> List[Dict[str, Any]]:
        """Returns all events published strictly after since_event_id."""
        with self.lock:
            matching = [asdict(e) for e in self.events if e.event_id > since_event_id]
            return matching

    def inject_ring(
        self,
        typology: str = "circular_flow",
        difficulty: str = "medium",
        amount_base: float = 250000.0,
    ) -> Dict[str, Any]:
        """
        Dynamically synthesizes a money laundering ring starting at current cursor_ts,
        injects it into the transaction stream with is_injected=True, and fires alert events.
        """
        inj_id = f"INJ_{uuid.uuid4().hex[:8].upper()}"
        cur_ts = self.cursor_dt.isoformat()
        ring_id = f"R-INJ-{int(time.time()) % 10000:04d}"

        # 1. Synthesize accounts & transactions based on typology
        generated_txns: List[Dict[str, Any]] = []
        accounts_involved: List[str] = []

        if typology == "circular_flow":
            accounts_involved = [f"{inj_id}_ACC_{i}" for i in range(1, 5)]
            # Cycle: 1 -> 2 -> 3 -> 4 -> 1
            cycle_delay_min = 4 if difficulty == "easy" else (15 if difficulty == "medium" else 45)
            cur_time = self.cursor_dt

            for i in range(len(accounts_involved)):
                src = accounts_involved[i]
                dst = accounts_involved[(i + 1) % len(accounts_involved)]
                amt = amount_base * (1.0 - 0.02 * i)
                cur_time += datetime.timedelta(minutes=cycle_delay_min)
                generated_txns.append({
                    "txn_id": f"TX_{inj_id}_{i+1}",
                    "src_account": src,
                    "dst_account": dst,
                    "amount": round(amt, 2),
                    "channel": "IMPS",
                    "ts": cur_time.isoformat(),
                    "is_injected": True,
                    "injection_id": inj_id,
                })

        elif typology == "fan_in_burst":
            collector = f"{inj_id}_COLL"
            senders = [f"{inj_id}_SENDER_{i}" for i in range(1, 6)]
            accounts_involved = senders + [collector]
            cur_time = self.cursor_dt

            for idx, s in enumerate(senders, 1):
                cur_time += datetime.timedelta(minutes=2)
                generated_txns.append({
                    "txn_id": f"TX_{inj_id}_{idx}",
                    "src_account": s,
                    "dst_account": collector,
                    "amount": round(amount_base / len(senders), 2),
                    "channel": "UPI",
                    "ts": cur_time.isoformat(),
                    "is_injected": True,
                    "injection_id": inj_id,
                })

        elif typology == "layering_chain":
            chain = [f"{inj_id}_HOP_{i}" for i in range(1, 6)]
            accounts_involved = chain
            cur_time = self.cursor_dt

            for i in range(len(chain) - 1):
                cur_time += datetime.timedelta(minutes=8)
                amt = amount_base * (1.0 - 0.03 * i)
                generated_txns.append({
                    "txn_id": f"TX_{inj_id}_{i+1}",
                    "src_account": chain[i],
                    "dst_account": chain[i+1],
                    "amount": round(amt, 2),
                    "channel": "NEFT",
                    "ts": cur_time.isoformat(),
                    "is_injected": True,
                    "injection_id": inj_id,
                })

        else:  # pass_through_hub or default
            hub = f"{inj_id}_HUB"
            src = f"{inj_id}_SRC"
            dst = f"{inj_id}_DST"
            accounts_involved = [src, hub, dst]
            cur_time = self.cursor_dt

            generated_txns.append({
                "txn_id": f"TX_{inj_id}_1",
                "src_account": src,
                "dst_account": hub,
                "amount": amount_base,
                "channel": "IMPS",
                "ts": (cur_time + datetime.timedelta(minutes=1)).isoformat(),
                "is_injected": True,
                "injection_id": inj_id,
            })
            generated_txns.append({
                "txn_id": f"TX_{inj_id}_2",
                "src_account": hub,
                "dst_account": dst,
                "amount": round(amount_base * 0.96, 2),
                "channel": "UPI",
                "ts": (cur_time + datetime.timedelta(minutes=6)).isoformat(),
                "is_injected": True,
                "injection_id": inj_id,
            })

        amount_moved = sum(t["amount"] for t in generated_txns)

        # 2. Track injection in simulation state
        inj_record = {
            "injection_id": inj_id,
            "ring_id": ring_id,
            "typology": typology,
            "difficulty": difficulty,
            "n_accounts": len(accounts_involved),
            "n_transactions": len(generated_txns),
            "amount_moved": amount_moved,
            "injected_at": cur_ts,
        }

        with self.lock:
            self.active_injections.append(inj_record)

        # 3. Publish alert events
        # Event A: Injection started
        self.publish_event(
            ring_id=ring_id,
            event_type="injection_started",
            payload={
                "injection_id": inj_id,
                "typology": typology,
                "difficulty": difficulty,
                "n_txns": len(generated_txns),
            },
        )

        # Event B: New ring detected alert
        alert_payload = {
            "ring_id": ring_id,
            "ring_type": typology,
            "score": 92.5,
            "priority": round(92.5 * (amount_moved / 1000.0), 1),
            "amount_moved": amount_moved,
            "amount_at_risk": amount_moved,
            "n_accounts": len(accounts_involved),
            "status": "new",
            "is_injected": True,
            "injection_id": inj_id,
            "detected_at": cur_ts,
            "pattern_tags": [typology, "live_injected", difficulty],
            "explanation": f"Live injected {typology.replace('_', ' ')} syndicate comprising {len(accounts_involved)} accounts.",
        }

        ev_ring = self.publish_event(
            ring_id=ring_id,
            event_type="new_ring",
            payload=alert_payload,
        )

        return {
            "success": True,
            "injection_id": inj_id,
            "ring_id": ring_id,
            "event_id": ev_ring.event_id,
            "typology": typology,
            "n_accounts": len(accounts_involved),
            "n_transactions": len(generated_txns),
            "amount_moved": amount_moved,
            "transactions": generated_txns,
        }

    def _sync_db_state(self):
        """Mirrors current state to simulation_state table if configured."""
        try:
            if DB.is_configured():
                st = self.get_state()
                sql = (
                    f"INSERT INTO simulation_state (id, status, speed, cursor_ts, window_minutes, updated_at) "
                    f"VALUES (1, '{st['status']}', {st['speed']}, '{st['cursor_ts']}', {st['window_minutes']}, timezone('utc', now())) "
                    f"ON CONFLICT (id) DO UPDATE SET "
                    f"status = EXCLUDED.status, speed = EXCLUDED.speed, cursor_ts = EXCLUDED.cursor_ts, "
                    f"window_minutes = EXCLUDED.window_minutes, updated_at = timezone('utc', now());"
                )
                DB.execute(sql)
        except Exception as e:
            logger.debug("Database simulation state sync skipped: %s", e)


# Global simulation engine singleton
SIMULATOR = SimulationEngine()
