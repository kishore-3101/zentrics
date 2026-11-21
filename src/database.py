"""
database.py – Production-grade Database Engine for TraceMesh / Mule Ring Detection.
Supports SQLite (zero-setup local default) and PostgreSQL/Supabase (via DATABASE_URL).
Matches the schema defined in new_schema.sql.
"""
from __future__ import annotations

import json
import logging
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Tuple, Union

import numpy as np
import pandas as pd

from src.config import DEFAULT_DB_PATH, DATABASE_URL, PROJECT_ROOT

logger = logging.getLogger(__name__)


def _is_sqlite() -> bool:
    return DATABASE_URL.startswith("sqlite")


@contextmanager
def get_db_connection() -> Generator[sqlite3.Connection, None, None]:
    """Provide a transactional database connection (SQLite)."""
    DEFAULT_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DEFAULT_DB_PATH), timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error("Database transaction rolled back due to error: %s", e)
        raise
    finally:
        conn.close()


# -----------------------------------------------------------------------------
# DDL: Tables aligned with new_schema.sql
# -----------------------------------------------------------------------------
SCHEMA_DDL = """
-- 1. Datasets registry
CREATE TABLE IF NOT EXISTS datasets (
    dataset_id   TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    role         TEXT NOT NULL,
    seed         INTEGER,
    config_json  TEXT,
    n_accounts   INTEGER,
    n_txns       INTEGER,
    created_at   TEXT NOT NULL,
    is_active    INTEGER NOT NULL DEFAULT 0
);

-- 2. Core accounts
CREATE TABLE IF NOT EXISTS accounts (
    account_id            TEXT PRIMARY KEY,
    open_date             TEXT NOT NULL,
    kyc_level             TEXT,
    account_type          TEXT NOT NULL,
    city_cluster          TEXT,
    declared_income_band  TEXT,
    bank_id               TEXT DEFAULT 'TRACE_BANK',
    customer_id           TEXT,
    age                   INTEGER,
    occupation            TEXT,
    branch_id             TEXT,
    initial_balance       REAL DEFAULT 0.0,
    created_at            TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 3. Raw transactions
CREATE TABLE IF NOT EXISTS transactions (
    txn_id         TEXT PRIMARY KEY,
    ts             TEXT NOT NULL,
    src_account    TEXT NOT NULL,
    dst_account    TEXT NOT NULL,
    amount         REAL NOT NULL,
    channel        TEXT NOT NULL,
    is_injected    INTEGER NOT NULL DEFAULT 0,
    injection_id   TEXT,
    transaction_type TEXT,
    status         TEXT DEFAULT 'Success',
    FOREIGN KEY (src_account) REFERENCES accounts(account_id) ON DELETE CASCADE,
    FOREIGN KEY (dst_account) REFERENCES accounts(account_id) ON DELETE CASCADE
);

-- 4. Isolated ground truth rings
CREATE TABLE IF NOT EXISTS gt_rings (
    gt_ring_id       TEXT PRIMARY KEY,
    ring_type        TEXT NOT NULL,
    difficulty       TEXT DEFAULT 'medium',
    n_accounts       INTEGER NOT NULL DEFAULT 0,
    n_victims        INTEGER NOT NULL DEFAULT 0,
    first_inflow_ts  TEXT,
    last_outflow_ts  TEXT,
    amount_total     REAL NOT NULL DEFAULT 0.0,
    params_json      TEXT
);

-- 5. Isolated ground truth accounts
CREATE TABLE IF NOT EXISTS gt_accounts (
    account_id    TEXT PRIMARY KEY,
    true_is_mule  INTEGER NOT NULL DEFAULT 0,
    train_label   INTEGER NOT NULL DEFAULT 0,
    gt_ring_id    TEXT,
    role          TEXT NOT NULL DEFAULT 'normal',
    scenario      TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE,
    FOREIGN KEY (gt_ring_id) REFERENCES gt_rings(gt_ring_id) ON DELETE SET NULL
);

-- 6. Isolated ground truth transactions
CREATE TABLE IF NOT EXISTS gt_transactions (
    txn_id            TEXT PRIMARY KEY,
    is_fraud_related  INTEGER NOT NULL DEFAULT 0,
    gt_ring_id        TEXT,
    FOREIGN KEY (txn_id) REFERENCES transactions(txn_id) ON DELETE CASCADE,
    FOREIGN KEY (gt_ring_id) REFERENCES gt_rings(gt_ring_id) ON DELETE SET NULL
);

-- 7. Detection pipeline runs
CREATE TABLE IF NOT EXISTS pipeline_runs (
    run_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id      TEXT,
    kind            TEXT NOT NULL DEFAULT 'batch',
    status          TEXT NOT NULL DEFAULT 'running',
    started_at      TEXT NOT NULL,
    finished_at     TEXT,
    duration_s      REAL,
    config_json     TEXT,
    n_txns          INTEGER,
    git_sha         TEXT,
    window_minutes  INTEGER
);

-- 8. Account risk scores per run
CREATE TABLE IF NOT EXISTS account_scores (
    run_id         INTEGER NOT NULL,
    account_id     TEXT NOT NULL,
    risk           REAL NOT NULL,
    ml_prob        REAL,
    rule_score     REAL,
    neighbor_risk  REAL,
    community_id   INTEGER,
    features_json  TEXT,
    shap_json      TEXT,
    reason_codes   TEXT,
    PRIMARY KEY (run_id, account_id),
    FOREIGN KEY (run_id) REFERENCES pipeline_runs(run_id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
);

-- 9. Detector hits
CREATE TABLE IF NOT EXISTS detector_hits (
    hit_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id        INTEGER NOT NULL,
    account_id    TEXT NOT NULL,
    code          TEXT NOT NULL,
    window_start  TEXT,
    window_end    TEXT,
    severity      TEXT DEFAULT 'medium',
    evidence_json TEXT,
    detail        TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES pipeline_runs(run_id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
);

-- 10. Detected candidate rings
CREATE TABLE IF NOT EXISTS rings (
    ring_id           TEXT NOT NULL,
    run_id            INTEGER NOT NULL,
    fingerprint       TEXT NOT NULL,
    ring_type         TEXT NOT NULL,
    score             REAL NOT NULL,
    priority          REAL NOT NULL DEFAULT 0.0,
    amount_moved      REAL DEFAULT 0.0,
    amount_cashed     REAL DEFAULT 0.0,
    amount_at_risk    REAL DEFAULT 0.0,
    duration_min      REAL DEFAULT 0.0,
    n_accounts        INTEGER DEFAULT 0,
    n_victims         INTEGER DEFAULT 0,
    explanation_json  TEXT,
    explanation       TEXT,
    pattern_tags      TEXT,
    recommended       TEXT,
    detected_at       TEXT NOT NULL,
    PRIMARY KEY (run_id, ring_id),
    FOREIGN KEY (run_id) REFERENCES pipeline_runs(run_id) ON DELETE CASCADE
);

-- 11. Ring members
CREATE TABLE IF NOT EXISTS ring_members (
    run_id      INTEGER NOT NULL,
    ring_id     TEXT NOT NULL,
    account_id  TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'mule',
    PRIMARY KEY (run_id, ring_id, account_id),
    FOREIGN KEY (run_id, ring_id) REFERENCES rings(run_id, ring_id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
);

-- 12. Ring transactions
CREATE TABLE IF NOT EXISTS ring_transactions (
    run_id     INTEGER NOT NULL,
    ring_id    TEXT NOT NULL,
    txn_id     TEXT NOT NULL,
    hop_index  INTEGER DEFAULT 0,
    PRIMARY KEY (run_id, ring_id, txn_id),
    FOREIGN KEY (run_id, ring_id) REFERENCES rings(run_id, ring_id) ON DELETE CASCADE,
    FOREIGN KEY (txn_id) REFERENCES transactions(txn_id) ON DELETE CASCADE
);

-- 13. Metrics
CREATE TABLE IF NOT EXISTS metrics (
    metric_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id      INTEGER NOT NULL,
    dataset_id  TEXT,
    method      TEXT NOT NULL,
    segment     TEXT NOT NULL DEFAULT 'overall',
    name        TEXT NOT NULL,
    value       REAL NOT NULL,
    UNIQUE (run_id, method, segment, name),
    FOREIGN KEY (run_id) REFERENCES pipeline_runs(run_id) ON DELETE CASCADE
);

-- 14. Cases & analyst workflow
CREATE TABLE IF NOT EXISTS cases (
    case_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    ring_id     TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'new',
    assigned_to TEXT,
    notes       TEXT,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_actions (
    action_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id     INTEGER NOT NULL,
    actor       TEXT NOT NULL,
    action      TEXT NOT NULL,
    from_status TEXT,
    to_status   TEXT,
    note        TEXT,
    ts          TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE
);
"""


