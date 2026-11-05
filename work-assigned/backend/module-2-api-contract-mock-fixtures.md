# Module 2: API Contract, Mock Server, Fixtures

**Owner:** BE. **Backup:** FE. **Days:** 2-3 (contract and mock server Day 2, fixtures Day 2-3, kept in sync after).

## Goal
Let FE build the entire user interface before any real detection or ML pipeline exists.

## Deliverables
1. API description file (OpenAPI) covering every endpoint below, with request, response, and error shapes.
2. Mock server returning fixtures with the exact same paths and response shapes as the real API.
3. Fixtures: one JSON file per endpoint, and ring examples for **each of the five ring types plus mixed**, including one false-positive-looking hard-negative ring.

## Endpoints (from plan.md 10.3, updated for schema v2)
| Endpoint | Purpose |
|---|---|
| GET /alerts (filters, sort, `since_event_id`) | Alert queue; reads `v_alerts` |
| GET /rings/{ring_id} | Members with roles and risk, edges (from `ring_transactions`), scores, explanation, pattern tags |
| GET /rings/{ring_id}/timeline | Time-ordered transactions for replay |
| GET /accounts/{account_id} | Profile, features, reason codes, ring membership |
| POST /rings/{ring_id}/action | freeze, escalate, false_positive, note; writes audit log |
| GET /cases/{case_id}/actions | Audit log |
| GET /metrics | Overall, by method, by segment, plus curve artifacts |
| GET /overview | KPI cards, trend, top 5 rings |
| POST /simulation/start, pause, speed, inject_ring | Demo controls |
| GET /simulation/state | Status, cursor time |
| GET /health | For deployment checks |

Rules: one token header; consistent error body; pagination on lists; money as numbers with two decimals; timestamps ISO-8601 UTC.

## Tasks
- BE drafts the contract Day 2 morning; reviews with FE by lunch; freezes by evening.
- BE creates mock fixtures from the plan's examples (amounts, pattern tags, reason codes). Facts inside a fixture must be internally consistent (the numbers in the explanation match the ring numbers), because the explanation engine and UI are tested on them.
- After the freeze, any schema or endpoint change goes through the group chat.

## Can start when
Day 1 for the contract draft (needs only `new_schema.sql`). No blockers.

## Blocks others
FE (Modules 13, 14, 16). Workaround: FE may start with hard-coded scaffold components for a few hours on Day 1.

## Done when
Every team member can run the mock server locally (`uvicorn backend.mock_server:app`); FE renders the alert queue and graph view from it; fixtures cover all five ring archetypes.
