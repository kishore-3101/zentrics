# Module 1: Foundation (Supabase, migrations, Docker, offline bundle)

**Owner:** BE. **Backup:** ML-A. **Days:** 1-2, then 12.

## Goal
A shared hosted Postgres everyone can rely on, the schema applied, secrets handled safely, and an offline copy for the demo.

## Inputs
`new_schema.sql`, `schem_changes.md`.

## Deliverables
1. Supabase project with `new_schema.sql` applied.
2. `.env.example` (placeholders only) committed; real `.env` never committed.
3. Migration files 001-006 split from `new_schema.sql` along its section markers.
4. Docker Compose with a local Postgres loading the same migrations (Day 12 full stack).
5. Offline bundle: database dump plus datasets plus built frontend, runs with Wi-Fi off.
6. Nightly `pg_dump` habit (script is a three-line task, store dumps outside git).

## Tasks: create the Supabase project (Day 1)
1. Create an account and a new project. Choose the region nearest the team and venue (Mumbai if offered).
2. Set a strong database password; store it in a shared password manager, not chat.
3. Wait until the project is healthy.
4. Open **Connect** in the dashboard and copy two strings: **Session pooler** (works over IPv4, port 5432, user looks like `postgres.<project-ref>`) and **Direct connection** (IPv6 only unless you pay for the IPv4 add-on). If your network has no IPv6, use the session pooler for everything. Do not use the transaction pooler (port 6543) for migrations.
5. Open Project settings, API keys. Copy the project URL and the two keys (new dashboards call them publishable and secret; older ones call them anon and service_role).
6. Open the SQL editor, paste `new_schema.sql`, run. Run it once. Fix errors in a new migration, not by editing an applied one.
7. Verify: table list matches the schema; every table shows RLS enabled; `simulation_state` has one row; a test insert into `case_actions` followed by an update fails (append-only trigger).
8. Security check: call the project REST endpoint for `accounts` with the public key. Expect an empty result or a permission error. If you see rows, stop and fix RLS.
9. Check the dashboard for the project database size and the free-tier limits; note the pause-on-inactivity rule.

## Environment variables (BE owns; share via password manager)
`DATABASE_URL` (session pooler string), `DIRECT_DATABASE_URL` (direct, or the pooler string again), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (secret key, backend only), `SUPABASE_ANON_KEY` (publishable key, optional), `API_TOKEN`, `CORS_ORIGINS`, `APP_ENV`, `ACTIVE_DATASET`, `PIPELINE_CONFIG_PATH`, `LLM_API_KEY` and `LLM_MODEL` (optional), `LOG_LEVEL`. Frontend: `VITE_API_BASE_URL`, `VITE_API_TOKEN`. ML, graph and data people need only `DATASET_DIR`.

## Can start when
Immediately. No blockers.

## Blocks others
Module 5 (loaders need tables) and Module 11 need this. Workaround for others: develop against files and the mock server until Day 2 evening.

## Done when
All six people can connect (BE only, others do not need to); schema verified; RLS check passed; `.env.example` committed; Docker Compose brings up the same schema locally (Day 12).

## Watch out
Free projects can pause after inactivity: open the dashboard every few days and on demo morning. Never put the secret key or database URL in the frontend or git.

