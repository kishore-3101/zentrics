# Module 5: Loaders and Validation (CSV to Postgres)

**Owner:** BE. **Backup:** ML-A. **Days:** 3-4.

## Goal
Load any dataset folder into the database in one command, safely, and check it first.

## Deliverables
1. Loader: reads a dataset folder, validates, resets the active dataset, bulk-loads with Postgres `COPY` (never the REST API), registers or updates the `datasets` row and marks it active.
2. Validation step run before any write: the same checks as `datasetguide.md` Section 10 that the database cannot enforce (ID references, sorted time, allowed values, ground-truth completeness). Fails with a readable report.
3. Separate loader for ground-truth files, so detector code paths never import it.
4. Load report: row counts per table, elapsed time.

## Rules
- Load order: `gt_rings`, `accounts`, `gt_accounts`, `transactions`, `gt_transactions`.
- Replacing a dataset uses `fn_reset_active_dataset()`. Analyst state (cases, fingerprints, audit log) is never touched.
- Loading is all-or-nothing (one transaction).
- Only the active dataset is in the raw tables. Other datasets stay as files; their metrics are pushed after offline evaluation.
- Injected transactions (`is_injected`) are removable by `injection_id`.

## Tasks
- Day 3: loader on `toy` and `sample500` v0; validation report.
- Day 4: ground-truth loader; reload test (load A, load B, check A is gone and cases remain).
- Time the full-size load (target: under a minute for 250k transactions).

## Can start when
Day 3, needs `new_schema.sql` applied (Module 1) and `toy` (Module 3). Workaround: develop against a local Postgres from Docker.

## Blocks others
Module 11 (runner reads from the database). Workaround: runner can read CSVs directly in early days.

## Done when
`toy`, `sample500` v1 and `train_v1` load clean; a deliberately broken file is rejected with a clear message.

