-- =============================================================================
-- TraceMesh: Mule Ring Detection Database Schema (v2 - PostgreSQL / Supabase)
-- =============================================================================
-- Architected for: Supabase Hosted PostgreSQL (with local Docker fallback)
-- Sections:
--   1. Datasets & Raw Transaction Data
--   2. Isolated Ground Truth (Evaluation only; never seen by detectors/features)
--   3. Detection Pipeline Runs & Detection Outputs
--   4. Persistent Analyst State & Immutable Audit Log (Never wiped by re-runs)
--   5. Real-time Simulation & Live Demo Controls
--   6. Performance Indexes & Views
--   7. Helper Functions & Triggers
--   8. Row Level Security (RLS) Configuration
-- =============================================================================

-- =============================================================================
-- SECTION 1: DATASETS & RAW TRANSACTION DATA
-- =============================================================================

-- Registry of synthetic and evaluation datasets
CREATE TABLE IF NOT EXISTS datasets (
    dataset_id   TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    role         TEXT NOT NULL CHECK (role IN ('toy', 'sample', 'train', 'val', 'test', 'test_hard', 'demo', 'stress')),
    seed         INTEGER,
    config_json  JSONB,
    n_accounts   INTEGER,
    n_txns       INTEGER,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    is_active    BOOLEAN NOT NULL DEFAULT false
);

-- Core bank accounts (raw customer profiles and cash-out sinks)
CREATE TABLE IF NOT EXISTS accounts (
    account_id            TEXT PRIMARY KEY,
    open_date             DATE NOT NULL,
    kyc_level             TEXT CHECK (kyc_level IN ('minimal', 'full')),
    account_type          TEXT NOT NULL CHECK (account_type IN ('savings', 'current', 'wallet', 'sink')),
    city_cluster          TEXT,
    declared_income_band  TEXT CHECK (declared_income_band IN ('low', 'lower_mid', 'mid', 'upper_mid', 'high')),
    bank_id               TEXT DEFAULT 'TRACE_BANK'
);

-- All transaction events (raw stream; sorted chronologically by ts)
CREATE TABLE IF NOT EXISTS transactions (
    txn_id         TEXT PRIMARY KEY,
    ts             TIMESTAMPTZ NOT NULL,
    src_account    TEXT NOT NULL REFERENCES accounts(account_id),
    dst_account    TEXT NOT NULL REFERENCES accounts(account_id),
    amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    channel        TEXT NOT NULL CHECK (channel IN ('UPI', 'IMPS', 'NEFT', 'ATM_WITHDRAWAL')),
    is_injected    BOOLEAN NOT NULL DEFAULT false,
    injection_id   TEXT,
    CONSTRAINT chk_different_accounts CHECK (src_account <> dst_account)
);

-- =============================================================================
-- SECTION 2: ISOLATED GROUND TRUTH
-- (Strictly quarantined: only evaluation harnesses and validation scripts may read)
-- =============================================================================

-- Planted ground truth rings
CREATE TABLE IF NOT EXISTS gt_rings (
    gt_ring_id       TEXT PRIMARY KEY,
    ring_type        TEXT NOT NULL CHECK (ring_type IN ('fan_in_fan_out', 'layering_chain', 'circular_flow', 'pass_through_hub', 'dormant_active')),
    difficulty       TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    n_accounts       INTEGER NOT NULL,
    n_victims        INTEGER NOT NULL,
    first_inflow_ts  TIMESTAMPTZ NOT NULL,
    last_outflow_ts  TIMESTAMPTZ NOT NULL,
    amount_total     NUMERIC(14,2) NOT NULL,
    params_json      JSONB
);

-- Account-level ground truth and noisy training labels
CREATE TABLE IF NOT EXISTS gt_accounts (
    account_id    TEXT PRIMARY KEY REFERENCES accounts(account_id) ON DELETE CASCADE,
    true_is_mule  BOOLEAN NOT NULL DEFAULT false,
    train_label   BOOLEAN NOT NULL DEFAULT false, -- Contains 3% noise to mimic real bank alerts
    gt_ring_id    TEXT REFERENCES gt_rings(gt_ring_id) ON DELETE SET NULL,
    role          TEXT NOT NULL CHECK (role IN ('normal', 'hard_negative', 'suspicious_unlabeled', 'victim', 'collector', 'mule', 'cash_out')),
    scenario      TEXT
);

-- Transaction-level ground truth
CREATE TABLE IF NOT EXISTS gt_transactions (
    txn_id            TEXT PRIMARY KEY REFERENCES transactions(txn_id) ON DELETE CASCADE,
    is_fraud_related  BOOLEAN NOT NULL DEFAULT false,
    gt_ring_id        TEXT REFERENCES gt_rings(gt_ring_id) ON DELETE SET NULL
);

