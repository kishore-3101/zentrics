# Module 11: Pipeline Runner and Real API

**Owner:** BE. **Backup:** ML-A (runner), FE (API). **Days:** 4-11. See `plan.md` Section 10 and `plan_v2.md` Section 3.

## Goal
Unify detection, feature computation, ML inference, neighbor risk, score fusion, ring clustering, case linking, and explanation generation into an automated end-to-end pipeline runner (`run_pipeline`) and expose the production FastAPI service connected to Supabase.

## Inputs
`new_schema.sql`, function signatures table from `README.md`, functions from GR (Modules 6, 7), ML-B (Modules 8, 9), BE/ML-B (Module 15), and loaders from BE (Module 5).

## Deliverables
1. **Pipeline Runner (`run_pipeline`)**: Single Python CLI entry point that reads the active dataset from Postgres, executes the full processing graph in topological order, and commits the full run in a single transaction into `pipeline_runs`, `account_scores`, `detector_hits`, `rings`, `ring_members`, `ring_transactions`, and `metrics`.
2. **Case Linking Engine (Jaccard Overlap)**:
   - When a candidate ring is clustered, computes Jaccard similarity of its member account set against all existing active cases in `cases` via `case_fingerprints`.
   - If Jaccard similarity >= 0.6: links the new ring to the existing case, appends the new fingerprint to `case_fingerprints`, and updates `cases.last_seen_run_id`.
   - If Jaccard similarity < 0.6: creates a new case in `cases` with `status = 'new'`, records its fingerprint, and sets `first_seen_run_id`.
3. **Production FastAPI Service** implementing all 11 endpoints from OpenAPI contract (Module 2):
   - `GET /alerts`: queries `v_alerts` with filtering (`ring_type`, `status`, `min_score`, `min_priority`), sorting, pagination, and `since_event_id` delta polling.
   - `GET /rings/{ring_id}`: returns ring facts, score, priority, amount moved/cashed/at-risk, members with roles and risk scores, edge list from `ring_transactions`, explanation JSON, pattern tags.
   - `GET /rings/{ring_id}/timeline`: returns time-ordered transactions associated with the ring for playback.
   - `GET /accounts/{account_id}`: account metadata, fused score breakdown, reason codes, SHAP JSON, rule hits, ring memberships.
   - `POST /rings/{ring_id}/action`: executes freeze, escalate, false_positive, or note; transitions case status; appends an immutable entry to `case_actions`.
   - `GET /cases/{case_id}/actions`: audit history of analyst interventions.
   - `GET /metrics`: serves headline KPI metrics, four-method comparison, recall by ring type/difficulty, and curve artifacts from `metric_artifacts`.
   - `GET /overview`: summary cards (total at risk, rings flagged, money saved, alert reduction), risk distribution, top 5 rings.
   - `GET /health`: health check and DB connectivity status.
   - Simulation endpoints: passthrough to Module 12 state table.
4. **Middleware & Configuration**: Database connection pooler setup, API token authorization header, CORS origins, structured error responses, request logging.

## Execution Order inside `run_pipeline`
1. Fetch active dataset ID and load `accounts` and `transactions` into memory.
2. Initialize `pipeline_runs` row with `status = 'running'`.
3. Call `build_graph(accounts, transactions)`.
4. Call `run_detectors(graph, config)` -> produces hits list -> bulk insert into `detector_hits`.
5. Call `compute_features(accounts, transactions, graph)` -> feature table.
6. Call `score_accounts(model, features)` -> ML probabilities and SHAP reason codes.
7. Call `rule_scores(hits)` -> rule scores per account.
8. Call `neighbour_risk(graph, first_pass_scores)` -> neighbour risks.
9. Call `fuse_scores(ml_prob, rule_score, neighbour_risk, weights)` -> final 0-100 risk -> bulk insert into `account_scores`.
10. Call `cluster_rings(graph, account_scores, hits, config)` -> candidate rings.
11. Run Case Linking Engine -> map fingerprints to `cases` and `case_fingerprints`.
12. Call `explain_ring(ring, account_scores, hits)` -> explanation text and structured facts.
13. Bulk insert into `rings`, `ring_members`, and `ring_transactions`.
14. Compute active run metrics and insert into `metrics`.
15. Update `pipeline_runs` with `status = 'done'`, `duration_s`, and `finished_at`.

## Schedule
- Day 4: Pipeline runner skeleton with stubs; DB connection pooler configuration.
- Day 5: **Integration 1** — test skeleton runner on `sample500` v0/v1 with mock functions.
- Day 6: Implement core query endpoints: `/alerts`, `/rings/{id}`, `/accounts/{id}`.
- Day 7: Implement `/timeline`, `/metrics`, `/action`, and `case_actions` audit trail.
- Day 9: **Integration 2** — swap in real GR detectors/clustering and ML-B scoring/fusion functions; full end-to-end run.
- Day 10: CI verification, transaction rollback testing, error handlers, logging.
- Day 11: **Integration 3** — response caching, pagination, performance indexing.

## Can start when
Day 4. Database schema (Module 1) is ready.

## Hard dependency
Finishing real pipeline execution requires real implementations of Modules 6, 7, 9, and 15.

## Stand-in while blocked
Python stub functions with identical type signatures returning fixture data. BE swaps stubs for real imports as team members release them.

## Blocks others
Module 12b (simulation worker), Module 14 (real Ring Explorer), Module 16 (live case actions).

## Done when
`python -m backend.pipeline --dataset active` executes clean without errors, populates all tables for a new `run_id`, links cases with Jaccard logic, and all FastAPI endpoints return 200 with schema-validated JSON matching OpenAPI spec.

