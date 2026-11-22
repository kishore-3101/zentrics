# Module 12: Streaming and Simulation

**Owners:** Split across 4 members (12a: GR, 12b: BE, 12c: ML-A, 12d: FE). **Backup:** BE (engine), FE (UI). **Days:** 8-12. See `plan.md` Section 11 and `plan_v2.md` Sections 3 and 6.

## Goal
Deliver a rock-solid, visually dramatic live demonstration on stage where streaming transactions flow through time, rings emerge dynamically, alerts pop up in real time via delta polling, and judges can inject a new ring on demand.

## Split of Responsibility
| Sub-part | Component | Owner | Deliverable | Days |
|---|---|---|---|---|
| **12a** | Incremental sliding-window detection | **GR** | Windowed graph updater, 1-hop neighborhood re-evaluator | 10-11 |
| **12b** | Simulation worker & event publisher | **BE** | Background playback loop, clock advancement, `alert_events` publisher, simulation REST endpoints | 8, 10-11 |
| **12c** | Curated demo stream & `inject_ring` function | **ML-A** | `demo` dataset timeline, programmatic transaction injector | 9-11 |
| **12d** | Simulation controls & delta polling UI | **FE** | Play/pause/speed toolbar, ring injector modal, 2s polling hook | 11-12 |

## Sub-part Deliverables

### 12a: Incremental Detection Engine (Owner: GR)
- Sliding-window graph manager maintaining the active temporal window (default: 60 minutes).
- As new transactions arrive from the simulator, updates node degrees and adjacency lists in-memory.
- Re-evaluates only **touched accounts and their immediate 1-hop counterparties**, avoiding full-graph re-computation.
- Re-scores active ring clusters; if a cluster crosses the alert threshold, flags it as a new or updated ring candidate.

### 12b: Simulation Worker & State Publisher (Owner: BE)
- Background daemon process reading demo transactions in strict chronological order.
- Controls the virtual clock stored in `simulation_state`: `cursor_ts`, `speed` (1x, 5x, 20x, 60x), and `status` (`running`, `paused`, `stopped`).
- When 12a emits a new or updated ring: writes a row to `alert_events(run_id, ring_id, event_type, payload)` and commits.
- Endpoints:
  - `POST /simulation/start`: starts virtual clock progression.
  - `POST /simulation/pause`: pauses clock.
  - `POST /simulation/speed`: updates playback speed multiplier.
  - `POST /simulation/inject_ring`: calls 12c inject function and immediately pushes transactions into the stream.
  - `GET /simulation/state`: returns current `cursor_ts`, status, and speed.

### 12c: Curated Demo Stream & Ring Injector (Owner: ML-A)
- Curated `demo` dataset (2,000-3,000 accounts): contains background baseline noise, a hard-negative merchant that remains unflagged, and three pre-staged rings that trigger at distinct minutes (e.g. at T+20s, T+45s, T+90s).
- `inject_ring(ring_type, difficulty, current_ts)` function:
  - Dynamically synthesizes transaction records for an ad-hoc ring (e.g. 5-node circular flow or 15-node fan-in burst).
  - Sets transaction timestamps starting exactly at `current_ts`.
  - Sets `is_injected = true` and tags with unique `injection_id` for easy post-demo cleanup.
  - Writes directly into `transactions` table.

### 12d: Simulation UI Controls & Live Polling (Owner: FE)
- Simulation control bar in dashboard header: Play, Pause, Reset buttons, Speed dropdown, Virtual time ticker.
- Delta polling hook: polls `GET /alerts?since_event_id={latest_event_id}` every 2 seconds.
- When an event arrives: displays an unobtrusive toast notification ("New High-Priority Ring Detected: #R-104"), increments the alert count badge, and animates the new row into the Alert Queue table.
- "Inject Ring" modal button: allows judges to select Ring Typology (e.g. "Circular Flow") and Difficulty ("Hard"), submitting to `POST /simulation/inject_ring`.

## Schedule
- Day 8: BE implements `simulation_state` table operations and mock simulation endpoints (12b).
- Day 9: ML-A finishes curated demo stream file (12c).
- Day 10: GR builds incremental window graph updater (12a); ML-A completes `inject_ring` function (12c).
- Day 11: FE implements simulation toolbar and injector modal (12d); **Integration 3** dry run.
- Day 12: End-to-end stress testing under Wi-Fi disconnection scenarios; polish transitions.

## Can start when
Day 8 for BE and FE API contracts; Day 10 for GR detection logic.

## Hard dependency
End-to-end live testing requires Module 11 pipeline runner and Module 4 demo dataset.

## Stand-in while blocked
The simulation worker emits pre-scripted fixture events from a JSON log file on a simple timer.

## Done when
In the dress rehearsal, presenter presses "Start", watch transactions tick forward on screen, sees an alert appear within 3 seconds of a planted burst, clicks "Inject Ring", and observes the newly injected ring appear in the alert queue with explanation and graph ready to explore.