-- =============================================================================
-- SECTION 3: DETECTION PIPELINE RUNS & OUTPUTS
-- (Rebuilt or appended during pipeline execution; tagged by run_id)
-- =============================================================================

-- Execution audit record for every batch run or streaming window
CREATE TABLE IF NOT EXISTS pipeline_runs (
    run_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dataset_id      TEXT REFERENCES datasets(dataset_id),
    kind            TEXT NOT NULL DEFAULT 'batch' CHECK (kind IN ('batch', 'stream')),
    status          TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'failed')),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    finished_at     TIMESTAMPTZ,
    duration_s      DOUBLE PRECISION,
    config_json     JSONB, -- Frozen weights, detector thresholds, and hyperparams
    n_txns          INTEGER,
    git_sha         TEXT,
    window_minutes  INTEGER
);

-- Fused risk scores, ML probabilities, and SHAP reason codes per account per run
CREATE TABLE IF NOT EXISTS account_scores (
    run_id         BIGINT NOT NULL REFERENCES pipeline_runs(run_id) ON DELETE CASCADE,
    account_id     TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    risk           DOUBLE PRECISION NOT NULL, -- 0-100 fused risk score
    ml_prob        DOUBLE PRECISION,          -- First-pass XGBoost probability [0, 1]
    rule_score     DOUBLE PRECISION,          -- Normalized heuristic detector score [0, 1]
    neighbor_risk  DOUBLE PRECISION,          -- 1-hop counterparty network risk contagion [0, 1]
    community_id   INTEGER,
    features_json  JSONB,                     -- Graph and volume features
    shap_json      JSONB,                     -- Raw SHAP feature attribution values
    reason_codes   JSONB,                     -- Array of human-readable reason objects
    PRIMARY KEY (run_id, account_id)
);

-- Individual structural and behavioral detector hits
CREATE TABLE IF NOT EXISTS detector_hits (
    hit_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id        BIGINT NOT NULL REFERENCES pipeline_runs(run_id) ON DELETE CASCADE,
    account_id    TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    code          TEXT NOT NULL CHECK (code IN ('fan_in_burst', 'fan_out_split', 'rapid_pass_through', 'layering_chain', 'circular_flow', 'dormant_active')),
    window_start  TIMESTAMPTZ,
    window_end    TIMESTAMPTZ,
    severity      TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    evidence_json JSONB,
    detail        TEXT NOT NULL
);

-- Detected mule ring candidate clusters
CREATE TABLE IF NOT EXISTS rings (
    ring_id           TEXT NOT NULL,
    run_id            BIGINT NOT NULL REFERENCES pipeline_runs(run_id) ON DELETE CASCADE,
    fingerprint       TEXT NOT NULL, -- SHA1 of sorted member account IDs
    ring_type         TEXT NOT NULL CHECK (ring_type IN ('fan_in_fan_out', 'layering_chain', 'circular_flow', 'pass_through_hub', 'dormant_active', 'mixed')),
    score             DOUBLE PRECISION NOT NULL, -- Aggregate severity [0, 100]
    priority          DOUBLE PRECISION NOT NULL DEFAULT 0.0, -- score * amount_at_risk
    amount_moved      NUMERIC(14,2),
    amount_cashed     NUMERIC(14,2), -- Funds transferred to cash-out sinks
    amount_at_risk    NUMERIC(14,2), -- Inflow minus already cashed-out funds
    duration_min      DOUBLE PRECISION,
    n_accounts        INTEGER,
    n_victims         INTEGER,
    explanation_json  JSONB,
    explanation       TEXT,
    pattern_tags      TEXT[],
    recommended       TEXT,
    detected_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    PRIMARY KEY (run_id, ring_id)
);

-- Membership and assigned roles within detected rings
CREATE TABLE IF NOT EXISTS ring_members (
    run_id      BIGINT NOT NULL,
    ring_id     TEXT NOT NULL,
    account_id  TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('victim', 'collector', 'mule', 'cash_out')),
    PRIMARY KEY (run_id, ring_id, account_id),
    FOREIGN KEY (run_id, ring_id) REFERENCES rings(run_id, ring_id) ON DELETE CASCADE
);

