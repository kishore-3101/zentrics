# Schema Review and Required Changes
 
Reviewed file: `schema.sql` (your SQLite-flavoured schema, "PostgreSQL-compatible"). Target: **Supabase (PostgreSQL)**.
 
The structure of your schema is good: three groups (raw, detection output, analyst state), fingerprint-keyed cases, append-only audit log, run-tagged outputs. The changes below fix things that would **break on Postgres**, things that would **break the plan** (leakage, missing cash-out destination, missing replay data), and things the **frontend and explanation engine will need**.
 
Priority legend: **P0** = must do before pushing to Supabase. **P1** = do this week, the pipeline depends on it. **P2** = nice to have.
 
---
 
## A. Will not run on PostgreSQL (P0)
 
| # | Problem in current schema | Change |
|---|---|---|
| A1 | `PRAGMA foreign_keys = ON;` is SQLite only | Remove. Postgres enforces foreign keys always. |
| A2 | `INTEGER PRIMARY KEY AUTOINCREMENT` (pipeline_runs, detector_hits, cases, case_actions) | Use `BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`. |
| A3 | `CREATE VIEW IF NOT EXISTS` | Postgres does not support it. Use `CREATE OR REPLACE VIEW`. |
| A4 | Timestamps stored as `TEXT` | Use `TIMESTAMPTZ`, always UTC. Applies to `open_date` (use `DATE`), `ts`, `started_at`, `detected_at`, `created_at`, `updated_at`. Text timestamps will sort and compare wrongly across formats and make the 10-min / 1-hour window queries slow. |
| A5 | `REAL` for money | Use `NUMERIC(14,2)` for `amount`, `amount_moved`, `amount_cashed`, `amount_at_risk`. Use `DOUBLE PRECISION` for scores and probabilities. |
| A6 | `INTEGER` used as boolean (`is_mule`, `is_fraud_related`) | Use `BOOLEAN`. |
| A7 | `features_json`, `config_json` as `TEXT` | Use `JSONB` (queryable, indexable). |
| A8 | Enumerations only in comments (`kyc_level`, `account_type`, `channel`, `role`, `ring_type`, `action`, `method`) | Add `CHECK (... IN (...))` constraints, or Postgres enums. Fixed value lists are given in section H. |
| A9 | Cash-out table creation order | Keep creation order: accounts, transactions, pipeline_runs, rings before ring_members, cases before case_actions. Already correct, just keep it in the migrations. |
 
---
 
## B. Ground-truth separation (P0)
 
**Problem.** `accounts.is_mule`, `accounts.gt_ring_id`, `accounts.scenario` and `transactions.is_fraud_related` sit next to the data the detector reads. A single careless `SELECT *` leaks labels into features, and your metrics become meaningless. The comment "never used by the detector" is not enforceable.
 
**Change.** Move all ground truth into separate tables that only the evaluation code reads.
 
| New table | Columns |
|---|---|
| `gt_accounts` | `account_id` (PK, FK), `true_is_mule` BOOLEAN, `train_label` BOOLEAN (noisy label used for training; see datasetguide.md), `gt_ring_id`, `role` (victim / collector / mule / cash_out / normal / hard_negative / suspicious_unlabeled), `scenario` |
| `gt_transactions` | `txn_id` (PK, FK), `is_fraud_related` BOOLEAN, `gt_ring_id` |
| `gt_rings` | `gt_ring_id` (PK), `ring_type`, `difficulty` (easy / medium / hard), `n_accounts`, `n_victims`, `first_inflow_ts`, `last_outflow_ts`, `amount_total`, `params_json` JSONB |
 
Then **remove** those columns from `accounts` and `transactions`.
 
Why `gt_rings` matters: ring recall, recall-by-type, recall-by-difficulty and time-to-detect (all on your metrics slide) cannot be computed without ring-level truth.
 
---
 
## C. Missing: where does cash-out go? (P0)
 
`transactions.dst_account` is `NOT NULL` with a foreign key to `accounts`, but an ATM withdrawal or a transfer to another bank has no destination account in your data. The generator would have to invent hacks.
 
**Change.** Add **sink accounts** as normal rows in `accounts` with `account_type = 'sink'` (for example one ATM sink per city cluster, plus a few "external bank" sinks). Cash-out = a transaction whose destination is a sink. Features and metrics exclude sink accounts from scoring but use them to compute `amount_cashed`.
 
