r"""
Raw Data Loader (Module 5 Deliverable 1)
========================================
Loads raw transaction streams and customer accounts into PostgreSQL.
Strictly isolated from ground-truth data (labels/rings).

Features:
- Generates PostgreSQL client-side \copy bulk load scripts
- Supports SQL multi-row INSERT fallback (for browser SQL editor)
- Registers and marks dataset active in the `datasets` table
- Supports atomic transaction execution via psql
- Supports removing injected transactions by injection_id
"""

from __future__ import annotations

import csv
import json
import os
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


def get_default_db_url() -> Optional[str]:
    """Retrieve database URL from environment or .env file."""
    for key in ("DIRECT_DATABASE_URL", "DATABASE_URL"):
        val = os.getenv(key)
        if val:
            return val

    # Attempt to read .env from current directory or parent
    for base in [Path.cwd(), Path.cwd().parent]:
        env_file = base / ".env"
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    k, v = k.strip(), v.strip().strip("'\"")
                    if k in ("DIRECT_DATABASE_URL", "DATABASE_URL"):
                        return v
    return None


def sql_literal(val: str, is_numeric: bool = False, is_bool: bool = False) -> str:
    """Formats string from CSV into safely escaped SQL literal."""
    if val is None or val == "":
        return "NULL"
    if is_bool:
        v = val.strip().lower()
        return "true" if v in ("true", "t", "1") else "false"
    if is_numeric:
        try:
            float(val)
            return val
        except ValueError:
            return "NULL"
    escaped = val.replace("'", "''")
    return f"'{escaped}'"