-- Exact transaction edge set belonging to each ring (enables timeline replay without re-computation)
CREATE TABLE IF NOT EXISTS ring_transactions (
    run_id     BIGINT NOT NULL,
    ring_id    TEXT NOT NULL,
    txn_id     TEXT NOT NULL REFERENCES transactions(txn_id) ON DELETE CASCADE,
    hop_index  INTEGER,
    PRIMARY KEY (run_id, ring_id, txn_id),
    FOREIGN KEY (run_id, ring_id) REFERENCES rings(run_id, ring_id) ON DELETE CASCADE
);

-- Offline and run-level evaluation metrics across methods and segments
CREATE TABLE IF NOT EXISTS metrics (
    metric_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id      BIGINT NOT NULL REFERENCES pipeline_runs(run_id) ON DELETE CASCADE,
    dataset_id  TEXT REFERENCES datasets(dataset_id),
    method      TEXT NOT NULL CHECK (method IN ('baseline_rules', 'graph_rules', 'ml_only', 'full_fusion')),
    segment     TEXT NOT NULL DEFAULT 'overall', -- 'overall', ring typologies, difficulty tiers
    name        TEXT NOT NULL,                    -- precision, recall, f1, fpr, ring_recall, alert_reduction, etc.
    value       DOUBLE PRECISION NOT NULL,
    CONSTRAINT uq_run_method_segment_metric UNIQUE (run_id, method, segment, name)
);