Add `'sink'` to the allowed `account_type` values and add `CHECK (src_account <> dst_account)` on transactions.
 
---
 
## D. Datasets (P0)
 
**Problem.** The plan needs train, validation, test, hard-test, demo and stress datasets. The schema has nowhere to say which dataset a run used.
 
**Change.**
 
- New table `datasets`: `dataset_id` (PK), `name`, `role` (toy / sample / train / val / test / test_hard / demo / stress), `seed`, `config_json`, `n_accounts`, `n_txns`, `created_at`, `is_active`.
- `pipeline_runs` gets `dataset_id` (FK).
- **Rule: the raw tables (`accounts`, `transactions`, `gt_*`) hold only the one active dataset.** Loading a new dataset replaces raw tables (never analyst state). All other datasets live as files and are evaluated offline; only their metrics are pushed to the database. This keeps you well inside the Supabase free-tier size limit and avoids a `dataset_id` column on every row.
---
 
## E. Raw tables: smaller fixes
 
**accounts (P1)**
- Rename `income_band` to `declared_income_band` (the plan and the dataset guide use that name; pick one everywhere).
- Add `bank_id TEXT DEFAULT 'BANK_A'` (costs nothing, makes the multi-bank stretch goal possible).
- Add the CHECK constraints from section H.
**transactions (P1)**
- Add `is_injected BOOLEAN DEFAULT FALSE` and `injection_id TEXT NULL`: transactions created by the live "Inject ring" demo button. Lets you remove injected rings after the demo and keeps them out of evaluation.
- Add index `(channel)` only if you filter by it; the existing three indexes are right.
**Naming mismatch to resolve (P0, free):** plan.md says `ring_id` in accounts, schema says `gt_ring_id`. After change B this lives only in `gt_accounts.gt_ring_id`. Update plan.md and `docs/data_schema.md`.
 
---
 
## F. Detection output tables
 