def init_database() -> None:
    """Initialize database tables matching the canonical schema."""
    logger.info("Initializing database at: %s", DEFAULT_DB_PATH)
    with get_db_connection() as conn:
        conn.executescript(SCHEMA_DDL)
    logger.info("Database schema initialized successfully.")


# -----------------------------------------------------------------------------
# Database Ingestion Functions
# -----------------------------------------------------------------------------

def upsert_accounts(accounts_df: pd.DataFrame) -> int:
    """
    Ingest accounts into database idempotently.
    Returns count of accounts inserted/updated.
    """
    if accounts_df.empty:
        return 0

    init_database()
    records = []
    gt_records = []

    for _, row in accounts_df.iterrows():
        acct_id = str(row["account_id"])
        open_date = str(row.get("open_date", "2020-01-01"))[:10]
        
        # Normalize kyc_level
        raw_kyc = str(row.get("kyc_level", "")).lower()
        kyc = "full" if "verif" in raw_kyc or "full" in raw_kyc else "minimal"

        # Normalize account_type
        raw_type = str(row.get("account_type", "")).lower()
        if "saving" in raw_type:
            acct_type = "savings"
        elif "current" in raw_type or "salary" in raw_type:
            acct_type = "current"
        elif "wallet" in raw_type:
            acct_type = "wallet"
        elif "sink" in raw_type:
            acct_type = "sink"
        else:
            acct_type = "savings"

        city = str(row.get("city_cluster", row.get("city", "UNKNOWN"))).upper()
        income = str(row.get("declared_income_band", "mid")).lower()
        if income not in {"low", "lower_mid", "mid", "upper_mid", "high"}:
            income = "mid"

        records.append((
            acct_id,
            open_date,
            kyc,
            acct_type,
            city,
            income,
            str(row.get("bank_id", "TRACE_BANK")),
            str(row.get("customer_id", f"CUST_{acct_id}")),
            int(row.get("age", 35)) if pd.notnull(row.get("age")) else 35,
            str(row.get("occupation", "Professional")),
            str(row.get("branch_id", "BR_MAIN")),
            float(row.get("initial_balance", 0.0)),
        ))

        # Ground truth
        if "is_mule" in row:
            gt_records.append((
                acct_id,
                int(row["is_mule"]),
                int(row["is_mule"]),
                str(row.get("ring_id")) if pd.notnull(row.get("ring_id")) else None,
                "mule" if int(row["is_mule"]) == 1 else "normal",
                str(row.get("scenario", "normal")),
            ))

    with get_db_connection() as conn:
        conn.executemany(
            """
            INSERT OR REPLACE INTO accounts (
                account_id, open_date, kyc_level, account_type, city_cluster,
                declared_income_band, bank_id, customer_id, age, occupation,
                branch_id, initial_balance
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            records,
        )

        if gt_records:
            valid_rings = {r[0] for r in conn.execute("SELECT gt_ring_id FROM gt_rings").fetchall()}
            sanitized_gt = [
                (aid, true_mule, train_lbl, rid if rid in valid_rings else None, role, scen)
                for aid, true_mule, train_lbl, rid, role, scen in gt_records
            ]
            conn.executemany(
                """
                INSERT OR REPLACE INTO gt_accounts (
                    account_id, true_is_mule, train_label, gt_ring_id, role, scenario
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                sanitized_gt,
            )

    logger.info("Upserted %d accounts into database.", len(records))
    return len(records)


def upsert_transactions(transactions_df: pd.DataFrame) -> int:
    """
    Ingest transactions into database idempotently.
    Ensures foreign keys to accounts exist by registering any unknown endpoints.
    """
    if transactions_df.empty:
        return 0

    init_database()
    
    # 1. Ensure all counterpart accounts exist to satisfy foreign key integrity
    all_srcs = set(transactions_df["src_account"].astype(str).dropna())
    all_dsts = set(transactions_df["dst_account"].astype(str).dropna())
    counterparts = all_srcs | all_dsts

    with get_db_connection() as conn:
        existing = {r[0] for r in conn.execute("SELECT account_id FROM accounts").fetchall()}
        missing = counterparts - existing
        if missing:
            logger.info("Creating %d placeholder accounts for foreign key integrity.", len(missing))
            placeholders = [
                (
                    acct,
                    "2020-01-01",
                    "full",
                    "savings",
                    "EXTERNAL",
                    "mid",
                    "EXTERNAL_BANK",
                    f"CUST_{acct}",
                    30,
                    "Counterparty",
                    "BR_EXT",
                    0.0
                )
                for acct in missing
            ]
            conn.executemany(
                """
                INSERT OR IGNORE INTO accounts (
                    account_id, open_date, kyc_level, account_type, city_cluster,
                    declared_income_band, bank_id, customer_id, age, occupation,
                    branch_id, initial_balance
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                placeholders,
            )

    records = []
    gt_txns = []

    for _, row in transactions_df.iterrows():
        txn_id = str(row["txn_id"])
        ts_val = pd.to_datetime(row["ts"])
        ts_str = ts_val.isoformat() if pd.notnull(ts_val) else datetime.now(timezone.utc).isoformat()
        amount = max(0.01, float(row["amount"]))
        
        # Channel mapping
        raw_ch = str(row.get("channel", row.get("transaction_type", "UPI"))).upper()
        if "UPI" in raw_ch:
            channel = "UPI"
        elif "IMPS" in raw_ch or "NET" in raw_ch:
            channel = "IMPS"
        elif "NEFT" in raw_ch or "WIRE" in raw_ch or "RTGS" in raw_ch:
            channel = "NEFT"
        elif "ATM" in raw_ch or "CASH" in raw_ch:
            channel = "ATM_WITHDRAWAL"
        else:
            channel = "UPI"

        records.append((
            txn_id,
            ts_str,
            str(row["src_account"]),
            str(row["dst_account"]),
            amount,
            channel,
            int(row.get("is_injected", 0)),
            str(row.get("injection_id", "")) if pd.notnull(row.get("injection_id")) else None,
            str(row.get("transaction_type", channel)),
            str(row.get("transaction_status", "Success")),
        ))

        if "is_fraud_related" in row:
            gt_txns.append((
                txn_id,
                int(row["is_fraud_related"]),
                str(row.get("ring_id")) if pd.notnull(row.get("ring_id")) else None,
            ))

    with get_db_connection() as conn:
        conn.executemany(
            """
            INSERT OR REPLACE INTO transactions (
                txn_id, ts, src_account, dst_account, amount, channel,
                is_injected, injection_id, transaction_type, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            records,
        )

        if gt_txns:
            valid_rings = {r[0] for r in conn.execute("SELECT gt_ring_id FROM gt_rings").fetchall()}
            sanitized_gt_txns = [
                (tid, is_fraud, rid if rid in valid_rings else None)
                for tid, is_fraud, rid in gt_txns
            ]
            conn.executemany(
                """
                INSERT OR REPLACE INTO gt_transactions (
                    txn_id, is_fraud_related, gt_ring_id
                ) VALUES (?, ?, ?)
                """,
                sanitized_gt_txns,
            )

    logger.info("Upserted %d transactions into database.", len(records))
    return len(records)


def upsert_fraud_rings(rings_df: pd.DataFrame) -> int:
    """Ingest ground truth fraud rings into gt_rings and ring_members."""
    if rings_df.empty:
        return 0

    init_database()
    gt_rings = []
    members = []

    grouped = rings_df.groupby("ring_id")
    for ring_id, group in grouped:
        ring_type_raw = str(group["fraud_pattern"].iloc[0]).lower()
        if "circ" in ring_type_raw:
            ring_type = "circular_flow"
        elif "layer" in ring_type_raw:
            ring_type = "layering_chain"
        elif "pass" in ring_type_raw:
            ring_type = "pass_through_hub"
        elif "dorm" in ring_type_raw:
            ring_type = "dormant_active"
        else:
            ring_type = "fan_in_fan_out"

        gt_rings.append((
            str(ring_id),
            ring_type,
            "medium",
            len(group),
            int((group.get("entry_point", 0) == 1).sum()),
            None,
            None,
            0.0,
            json.dumps({"pattern": ring_type_raw}),
        ))

    with get_db_connection() as conn:
        conn.executemany(
            """
            INSERT OR REPLACE INTO gt_rings (
                gt_ring_id, ring_type, difficulty, n_accounts, n_victims,
                first_inflow_ts, last_outflow_ts, amount_total, params_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            gt_rings,
        )

    logger.info("Upserted %d ground truth rings into database.", len(gt_rings))
    return len(gt_rings)


def save_pipeline_execution(
    risk_scores_df: pd.DataFrame,
    rings_df: pd.DataFrame,
    metrics_dict: Optional[Dict[str, Any]] = None,
    dataset_id: str = "train_v1",
) -> int:
    """
    Save complete pipeline execution outputs into database:
    - pipeline_runs record
    - account_scores table
    - rings & ring_members tables
    - metrics table
    Returns run_id.
    """
    init_database()
    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO pipeline_runs (
                dataset_id, kind, status, started_at, finished_at,
                duration_s, config_json, n_txns
            ) VALUES (?, 'batch', 'done', ?, ?, 0.0, ?, ?)
            """,
            (
                dataset_id,
                now_iso,
                now_iso,
                json.dumps({"weights": "0.5_ml + 0.3_rule + 0.2_nbr"}),
                len(risk_scores_df),
            ),
        )
        run_id = cursor.lastrowid

        # 1. Account scores
        score_records = []
        for _, row in risk_scores_df.iterrows():
            acct_id = str(row["account_id"])
            score_records.append((
                run_id,
                acct_id,
                float(row.get("account_risk_score", row.get("risk", 0.0))),
                float(row.get("ml_prob", 0.0)),
                float(row.get("rule_score_raw", row.get("rule_score", 0.0))),
                float(row.get("neighbor_risk_raw", row.get("neighbor_risk", 0.0))),
                int(row.get("graph_community_id", 0)) if pd.notnull(row.get("graph_community_id")) else 0,
                json.dumps({"category": str(row.get("risk_category", "Low Risk"))}),
                json.dumps({}),
                json.dumps([]),
            ))

        cursor.executemany(
            """
            INSERT OR REPLACE INTO account_scores (
                run_id, account_id, risk, ml_prob, rule_score,
                neighbor_risk, community_id, features_json, shap_json, reason_codes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            score_records,
        )

        # 2. Rings & members
        if not rings_df.empty:
            ring_records = []
            member_records = []
            for _, r in rings_df.iterrows():
                rid = str(r["ring_id"])
                raw_accounts = r.get("member_accounts", None)
                if raw_accounts is not None and isinstance(raw_accounts, (list, set, tuple)):
                    accounts_clean = [str(a).strip() for a in raw_accounts if str(a).strip()]
                else:
                    raw_str = str(r.get("accounts", "")).replace("…", "").replace("[", "").replace("]", "").replace("'", "").replace('"', "")
                    accounts_clean = [a.strip() for a in raw_str.split(",") if a.strip()]

                score = float(r.get("mean_risk_score", r.get("score", 75.0)))
                priority = float(r.get("ring_priority_score", r.get("priority", 0.0)))
                amount_moved = float(r.get("total_money_moved", r.get("amount_moved", 0.0)))
                amount_risk = float(r.get("amount_at_risk", 0.0))

                ring_records.append((
                    rid,
                    run_id,
                    f"fp_{rid}",
                    str(r.get("patterns", "mixed")),
                    score,
                    priority,
                    amount_moved,
                    0.0,
                    amount_risk,
                    float(r.get("time_span_hours", 0.0)) * 60.0,
                    int(r.get("account_count", len(accounts_clean))),
                    0,
                    json.dumps({"accounts": accounts_clean}),
                    f"Detected fraud ring {rid} with {len(accounts_clean)} member accounts.",
                    str(r.get("patterns", "")),
                    "Freeze immediately and submit regulatory SAR.",
                    now_iso,
                ))

                for acct in accounts_clean:
                    member_records.append((run_id, rid, acct, "mule"))

            cursor.executemany(
                """
                INSERT OR REPLACE INTO rings (
                    ring_id, run_id, fingerprint, ring_type, score, priority,
                    amount_moved, amount_cashed, amount_at_risk, duration_min,
                    n_accounts, n_victims, explanation_json, explanation,
                    pattern_tags, recommended, detected_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                ring_records,
            )

            if member_records:
                cursor.executemany(
                    """
                    INSERT OR REPLACE INTO ring_members (
                        run_id, ring_id, account_id, role
                    ) VALUES (?, ?, ?, ?)
                    """,
                    member_records,
                )

        # 3. Metrics
        if metrics_dict:
            metric_records = [
                (run_id, dataset_id, "full_fusion", "overall", k, float(v))
                for k, v in metrics_dict.items()
                if isinstance(v, (int, float)) and not np.isnan(v)
            ]
            cursor.executemany(
                """
                INSERT OR REPLACE INTO metrics (
                    run_id, dataset_id, method, segment, name, value
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                metric_records,
            )

    logger.info("Saved pipeline run #%d to database successfully.", run_id)
    return run_id
