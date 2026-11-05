# Modules: Map, Owners and Dependencies (5-Person Team)

17 modules. Each module file says: owner, backup, days, goal, inputs, deliverables, tasks, **can start when**, **hard blocker (if any)**, **stand-in while blocked**, and done criteria. Day numbers follow the updated 5-person schedule.

## 1. Owners at a glance (5-Person Team)

| # | Module | Owner | Backup | Days |
|---|---|---|---|---|
| 1 | Foundation: Supabase, migrations, Docker, offline bundle | BE | ML-A | 1-2, 12 |
| 2 | API contract, mock server, fixtures | BE | FE | 2-3 |
| 3 | Toy and sample datasets, data contract | ML-A | ML-B | 1-3 |
| 4 | Full dataset generator (core, rings, hard negatives, splits, demo, stress) | ML-A (core, 3 ring types, negatives, knobs, sets) + ML-B (2 ring templates, data review) | each other | 1-12 |
| 5 | Loaders and validation (CSV to Postgres) | BE | ML-A | 3-4 |
| 6 | Graph builder and six detectors | GR | ML-B | 1-6 |
| 7 | Community detection, ring clustering, ring scoring, roles | GR | ML-B | 7-8 |
| 8 | Baselines and feature pipeline | ML-B | ML-A | 1-5 |
| 9 | XGBoost, SHAP reason codes, neighbour risk, fusion | ML-B | ML-A | 6-11 |
| 10 | Evaluation harness, ablations, robustness | ML-A | ML-B | 7-13 |
| 11 | Pipeline runner and real API | BE | ML-A (runner), FE (API) | 4-11 |
| 12 | Streaming and simulation (12a GR, 12b BE, 12c ML-A, 12d FE) | split | see file | 8-12 |
| 13 | Frontend shell, alert queue, overview | FE | BE | 1-8 |
| 14 | Ring Explorer (graph, panels, replay) | FE | BE | 4-10 |
| 15 | Explanation engine and reason-code dictionary | BE (templates, engine) + ML-B (dictionary, SHAP mapping) | FE | 1-9 |
| 16 | Analyst UX: explanation panel, case actions, metrics tab | FE | BE | 4-8 |
| 17 | Pitch, demo script, QA, docs | BE (lead, deck, docs) + ML-A (Q&A defense, eval numbers) + FE (live demo operator) | all | 7-15 |

**Load per person:**
- **BE (Backend Lead - Myself):** 1, 2, 5, 11, 12b, 15 (engine), 17 (lead & deck).
- **FE (Frontend Lead):** 13, 14, 16, 12d, 17 (live stage demo).
- **GR (Graph Lead):** 6, 7, 12a.
- **ML-A (Data & Evaluation Lead):** 3, 4 (core & releases), 10, 12c, 17 (Q&A defense & benchmark figures).
- **ML-B (Features & Model Lead):** 4 (two templates + review), 8, 9, 15 (reason-code dictionary & SHAP).

## 2. Redistribution of the 6th Person's Work

The 6th person has been completely removed from development. Their former scope is reassigned directly across the 5 core engineers:
1. **Module 2 Fixtures:** BE writes the JSON mock fixtures alongside the OpenAPI contract and mock server on Day 2.
2. **Module 15 (Explanation Engine & Dictionary):** BE owns the deterministic Python explanation engine and template generator (`explain_ring`); ML-B provides the canonical reason-code dictionary and SHAP feature mapping from Module 9.
3. **Module 16 (Analyst UX: Actions & Metrics UI):** FE owns 100% of the frontend views (unifying Shell, Alert Queue, Ring Explorer, Explanation Panel, Case Action Buttons, Audit Trail, and Metrics Tab).
4. **Module 17 (Pitch, Demo Script, QA, Docs):** BE owns the slide deck, narrative, and repository docs; ML-A owns the statistical Q&A defense document and evaluation slides; FE operates the live stage demo.

## 3. The parallel rule

Nobody waits for real output. Everyone builds against a frozen contract plus a stand-in. The real piece replaces the stand-in at an integration checkpoint.