**account_scores (P1)** add:
- `shap_json JSONB` and `reason_codes JSONB` (top reasons with direction and weight; the explanation engine and the node panel read this)
- `community_id INTEGER`
- `CHECK (risk BETWEEN 0 AND 100)`
**detector_hits (P1)** add:
- `window_start TIMESTAMPTZ`, `window_end TIMESTAMPTZ`
- `severity DOUBLE PRECISION`
- `evidence_json JSONB` (structured facts such as number of unique senders, percent forwarded, delay). The explanation engine must build sentences from structured facts, not by parsing the human-readable `detail` string. Keep `detail` for display.
**rings (P1)** add:
- `first_inflow_ts`, `last_outflow_ts` TIMESTAMPTZ (the plan's "speed" and time-to-detect need them)
- `priority DOUBLE PRECISION` (= score × amount_at_risk; store it, so the alert queue sorts with an index instead of computing)
- `pattern_tags JSONB` (list such as fan_in, rapid_pass_through)
- `explanation_json JSONB` (structured facts the summary was built from) and `explanation_i18n JSONB` (stretch: Hindi/Telugu text)
- `recommended_action TEXT` with CHECK (`freeze_and_escalate`, `watchlist_review`, `monitor`). The existing `recommended` column becomes this.
- `ring_type` CHECK: `fan_in_fan_out`, `layering_chain`, `circular_flow`, `pass_through_hub`, `dormant_active`, `mixed`.
- Index on `(run_id, priority DESC)`.
**ring_members (P1)** add:
- `account_risk DOUBLE PRECISION` (snapshot at that run)
- `amount_in NUMERIC`, `amount_out NUMERIC`
- `role` CHECK stays: victim, collector, mule, cash_out.
- Index on `(account_id)` so "which ring is this account in" is fast.
**New table `ring_transactions` (P0 for the frontend)**: `run_id`, `ring_id`, `txn_id`, PK on all three. This is the exact edge set for the ring graph and the timeline replay. Without it the API has to recompute edges from member lists on every click, which is slow and gives inconsistent results.
 
**metrics (P1)**: the PK `(run_id, method, name)` cannot hold recall-by-ring-type or recall-by-difficulty. Change to `(run_id, method, segment, name)` where `segment` is `overall`, a ring type, a difficulty level, or a hard-negative class. Add `dataset_id`.
 
**pipeline_runs (P1)** add: `dataset_id`, `kind` (batch / stream), `status` (running / done / failed), `finished_at`, `git_sha`, `window_minutes`.
 
---
 
## G. Analyst state
 
**cases (P0, a real bug in the design)**: fingerprint = hash of the exact member set. If a re-run finds the same ring plus one extra account (very likely as thresholds are tuned), the hash changes and the analyst's status and notes are lost, which defeats the stated purpose of this table.
 
Change:
- Add table `case_fingerprints(case_id, fingerprint, run_id, PRIMARY KEY(case_id, fingerprint))`.
- Pipeline runner rule: a new ring links to an existing case if its member set overlaps an existing case's latest member set with Jaccard similarity of at least 0.6; otherwise create a new case. Record the new fingerprint against that case.
- `cases` add `first_seen_run_id`, `last_seen_run_id`.
- Keep `fingerprint` on `rings` as it is.
**case_actions (P1)** add `from_status`, `to_status`, and a CHECK on `action` (freeze, escalate, false_positive, note, status_change).
 
**v_feedback_labels (P0, a real bug)**: the view labels **every** member of a frozen or escalated ring as a mule (label 1), including the **victims**. Training on that would teach the model that victims are mules. Add `AND m.role <> 'victim'`. Also use `CREATE OR REPLACE VIEW`.
 
**New view `v_alerts` (P1)**: one row per ring in the latest run, joined to `cases` (status, assignee) via fingerprint links. The `/alerts` endpoint becomes a single indexed query.
 
---
 
## H. Allowed value lists (use in CHECK constraints and in datasetguide.md)
 
- `kyc_level`: `minimal`, `full`
- `account_type`: `savings`, `current`, `wallet`, `sink`
- `channel`: `UPI`, `IMPS`, `NEFT`, `ATM_WITHDRAWAL` (underscore, no hyphen, so it is safe in files and enums)
- `declared_income_band`: `low`, `lower_mid`, `mid`, `upper_mid`, `high`
- `role` (ring_members): `victim`, `collector`, `mule`, `cash_out`
- `status` (cases): unchanged
- `ring_type`: see section F
---
 
## I. Live demo support (P1)
 
- New single-row table `simulation_state`: `status` (stopped / running / paused), `speed`, `cursor_ts`, `window_minutes`, `started_at`.
- New table `alert_events(event_id identity, run_id, ring_id, event_type [new / updated], created_at)`. The streaming worker inserts a row whenever a ring appears or changes. The frontend polls `GET /alerts?since_event_id=...` every two seconds. This is more reliable on stage than WebSockets. (Supabase Realtime on this table is an optional upgrade.)
---
 
## J. Security on Supabase (P0)
 
Supabase exposes every table in the `public` schema through its REST API using the public key. Therefore:
- Turn **Row Level Security ON for every table** and add **no policies**. The backend connects with the direct Postgres connection string, which is not affected by RLS, so nothing breaks, and the public key can read nothing.
- The frontend talks **only to your FastAPI**, never directly to Supabase tables.
- If you later add Supabase Realtime for `alert_events`, add one read-only policy for that table only.
- Never put the service-role / secret key or the database URL in the frontend or in git.
---
 
## K. Indexes to add (P1)
 
- `transactions(dst_account, ts)` and `(src_account, ts)`: already present, keep.
- `rings(run_id, priority DESC)`
- `ring_members(account_id)`
- `ring_transactions(run_id, ring_id)` (covered by PK) and `(txn_id)`
- `detector_hits(run_id, code)`
- `account_scores(run_id, risk DESC)`
- `case_actions(case_id, ts)`
---
 
## L. Suggested migration files (the backend developer creates these)
 
1. `001_core_raw.sql`: accounts, transactions, datasets
2. `002_ground_truth.sql`: gt_accounts, gt_transactions, gt_rings
3. `003_detection_output.sql`: pipeline_runs, account_scores, detector_hits, rings, ring_members, ring_transactions, metrics
4. `004_analyst_state.sql`: cases, case_fingerprints, case_actions
5. `005_views_indexes_rls.sql`: views, extra indexes, RLS on every table
6. `006_simulation.sql`: simulation_state, alert_events
Apply in order. Never edit an applied migration; add a new numbered one.
 
---
 
## M. What stays exactly as it is
 
Run-tagged detection outputs with "rebuilt every run" semantics, analyst state never wiped by a re-run, append-only `case_actions`, the three raw indexes on transactions, the `rings` primary key `(run_id, ring_id)`, and the `ring_members` foreign key to `rings`.
 
