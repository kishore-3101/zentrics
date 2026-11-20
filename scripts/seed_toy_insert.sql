-- =============================================================================
-- TraceMesh Atomic Dataset Load Script: toy
-- Generated at: 2026-11-20T15:37:19Z
-- Format: INSERT (Universal SQL / Supabase Editor)
-- =============================================================================
-- Auto-commit disabled for transactional atomicity
BEGIN;

-- Step 0: Safely reset active dataset without touching cases or audit trail
SELECT fn_reset_active_dataset();

-- Step 1: Load Ground Truth Rings
INSERT INTO gt_rings (gt_ring_id, ring_type, difficulty, n_accounts, n_victims, first_inflow_ts, last_outflow_ts, amount_total, params_json) VALUES
  ('GT_RING_01', 'circular_flow', 'easy', 5, 1, '2026-03-02T10:00:00Z', '2026-03-02T10:50:00Z', 150000.00, '{"hops": 3, "laps": 1, "decay_pct": 2.0}'::jsonb);

-- Step 2: Load Core Bank Accounts
INSERT INTO accounts (account_id, open_date, kyc_level, account_type, city_cluster, declared_income_band, bank_id) VALUES
  ('ATM_SINK_MUMBAI', '2020-01-01', 'full', 'sink', 'c1', 'high', 'CASH_OUT'),
  ('ACC_VIC_01', '2021-05-10', 'full', 'savings', 'c1', 'mid', 'TRACE_BANK'),
  ('ACC_COLL_01', '2026-02-15', 'minimal', 'savings', 'c1', 'low', 'TRACE_BANK'),
  ('ACC_MULE_01', '2026-02-20', 'minimal', 'wallet', 'c1', 'low', 'TRACE_BANK'),
  ('ACC_MULE_02', '2026-02-22', 'minimal', 'savings', 'c1', 'lower_mid', 'TRACE_BANK'),
  ('ACC_MULE_03', '2026-02-25', 'minimal', 'wallet', 'c1', 'low', 'TRACE_BANK'),
  ('ACC_NORM_01', '2022-03-15', 'full', 'savings', 'c2', 'mid', 'TRACE_BANK'),
  ('ACC_NORM_02', '2023-08-20', 'full', 'current', 'c2', 'upper_mid', 'TRACE_BANK'),
  ('ACC_NORM_03', '2024-01-11', 'full', 'savings', 'c1', 'mid', 'TRACE_BANK'),
  ('ACC_NORM_04', '2025-06-05', 'full', 'wallet', 'c1', 'lower_mid', 'TRACE_BANK');

-- Step 3: Load Account Ground-Truth Annotations
INSERT INTO gt_accounts (account_id, true_is_mule, train_label, gt_ring_id, role, scenario) VALUES
  ('ATM_SINK_MUMBAI', false, false, NULL, 'normal', 'normal'),
  ('ACC_VIC_01', false, false, 'GT_RING_01', 'victim', 'circular_flow'),
  ('ACC_COLL_01', true, true, 'GT_RING_01', 'collector', 'circular_flow'),
  ('ACC_MULE_01', true, true, 'GT_RING_01', 'mule', 'circular_flow'),
  ('ACC_MULE_02', true, true, 'GT_RING_01', 'mule', 'circular_flow'),
  ('ACC_MULE_03', true, true, 'GT_RING_01', 'cash_out', 'circular_flow'),
  ('ACC_NORM_01', false, false, NULL, 'normal', 'normal'),
  ('ACC_NORM_02', false, false, NULL, 'normal', 'normal'),
  ('ACC_NORM_03', false, false, NULL, 'normal', 'normal'),
  ('ACC_NORM_04', false, false, NULL, 'normal', 'normal');