-- Stored curve coordinates (PR curves, ROC curves, ablation plots)
CREATE TABLE IF NOT EXISTS metric_artifacts (
    artifact_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id        BIGINT NOT NULL REFERENCES pipeline_runs(run_id) ON DELETE CASCADE,
    method        TEXT NOT NULL,
    name          TEXT NOT NULL, -- e.g., 'pr_curve', 'roc_curve', 'confusion_matrix'
    payload_json  JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- =============================================================================
-- SECTION 4: ANALYST STATE & IMMUTABLE AUDIT LOG
-- (Survives all pipeline re-runs; linked via Jaccard membership overlap)
-- =============================================================================

-- Case management tracker
CREATE TABLE IF NOT EXISTS cases (
    case_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    status             TEXT NOT NULL DEFAULT 'new'
                       CHECK (status IN ('new', 'under_review', 'frozen', 'escalated', 'false_positive')),
    priority           DOUBLE PRECISION DEFAULT 0.0,
    assigned_to        TEXT,
    notes              TEXT,
    first_seen_run_id  BIGINT REFERENCES pipeline_runs(run_id) ON DELETE SET NULL,
    last_seen_run_id   BIGINT REFERENCES pipeline_runs(run_id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Multi-fingerprint mapping: links re-runs to cases even if membership shifts slightly
CREATE TABLE IF NOT EXISTS case_fingerprints (
    case_id      BIGINT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    fingerprint  TEXT NOT NULL,
    run_id       BIGINT REFERENCES pipeline_runs(run_id) ON DELETE SET NULL,
    added_at     TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    PRIMARY KEY (case_id, fingerprint)
);

-- Append-only compliance audit trail
CREATE TABLE IF NOT EXISTS case_actions (
    action_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id      BIGINT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    actor        TEXT NOT NULL,
    action       TEXT NOT NULL CHECK (action IN ('freeze', 'escalate', 'false_positive', 'note', 'status_change')),
    from_status  TEXT,
    to_status    TEXT,
    note         TEXT,
    ts           TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- =============================================================================
-- SECTION 5: LIVE DEMO & SIMULATION STATE
-- =============================================================================

-- Singleton simulation controls for live presentations
CREATE TABLE IF NOT EXISTS simulation_state (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    status          TEXT NOT NULL DEFAULT 'stopped' CHECK (status IN ('stopped', 'running', 'paused')),
    speed           DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    cursor_ts       TIMESTAMPTZ,
    window_minutes  INTEGER NOT NULL DEFAULT 60,
    started_at      TIMESTAMPTZ
);

-- Initial singleton state row
INSERT INTO simulation_state (id, status, speed, window_minutes)
VALUES (1, 'stopped', 1.0, 60)
ON CONFLICT (id) DO NOTHING;

-- Lightweight stream event journal polled by frontend every 2 seconds
CREATE TABLE IF NOT EXISTS alert_events (
    event_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id      BIGINT REFERENCES pipeline_runs(run_id) ON DELETE CASCADE,
    ring_id     TEXT,
    event_type  TEXT NOT NULL CHECK (event_type IN ('new', 'updated')),
    payload     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- =============================================================================
-- SECTION 6: VIEWS & INDEXES
-- =============================================================================

-- Alert Queue View: Latest completed run joined with case management state
CREATE OR REPLACE VIEW v_alerts AS
SELECT 
    r.run_id,
    r.ring_id,
    r.fingerprint,
    r.ring_type,
    r.score,
    r.priority,
    r.amount_moved,
    r.amount_cashed,
    r.amount_at_risk,
    r.duration_min,
    r.n_accounts,
    r.n_victims,
    r.pattern_tags,
    r.recommended,
    r.detected_at,
    c.case_id,
    COALESCE(c.status, 'new') AS status,
    c.assigned_to,
    c.notes AS case_notes
FROM rings r
LEFT JOIN case_fingerprints cf ON cf.fingerprint = r.fingerprint
LEFT JOIN cases c ON c.case_id = cf.case_id
WHERE r.run_id = (SELECT MAX(run_id) FROM pipeline_runs WHERE status = 'done');

-- Feedback Labels View for Model Retraining (Excludes legitimate victims!)
CREATE OR REPLACE VIEW v_feedback_labels AS
SELECT 
    m.account_id,
    CASE c.status WHEN 'false_positive' THEN 0 ELSE 1 END AS label
FROM cases c
JOIN case_fingerprints cf ON cf.case_id = c.case_id
JOIN rings r ON r.fingerprint = cf.fingerprint
             AND r.run_id = (SELECT MAX(run_id) FROM pipeline_runs WHERE status = 'done')
JOIN ring_members m ON m.run_id = r.run_id AND m.ring_id = r.ring_id
WHERE c.status IN ('frozen', 'escalated', 'false_positive')
  AND m.role <> 'victim';

-- Transaction & graph performance indexes
CREATE INDEX IF NOT EXISTS idx_txn_ts         ON transactions(ts);
CREATE INDEX IF NOT EXISTS idx_txn_src_ts      ON transactions(src_account, ts);
CREATE INDEX IF NOT EXISTS idx_txn_dst_ts      ON transactions(dst_account, ts);
CREATE INDEX IF NOT EXISTS idx_txn_injected    ON transactions(injection_id) WHERE is_injected = true;

-- Detection queries & triage filtering indexes
CREATE INDEX IF NOT EXISTS idx_rings_run_prio  ON rings(run_id, priority DESC);
CREATE INDEX IF NOT EXISTS idx_rings_fp        ON rings(fingerprint);
CREATE INDEX IF NOT EXISTS idx_hits_run_acct   ON detector_hits(run_id, account_id);
CREATE INDEX IF NOT EXISTS idx_hits_run_code   ON detector_hits(run_id, code);
CREATE INDEX IF NOT EXISTS idx_scores_run_risk ON account_scores(run_id, risk DESC);
CREATE INDEX IF NOT EXISTS idx_ring_mem_acct   ON ring_members(account_id);
CREATE INDEX IF NOT EXISTS idx_ring_txns_id    ON ring_transactions(txn_id);

-- Case management & audit trail indexes
CREATE INDEX IF NOT EXISTS idx_case_fp_lookup  ON case_fingerprints(fingerprint);
CREATE INDEX IF NOT EXISTS idx_case_act_ts     ON case_actions(case_id, ts);
CREATE INDEX IF NOT EXISTS idx_alert_events_id ON alert_events(event_id);

-- =============================================================================
-- SECTION 7: HELPER FUNCTIONS & TRIGGERS
-- =============================================================================

-- Enforce append-only semantics on case_actions audit table
CREATE OR REPLACE FUNCTION fn_prevent_case_actions_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit trail violation: UPDATE or DELETE is strictly prohibited on case_actions.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_case_actions ON case_actions;
CREATE TRIGGER trg_immutable_case_actions
BEFORE UPDATE OR DELETE ON case_actions
FOR EACH ROW EXECUTE FUNCTION fn_prevent_case_actions_mutation();

-- Safely resets raw active dataset tables while keeping analyst cases and audit trails intact
CREATE OR REPLACE FUNCTION fn_reset_active_dataset()
RETURNS void AS $$
BEGIN
    TRUNCATE TABLE gt_transactions CASCADE;
    TRUNCATE TABLE gt_accounts CASCADE;
    TRUNCATE TABLE gt_rings CASCADE;
    TRUNCATE TABLE transactions CASCADE;
    TRUNCATE TABLE accounts CASCADE;
    UPDATE datasets SET is_active = false WHERE is_active = true;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SECTION 8: ROW LEVEL SECURITY (RLS)
-- (Locks public Supabase REST endpoints; backend connects via pooler/direct connection)
-- =============================================================================

ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gt_rings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gt_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gt_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE detector_hits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ring_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;

-- Note: Direct Postgres connection string bypasses RLS automatically.
-- By creating NO public policies, any accidental exposure of the Supabase Anon Key
-- returns empty datasets, completely shielding confidential banking data.

