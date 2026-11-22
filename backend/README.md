# TraceMesh Backend: Module 2 (API Contract, Mock Server, Fixtures)

This module delivers the complete OpenAPI 3.1 specification, standalone and FastAPI-compatible mock server, and schema-compliant fixtures for frontend and full-stack development.

---

## 1. Quick Start

### Option A: Standalone Runner (Zero Dependencies)
Run directly with Python 3 (uses Python's built-in standard library):
```bash
python3 backend/mock_server.py --port 8000
```

### Option B: FastAPI / Uvicorn (Production Server)
If you have `uvicorn` and `fastapi` installed:
```bash
uvicorn backend.mock_server:app --host 0.0.0.0 --port 8000 --reload
```

Server URL: `http://localhost:8000`

---

## 2. API Contract Specification

The full OpenAPI 3.1 contract is located at:
* [`docs/openapi.yaml`](../docs/openapi.yaml)

It specifies all request, response, and error schemas across 11 core endpoints:
- `GET /health`: Health and connectivity status.
- `GET /alerts`: Alert queue triage (query params: `ring_type`, `status`, `min_score`, `min_priority`, `since_event_id`, `limit`, `offset`).
- `GET /rings/{ring_id}`: Full graph topology (nodes with assigned roles & risk scores, directed multigraph edges).
- `GET /rings/{ring_id}/timeline`: Chronological transaction sequence with normalized playback progress (0.0 to 1.0).
- `GET /accounts/{account_id}`: Single account anomaly breakdown, SHAP reason codes, and detector hits.
- `POST /rings/{ring_id}/action`: Executes analyst intervention (`freeze`, `escalate`, `false_positive`, `note`, `status_change`) and writes immutable audit entry.
- `GET /cases/{case_id}/actions`: Append-only compliance audit trail for a case.
- `GET /metrics`: Model evaluation dataset, 4-way method comparison, PR/ROC curves, and fairness tables.
- `GET /overview`: Executive dashboard KPIs, alert volume time series, and critical rings.
- `GET /simulation/state`, `POST /simulation/start`, `/pause`, `/speed`, `/inject_ring`: Demo playback and real-time ring injection.

---

## 3. Fixtures Catalog (`backend/fixtures/`)

| Fixture File | Endpoint | Description |
|---|---|---|
| [`alerts.json`](./fixtures/alerts.json) | `GET /alerts` | 7 candidate rings covering all typologies + hard negative |
| [`rings.json`](./fixtures/rings.json) | `GET /rings/{id}` | Directed multigraph node & edge datasets for all 5 archetypes + mixed + kirana merchant |
| [`timelines.json`](./fixtures/timelines.json) | `GET /rings/{id}/timeline` | Ordered transaction replays with hop indices and progress markers |
| [`accounts.json`](./fixtures/accounts.json) | `GET /accounts/{id}` | Enriched account profiles with SHAP feature attributions |
| [`cases_actions.json`](./fixtures/cases_actions.json) | `GET /cases/{id}/actions` | Immutable audit trail records conforming to `case_actions` |
| [`metrics.json`](./fixtures/metrics.json) | `GET /metrics` | Model benchmarks (PR-AUC 0.942, 97.8% alert reduction, fairness metrics) |
| [`overview.json`](./fixtures/overview.json) | `GET /overview` | Executive KPI cards and alert volume trends |
| [`simulation.json`](./fixtures/simulation.json) | `GET /simulation/state` | Virtual simulation clock and speed controls |

### Ring Typologies Covered
1. **`R-101`**: Fan-In Burst & Collector Fan-Out (`burst_fanin` / `fan_in_fan_out`)
2. **`R-102`**: Rapid Pass-Through Hub (`rapid_pass_through` / `pass_through_hub`)
3. **`R-103`**: Dormant-then-Active account (`dormant_activation` / `dormant_active`)
4. **`R-104`**: Circular Flow (`structural_cycle` / `circular_flow`)
5. **`R-105`**: Layering Chain (`layering_chain`)
6. **`R-106`**: Composite Syndicate (`mixed` - cycle + fan-out + ATM sinks)
7. **`R-107`**: Benign Retail Merchant (`hard_negative_shop` - kirana store, retains 93.3% funds, low risk score 24, false positive)

---

## 4. Running the Test Suite

Execute the unit test suite verifying all 10 endpoint scenarios:
```bash
python3 tests/test_mock_server.py
```

Expected output:
```
----------------------------------------------------------------------
Ran 10 tests in 0.644s

OK
```

---

## 5. Frontend Integration

In [`frontend/.env`](../frontend/.env) or Vite config:
```bash
VITE_API_BASE_URL="http://localhost:8000"
VITE_USE_MOCK=false
VITE_API_TOKEN="tracemesh-hackathon-token-2026"
```
The mock server automatically provides CORS headers (`Access-Control-Allow-Origin: *`) and supports live state mutations (e.g. freezing a ring in the UI updates the alert status and appends to the audit log).

---

## 6. Dataset Loaders & Validation (Module 5)

Module 5 provides the robust ingestion engine to validate, reset, and bulk-load synthetic and benchmark datasets into PostgreSQL (Supabase / local Docker).

### Architecture & Isolation
- **Validator** ([`backend/validation.py`](./validation.py)): Pre-load integrity gate verifying all 10 invariants from `datasetguide.md` Section 10 (no orphan accounts, self-transfers, negative amounts, out-of-order timestamps, enum validity, mule/victim consistency). Fails with readable error reports before touching the database.
- **Raw Loader** ([`backend/raw_loader.py`](./raw_loader.py)): Handles raw transactions and customer accounts. Registers active dataset metadata into `datasets` table. Provides helper to remove injected demo transactions.
- **Ground-Truth Loader** ([`backend/gt_loader.py`](./gt_loader.py)): Strictly quarantined loader for `gt_rings`, `gt_accounts`, and `gt_transactions`. Quarantined from detector algorithms and feature extraction.
- **CLI Orchestrator** ([`backend/loader.py`](./loader.py)): Single entrypoint enforcing transactional all-or-nothing atomicity, pre-load reset via `fn_reset_active_dataset()` (preserving analyst cases and audit log), and foreign-key dependency ordering:
  `gt_rings` -> `accounts` -> `gt_accounts` -> `transactions` -> `gt_transactions`.

### Usage & Commands

```bash
# 1. Validate a dataset folder without writing anything:
python3 -m backend.loader --dataset toy --validate-only

# 2. Preview full SQL transaction script (Dry Run):
python3 -m backend.loader --dataset toy --dry-run

# 3. Generate high-performance PostgreSQL \copy script:
python3 -m backend.loader --dataset toy --format copy -o scripts/load_toy_copy.sql --dry-run

# 4. Generate universal SQL INSERT script (for Supabase Browser SQL Editor):
python3 -m backend.loader --dataset toy --format insert -o scripts/seed_toy_insert.sql --dry-run

# 5. Execute load directly via psql into PostgreSQL:
python3 -m backend.loader --dataset toy

# 6. Run the Module 5 test suite (18 unit tests):
python3 -m unittest tests/test_loaders.py -v
```

---

## 7. Pipeline Runner & Real Database API (Module 11)

Module 11 unifies detection, feature extraction, neighbor risk contagion, risk score fusion, ring clustering, Jaccard case linking, and database persistence into an automated pipeline runner and real API service.

### Components
- **Case Linking Engine** ([`backend/case_linking.py`](./case_linking.py)): Deduplicates candidate rings across pipeline runs using Jaccard membership set similarity ($|A \cap B| / |A \cup B|$). If Jaccard similarity $\ge 0.60$, links to the existing case; if $< 0.60$, provisions a new case.
- **Database Client** ([`backend/db.py`](./db.py)): Unified PostgreSQL / Supabase client with connection latency tracking, structured JSON querying, and seamless offline resilience.
- **Pipeline Runner** ([`backend/pipeline.py`](./pipeline.py)): CLI orchestrator that loads active raw data, executes the 6 detectors, fuses risk scores, clusters rings, links cases, and commits the run transactionally to `pipeline_runs`, `account_scores`, `detector_hits`, `rings`, `ring_members`, and `ring_transactions`.
- **Production API Server** ([`backend/real_server.py`](./real_server.py)): Database-backed REST API serving live queries from Supabase (`v_alerts`, `rings`, `cases`, `case_actions`, `account_scores`) with fallback to local fixtures when offline.

### Usage & Commands

```bash
# 1. Run the end-to-end detection pipeline on canonical toy data (Dry Run):
python3 -m backend.pipeline --dataset data/toy --run-id 1 --dry-run

# 2. Export transactional SQL script for database execution:
python3 -m backend.pipeline --dataset data/toy --run-id 1 -o scripts/run_pipeline_toy.sql

# 3. Start the Production API Server (listening on http://localhost:8000):
python3 backend/real_server.py 8000

# 4. Run the full Module 11 test suite (12 unit tests):
python3 -m unittest tests/test_pipeline.py -v

# 5. Run all 40 backend unit tests (Modules 2, 5, 11):
python3 -m unittest tests/test_mock_server.py tests/test_loaders.py tests/test_pipeline.py
```

---

## 8. Streaming Simulation & Live Ring Injector (Module 12b)

Module 12b delivers the real-time simulation engine powering the interactive presentation cockpit.

### Capabilities
- **Simulation Engine** ([`backend/simulation.py`](./simulation.py)): Virtual clock daemon advancing `cursor_ts` at variable speeds (1x, 5x, 20x, 60x). Controls playback lifecycle (`start`, `pause`, `reset`, `set_speed`).
- **Delta Polling Support**: Sequentially numbered `alert_events` queue (`new_ring`, `ring_updated`, `injection_started`). Frontend polls `GET /alerts?since_event_id=X` every 2s to receive instantaneous live toast alerts.
- **Dynamic Ring Injector (`inject_ring`)**: Synthesizes ad-hoc money laundering syndicates (`circular_flow`, `fan_in_burst`, `layering_chain`, `pass_through_hub`) with `is_injected = true` and unique `injection_id`, immediately triggering detection and publishing real-time events.

### Usage & Commands

```bash
# 1. Run Module 12b unit tests (10 unit tests):
python3 -m unittest tests/test_simulation.py -v

# 2. Run all 50 backend unit tests (Modules 2, 5, 11, 12b):
python3 -m unittest tests/test_mock_server.py tests/test_loaders.py tests/test_pipeline.py tests/test_simulation.py
```

---

## 9. Explanation Engine & Compliance Dictionary (Module 15)

Module 15 provides auditor-ready, deterministic AML compliance explanations, reason codes, and hallucination-free narratives.

### Capabilities
- **Reason-Code Dictionary** ([`docs/reason_codes.md`](../docs/reason_codes.md)): Institutional AML dictionary mapping structural anomalies (`CYCLE_DETECTED`, `BURST_INFLOW_RATIO`, `RAPID_PASS_THROUGH`, `LAYERING_CHAIN`, `DORMANT_ACTIVATION`) and mitigating profiles to standardized regulatory narratives.
- **Deterministic Explanation Generator** ([`backend/explanation.py`](./explanation.py)): Computes executive headlines, verifiable facts (exact amounts, hop counts, durations), role breakdowns (guaranteeing victims are never flagged for freezing), and tiered compliance recommendations.
- **Anti-Hallucination Numerical Guard** (`validate_narrative_numbers`): Verifies that every number, rupee amount, and percentage in any narrative appears verbatim in the verified source facts.

### Usage & Commands

```bash
# 1. Run Module 15 unit tests (8 unit tests):
python3 -m unittest tests/test_explanation.py -v

# 2. Run all 58 backend unit tests (Modules 2, 5, 11, 12b, 15):
python3 -m unittest tests/test_mock_server.py tests/test_loaders.py tests/test_pipeline.py tests/test_simulation.py tests/test_explanation.py
```