-- Step 4: Load Raw Transactions Stream
INSERT INTO transactions (txn_id, ts, src_account, dst_account, amount, channel, is_injected, injection_id) VALUES
  ('TXN_TOY_001', '2026-03-01T09:15:00Z', 'ACC_NORM_01', 'ACC_NORM_02', 1200.00, 'UPI', false, NULL),
  ('TXN_TOY_002', '2026-03-01T10:30:00Z', 'ACC_NORM_02', 'ACC_NORM_03', 450.00, 'UPI', false, NULL),
  ('TXN_TOY_003', '2026-03-01T11:00:00Z', 'ACC_NORM_03', 'ACC_NORM_04', 3000.00, 'IMPS', false, NULL),
  ('TXN_TOY_004', '2026-03-01T14:20:00Z', 'ACC_NORM_04', 'ACC_NORM_01', 800.00, 'UPI', false, NULL),
  ('TXN_TOY_005', '2026-03-01T16:45:00Z', 'ACC_NORM_02', 'ATM_SINK_MUMBAI', 5000.00, 'ATM_WITHDRAWAL', false, NULL),
  ('TXN_TOY_006', '2026-03-01T18:10:00Z', 'ACC_NORM_01', 'ACC_NORM_03', 150.00, 'UPI', false, NULL),
  ('TXN_TOY_007', '2026-03-01T19:30:00Z', 'ACC_NORM_03', 'ACC_NORM_02', 2200.00, 'UPI', false, NULL),
  ('TXN_TOY_008', '2026-03-01T20:15:00Z', 'ACC_NORM_04', 'ATM_SINK_MUMBAI', 2000.00, 'ATM_WITHDRAWAL', false, NULL),
  ('TXN_TOY_009', '2026-03-02T08:30:00Z', 'ACC_NORM_01', 'ACC_NORM_04', 650.00, 'UPI', false, NULL),
  ('TXN_TOY_010', '2026-03-02T09:45:00Z', 'ACC_NORM_02', 'ACC_NORM_01', 1800.00, 'IMPS', false, NULL),
  ('TXN_TOY_011', '2026-03-02T10:00:00Z', 'ACC_VIC_01', 'ACC_COLL_01', 150000.00, 'NEFT', false, NULL),
  ('TXN_TOY_012', '2026-03-02T10:08:00Z', 'ACC_COLL_01', 'ACC_MULE_01', 146000.00, 'IMPS', false, NULL),
  ('TXN_TOY_013', '2026-03-02T10:15:00Z', 'ACC_NORM_03', 'ACC_NORM_04', 500.00, 'UPI', false, NULL),
  ('TXN_TOY_014', '2026-03-02T10:18:00Z', 'ACC_MULE_01', 'ACC_MULE_02', 142000.00, 'IMPS', false, NULL),
  ('TXN_TOY_015', '2026-03-02T10:25:00Z', 'ACC_NORM_04', 'ACC_NORM_02', 120.00, 'UPI', false, NULL),
  ('TXN_TOY_016', '2026-03-02T10:28:00Z', 'ACC_MULE_02', 'ACC_MULE_03', 138000.00, 'UPI', false, NULL),
  ('TXN_TOY_017', '2026-03-02T10:35:00Z', 'ACC_NORM_01', 'ACC_NORM_02', 950.00, 'UPI', false, NULL),
  ('TXN_TOY_018', '2026-03-02T10:40:00Z', 'ACC_MULE_03', 'ACC_COLL_01', 98000.00, 'UPI', false, NULL),
  ('TXN_TOY_019', '2026-03-02T10:48:00Z', 'ACC_MULE_03', 'ATM_SINK_MUMBAI', 38000.00, 'ATM_WITHDRAWAL', false, NULL),
  ('TXN_TOY_020', '2026-03-02T10:50:00Z', 'ACC_COLL_01', 'ATM_SINK_MUMBAI', 95000.00, 'ATM_WITHDRAWAL', false, NULL),
  ('TXN_TOY_021', '2026-03-02T12:00:00Z', 'ACC_NORM_02', 'ACC_NORM_03', 3200.00, 'UPI', false, NULL),
  ('TXN_TOY_022', '2026-03-02T14:15:00Z', 'ACC_NORM_04', 'ACC_NORM_01', 1100.00, 'UPI', false, NULL),
  ('TXN_TOY_023', '2026-03-02T16:30:00Z', 'ACC_NORM_03', 'ATM_SINK_MUMBAI', 4000.00, 'ATM_WITHDRAWAL', false, NULL),
  ('TXN_TOY_024', '2026-03-02T18:45:00Z', 'ACC_NORM_01', 'ACC_NORM_02', 750.00, 'UPI', false, NULL),
  ('TXN_TOY_025', '2026-03-03T09:00:00Z', 'ACC_NORM_02', 'ACC_NORM_04', 1600.00, 'IMPS', false, NULL),
  ('TXN_TOY_026', '2026-03-03T11:20:00Z', 'ACC_NORM_03', 'ACC_NORM_01', 890.00, 'UPI', false, NULL),
  ('TXN_TOY_027', '2026-03-03T13:40:00Z', 'ACC_NORM_04', 'ACC_NORM_03', 420.00, 'UPI', false, NULL),
  ('TXN_TOY_028', '2026-03-03T15:10:00Z', 'ACC_NORM_01', 'ATM_SINK_MUMBAI', 3000.00, 'ATM_WITHDRAWAL', false, NULL),
  ('TXN_TOY_029', '2026-03-03T16:30:00Z', 'ACC_NORM_02', 'ACC_NORM_01', 2100.00, 'UPI', false, NULL),
  ('TXN_TOY_030', '2026-03-03T18:00:00Z', 'ACC_NORM_03', 'ACC_NORM_04', 1350.00, 'UPI', false, NULL);

-- Step 5: Load Transaction Ground-Truth Annotations
INSERT INTO gt_transactions (txn_id, is_fraud_related, gt_ring_id) VALUES
  ('TXN_TOY_001', false, NULL),
  ('TXN_TOY_002', false, NULL),
  ('TXN_TOY_003', false, NULL),
  ('TXN_TOY_004', false, NULL),
  ('TXN_TOY_005', false, NULL),
  ('TXN_TOY_006', false, NULL),
  ('TXN_TOY_007', false, NULL),
  ('TXN_TOY_008', false, NULL),
  ('TXN_TOY_009', false, NULL),
  ('TXN_TOY_010', false, NULL),
  ('TXN_TOY_011', true, 'GT_RING_01'),
  ('TXN_TOY_012', true, 'GT_RING_01'),
  ('TXN_TOY_013', false, NULL),
  ('TXN_TOY_014', true, 'GT_RING_01'),
  ('TXN_TOY_015', false, NULL),
  ('TXN_TOY_016', true, 'GT_RING_01'),
  ('TXN_TOY_017', false, NULL),
  ('TXN_TOY_018', true, 'GT_RING_01'),
  ('TXN_TOY_019', true, 'GT_RING_01'),
  ('TXN_TOY_020', true, 'GT_RING_01'),
  ('TXN_TOY_021', false, NULL),
  ('TXN_TOY_022', false, NULL),
  ('TXN_TOY_023', false, NULL),
  ('TXN_TOY_024', false, NULL),
  ('TXN_TOY_025', false, NULL),
  ('TXN_TOY_026', false, NULL),
  ('TXN_TOY_027', false, NULL),
  ('TXN_TOY_028', false, NULL),
  ('TXN_TOY_029', false, NULL),
  ('TXN_TOY_030', false, NULL);

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