class RawDataLoader:
    """Loads accounts, transactions, and dataset registry records into PostgreSQL."""

    ACCOUNTS_COLUMNS = [
        "account_id",
        "open_date",
        "kyc_level",
        "account_type",
        "city_cluster",
        "declared_income_band",
        "bank_id",
    ]

    TRANSACTIONS_COLUMNS = [
        "txn_id",
        "ts",
        "src_account",
        "dst_account",
        "amount",
        "channel",
        "is_injected",
        "injection_id",
    ]

    def __init__(self, dataset_dir: str | Path, db_url: Optional[str] = None):
        self.dataset_dir = Path(dataset_dir).resolve()
        self.db_url = db_url or get_default_db_url()

        self.accounts_csv = self.dataset_dir / "accounts.csv"
        self.transactions_csv = self.dataset_dir / "transactions.csv"
        self.config_json = self.dataset_dir / "config.json"

    def count_rows(self) -> Tuple[int, int]:
        """Returns (accounts_count, transactions_count)."""
        n_accounts = 0
        if self.accounts_csv.exists():
            with open(self.accounts_csv, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                next(reader, None)  # header
                n_accounts = sum(1 for _ in reader)

        n_txns = 0
        if self.transactions_csv.exists():
            with open(self.transactions_csv, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                next(reader, None)  # header
                n_txns = sum(1 for _ in reader)

        return n_accounts, n_txns

    def get_copy_commands(self) -> List[str]:
        r"""
        Generates client-side \copy commands for accounts and transactions.
        Uses absolute paths and explicit column lists with NULL ''.
        """
        commands = []
        if self.accounts_csv.exists():
            cols = ", ".join(self.ACCOUNTS_COLUMNS)
            abs_path = str(self.accounts_csv.absolute())
            commands.append(
                f"\\copy accounts ({cols}) FROM '{abs_path}' WITH (FORMAT csv, HEADER true, NULL '');"
            )

        if self.transactions_csv.exists():
            cols = ", ".join(self.TRANSACTIONS_COLUMNS)
            abs_path = str(self.transactions_csv.absolute())
            commands.append(
                f"\\copy transactions ({cols}) FROM '{abs_path}' WITH (FORMAT csv, HEADER true, NULL '');"
            )

        return commands

    def get_accounts_insert_sql(self) -> Optional[str]:
        """Generates multi-row INSERT SQL statement for accounts."""
        if not self.accounts_csv.exists():
            return None
        rows = []
        with open(self.accounts_csv, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                vals = [
                    sql_literal(r.get("account_id", "")),
                    sql_literal(r.get("open_date", "")),
                    sql_literal(r.get("kyc_level", "")),
                    sql_literal(r.get("account_type", "")),
                    sql_literal(r.get("city_cluster", "")),
                    sql_literal(r.get("declared_income_band", "")),
                    sql_literal(r.get("bank_id", "TRACE_BANK")),
                ]
                rows.append(f"  ({', '.join(vals)})")
        if not rows:
            return None
        cols = ", ".join(self.ACCOUNTS_COLUMNS)
        return f"INSERT INTO accounts ({cols}) VALUES\n" + ",\n".join(rows) + ";"

    def get_transactions_insert_sql(self) -> Optional[str]:
        """Generates multi-row INSERT SQL statement for transactions."""
        if not self.transactions_csv.exists():
            return None
        rows = []
        with open(self.transactions_csv, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                vals = [
                    sql_literal(r.get("txn_id", "")),
                    sql_literal(r.get("ts", "")),
                    sql_literal(r.get("src_account", "")),
                    sql_literal(r.get("dst_account", "")),
                    sql_literal(r.get("amount", "0"), is_numeric=True),
                    sql_literal(r.get("channel", "")),
                    sql_literal(r.get("is_injected", "false"), is_bool=True),
                    sql_literal(r.get("injection_id", "")),
                ]
                rows.append(f"  ({', '.join(vals)})")
        if not rows:
            return None
        cols = ", ".join(self.TRANSACTIONS_COLUMNS)
        return f"INSERT INTO transactions ({cols}) VALUES\n" + ",\n".join(rows) + ";"

    def get_dataset_registry_sql(self, n_accounts: int, n_txns: int) -> str:
        """
        Generates UPSERT SQL statement for datasets table.
        Marks this dataset as is_active = true.
        """
        dataset_id = self.dataset_dir.name
        name = dataset_id
        role = "toy"
        seed_val = "NULL"
        config_obj: Dict[str, Any] = {}

        if self.config_json.exists():
            try:
                with open(self.config_json, "r", encoding="utf-8") as f:
                    config_obj = json.load(f)
                role = config_obj.get("role", "toy")
                name = config_obj.get("name", dataset_id)
                if "seed" in config_obj and config_obj["seed"] is not None:
                    seed_val = str(int(config_obj["seed"]))
            except Exception:
                pass

        config_escaped = json.dumps(config_obj).replace("'", "''")

        sql = f"""
-- Register active dataset
INSERT INTO datasets (dataset_id, name, role, seed, config_json, n_accounts, n_txns, is_active)
VALUES (
    '{dataset_id}',
    '{name}',
    '{role}',
    {seed_val},
    '{config_escaped}'::jsonb,
    {n_accounts},
    {n_txns},
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
"""
        return sql.strip()

    def generate_sql_script(self, reset_active: bool = False, use_copy: bool = True) -> str:
        """
        Generates full transaction SQL script for loading raw data.
        """
        n_accounts, n_txns = self.count_rows()
        lines = [
            "-- TraceMesh Raw Data Load Script",
            "-- Target Dataset: " + self.dataset_dir.name,
            "BEGIN;",
        ]

        if reset_active:
            lines.append("SELECT fn_reset_active_dataset();")

        if use_copy:
            for cmd in self.get_copy_commands():
                lines.append(cmd)
        else:
            acc_ins = self.get_accounts_insert_sql()
            if acc_ins:
                lines.append(acc_ins)
            txn_ins = self.get_transactions_insert_sql()
            if txn_ins:
                lines.append(txn_ins)

        lines.append(self.get_dataset_registry_sql(n_accounts, n_txns))
        lines.append("COMMIT;")
        return "\n".join(lines) + "\n"

    def execute_psql(self, sql_script: str, timeout: int = 120) -> Dict[str, Any]:
        """
        Executes a SQL script via psql binary against the configured db_url.
        Returns execution dictionary with success, duration, stdout, and stderr.
        """
        if not self.db_url:
            raise ValueError("No database URL configured. Provide db_url or set DATABASE_URL/.env.")

        start_time = time.perf_counter()
        proc = subprocess.run(
            ["psql", self.db_url, "-v", "ON_ERROR_STOP=1"],
            input=sql_script,
            text=True,
            capture_output=True,
            timeout=timeout,
        )
        elapsed = time.perf_counter() - start_time

        if proc.returncode != 0:
            return {
                "success": False,
                "duration_seconds": elapsed,
                "error": proc.stderr,
                "output": proc.stdout,
                "returncode": proc.returncode,
            }

        return {
            "success": True,
            "duration_seconds": elapsed,
            "error": None,
            "output": proc.stdout,
            "returncode": 0,
        }


def remove_injected_transactions(injection_id: str, db_url: Optional[str] = None) -> str:
    """
    Generates SQL to remove injected transactions by injection_id.
    """
    escaped_id = injection_id.replace("'", "''")
    return f"""
DELETE FROM transactions
WHERE injection_id = '{escaped_id}' AND is_injected = true;
""".strip()