| Consumer | Stand-in | Real thing arrives |
|---|---|---|
| FE (all UI views) | Mock server and fixtures (Module 2 by BE) | Day 8-9 (Module 11) |
| GR, ML-B | Toy (Day 1) then sample500 (Day 2-3) | Full data Day 6 |
| BE (runner) | Stub functions with agreed signatures | Day 7-9 |
| ML-A (evaluation) | Ground truth plus a trivial baseline | Day 9 |
| BE (explanations) | Fixture ring objects, one per ring type | Day 7-9 |

## 4. Five unlock artifacts (the only things that must be early)

1. **Day 1 evening:** schema v2 (`new_schema.sql`) and file format frozen. Owners: BE with ML-A.
2. **Day 1 evening:** toy sample. Owner: ML-A (Module 3). Unblocks 5, 6, 8.
3. **Day 2:** OpenAPI plus mock server plus fixtures (Module 2). Owner: BE. Unblocks FE (Modules 13, 14, 16).
4. **Day 2-3:** sample500 with all five ring types (Modules 3 and 4). Unblocks realistic work in 6, 8, 9.
5. **Day 1:** function signatures below. Unblocks BE stubs (Module 11).

## 5. Function signatures (frozen Day 1; described in words, owners keep them in `docs/`)

| Function | Owner | Takes | Returns |
|---|---|---|---|
| build_graph | GR | accounts table, transactions table, optional time window | directed multigraph, sinks marked |
| run_detectors | GR | graph, config | list of hits: account, code, window start/end, severity, evidence facts, display text |
| rule_scores | GR | hits | per-account rule score 0-1 |
| cluster_rings | GR | graph, account scores, hits, config | list of candidate rings with members, roles, edges, amounts, times, score, priority, fingerprint |
| compute_features | ML-B | accounts, transactions, graph, window | table: one row per account |
| train_model | ML-B | features, train labels | model object |
| score_accounts | ML-B | model, features | account, ml_prob, SHAP values, reason codes |
| neighbour_risk | ML-B | graph, first-pass scores | per-account neighbour risk |
| fuse_scores | ML-B | ml_prob, rule_score, neighbour_risk, weights | risk 0-100 |
| explain_ring | BE (with ML-B dictionary) | ring, account scores, hits | summary text, structured facts, pattern tags, recommended action |
| run_pipeline | BE | dataset, config | writes one full run into the database, returns run id |

Any signature change: message the group, update the contract file, tag owners.

## 6. Dependency map: what truly blocks what

Only these are real blockers. Everything else starts on Day 1.

| Module | Cannot be **finished** until | Meanwhile |
|---|---|---|
| 5 Loaders | `new_schema.sql` applied (Module 1) and toy exists (3) | Write against the CSV contract in `datasetguide.md` |
| 7 Ring clustering | Module 6 hit format (Day 3) | Use hand-made graphs and rule-only risk |
| 9 Model on full data | Module 4 `train_v1` (Day 6) | Train on sample500 v1; pipeline code is identical |
| 10 Final metrics | Modules 7 and 9 outputs, Module 4 test sets (Day 8) | Build and test the harness on baseline output |
| 11 Runner (real) | 6, 7, 9, 15 outputs | Stubs, swap one by one |
| 12b/12d Simulation | 11 for real, contract only for building | Mock endpoints |
| 14 Ring Explorer (real data) | 11 | Fixtures |
| 16 Metrics tab (real numbers) | 10 | Placeholder JSON in the agreed shape |
| 17 Final slides | Final numbers (10) | Template slides with placeholders from Day 7 |

## 7. Integration checkpoints

- **Day 2:** Contract check (Mock API serves all endpoints; toy committed).
- **Day 5:** Integration 1 (Sample data loads clean; graph and features execute; UI displays mock fixtures).
- **Day 9:** Integration 2 (One command loads active dataset, runs full pipeline, writes database, and displays real rings in dashboard).
- **Day 11:** Integration 3 (Live streaming demo functions end-to-end; explanations and audit actions verified).
- **Day 13:** Feature freeze and acceptance gate (No new features; final metrics locked).
- **Day 14:** Dress rehearsal (Full 3-minute demo, timed, tested both online and offline).

## 8. Folder to repository mapping

`modules/` is documentation only. Code lives in the repository layout:
- `data_gen/` (ML-A, ML-B)
- `detection/` (GR)
- `ml/` (ML-B)
- `backend/` (BE)
- `frontend/` (FE)
- `explain/` (BE, ML-B)
- `docs/` (All)
