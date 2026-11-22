-- =============================================================================
-- TraceMesh Atomic Dataset Load Script: toy
-- Generated at: 2026-11-20T15:37:19Z
-- Format: COPY (psql client streaming)
-- =============================================================================
\set ON_ERROR_STOP on
BEGIN;

-- Step 0: Safely reset active dataset without touching cases or audit trail
SELECT fn_reset_active_dataset();

-- Step 1: Load Ground Truth Rings
\copy gt_rings (gt_ring_id, ring_type, difficulty, n_accounts, n_victims, first_inflow_ts, last_outflow_ts, amount_total, params_json) FROM '/home/kishore/Projects/TraceMesh/data/toy/gt_rings.csv' WITH (FORMAT csv, HEADER true, NULL '');

-- Step 2: Load Core Bank Accounts
\copy accounts (account_id, open_date, kyc_level, account_type, city_cluster, declared_income_band, bank_id) FROM '/home/kishore/Projects/TraceMesh/data/toy/accounts.csv' WITH (FORMAT csv, HEADER true, NULL '');

-- Step 3: Load Account Ground-Truth Annotations
\copy gt_accounts (account_id, true_is_mule, train_label, gt_ring_id, role, scenario) FROM '/home/kishore/Projects/TraceMesh/data/toy/gt_accounts.csv' WITH (FORMAT csv, HEADER true, NULL '');

-- Step 4: Load Raw Transactions Stream
\copy transactions (txn_id, ts, src_account, dst_account, amount, channel, is_injected, injection_id) FROM '/home/kishore/Projects/TraceMesh/data/toy/transactions.csv' WITH (FORMAT csv, HEADER true, NULL '');

-- Step 5: Load Transaction Ground-Truth Annotations
\copy gt_transactions (txn_id, is_fraud_related, gt_ring_id) FROM '/home/kishore/Projects/TraceMesh/data/toy/gt_transactions.csv' WITH (FORMAT csv, HEADER true, NULL '');

-- Step 6: Register dataset metadata and mark as active
-- Register active dataset
INSERT INTO datasets (dataset_id, name, role, seed, config_json, n_accounts, n_txns, is_active)
VALUES (
    'toy',
    'TraceMesh Toy Dataset',
    'toy',
    42,
    '{"dataset_id": "toy", "name": "TraceMesh Toy Dataset", "role": "toy", "seed": 42, "n_accounts": 10, "n_txns": 30, "generator_version": "1.0.0", "created_at": "2026-03-01T00:00:00Z", "period_start": "2026-03-01T00:00:00Z", "period_end": "2026-03-05T23:59:59Z"}'::jsonb,
    10,
    30,
    true
)
ON CONFLICT (dataset_id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    seed = EXCLUDED.seed,
    config_json = EXCLUDED.config_json,
    n_accounts = EXCLUDED.n_accounts,
    n_txns = EXCLUDED.n_txns,
    is_active = true;

COMMIT;
