r"""
Ground-Truth Loader (Module 5 Deliverable 3)
============================================
Isolated loader for synthetic ground-truth labels and ring annotations.

ARCHITECTURAL FIREWALL:
This module is STRICTLY QUARANTINED for offline evaluation harnesses (Module 10)
and dataset administrators (Module 5).
DO NOT import or reference this module in:
- Detection pipelines (rules, graph algorithms, ML models)
- Feature extraction routines
- Production API endpoints or mock servers
"""

from __future__ import annotations

import csv
import os
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from backend.raw_loader import get_default_db_url, sql_literal


class GroundTruthLoader:
    """Loads gt_rings, gt_accounts, and gt_transactions into PostgreSQL."""

    GT_RINGS_COLUMNS = [
        "gt_ring_id",
        "ring_type",
        "difficulty",
        "n_accounts",
        "n_victims",
        "first_inflow_ts",
        "last_outflow_ts",
        "amount_total",
        "params_json",
    ]

    GT_ACCOUNTS_COLUMNS = [
        "account_id",
        "true_is_mule",
        "train_label",
        "gt_ring_id",
        "role",
        "scenario",
    ]

    GT_TRANSACTIONS_COLUMNS = [
        "txn_id",
        "is_fraud_related",
        "gt_ring_id",
    ]

    def __init__(self, dataset_dir: str | Path, db_url: Optional[str] = None):
        self.dataset_dir = Path(dataset_dir).resolve()
        self.db_url = db_url or get_default_db_url()

        self.gt_rings_csv = self.dataset_dir / "gt_rings.csv"
        self.gt_accounts_csv = self.dataset_dir / "gt_accounts.csv"
        self.gt_transactions_csv = self.dataset_dir / "gt_transactions.csv"

    def count_rows(self) -> Dict[str, int]:
        """Returns row counts for ground truth tables."""
        counts = {"gt_rings": 0, "gt_accounts": 0, "gt_transactions": 0}

        if self.gt_rings_csv.exists():
            with open(self.gt_rings_csv, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                next(reader, None)
                counts["gt_rings"] = sum(1 for _ in reader)

        if self.gt_accounts_csv.exists():
            with open(self.gt_accounts_csv, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                next(reader, None)
                counts["gt_accounts"] = sum(1 for _ in reader)

        if self.gt_transactions_csv.exists():
            with open(self.gt_transactions_csv, "r", encoding="utf-8") as f:
                reader = csv.reader(f)
                next(reader, None)
                counts["gt_transactions"] = sum(1 for _ in reader)

        return counts

    def get_gt_rings_copy_command(self) -> Optional[str]:
        if not self.gt_rings_csv.exists():
            return None
        cols = ", ".join(self.GT_RINGS_COLUMNS)
        abs_path = str(self.gt_rings_csv.absolute())
        return f"\\copy gt_rings ({cols}) FROM '{abs_path}' WITH (FORMAT csv, HEADER true, NULL '');"

    def get_gt_accounts_copy_command(self) -> Optional[str]:
        if not self.gt_accounts_csv.exists():
            return None
        cols = ", ".join(self.GT_ACCOUNTS_COLUMNS)
        abs_path = str(self.gt_accounts_csv.absolute())
        return f"\\copy gt_accounts ({cols}) FROM '{abs_path}' WITH (FORMAT csv, HEADER true, NULL '');"

    def get_gt_transactions_copy_command(self) -> Optional[str]:
        if not self.gt_transactions_csv.exists():
            return None
        cols = ", ".join(self.GT_TRANSACTIONS_COLUMNS)
        abs_path = str(self.gt_transactions_csv.absolute())
        return f"\\copy gt_transactions ({cols}) FROM '{abs_path}' WITH (FORMAT csv, HEADER true, NULL '');"

    def get_copy_commands(self) -> List[str]:
        """
        Returns COPY commands in valid FK dependency order:
        gt_rings -> gt_accounts -> gt_transactions.
        Note: gt_accounts and gt_transactions also depend on accounts and transactions.
        """
        cmds = []
        c1 = self.get_gt_rings_copy_command()
        if c1:
            cmds.append(c1)
        c2 = self.get_gt_accounts_copy_command()
        if c2:
            cmds.append(c2)
        c3 = self.get_gt_transactions_copy_command()
        if c3:
            cmds.append(c3)
        return cmds

    def get_gt_rings_insert_sql(self) -> Optional[str]:
        if not self.gt_rings_csv.exists():
            return None
        rows = []
        with open(self.gt_rings_csv, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                params_val = r.get("params_json", "{}") or "{}"
                escaped_params = params_val.replace("'", "''")
                vals = [
                    sql_literal(r.get("gt_ring_id", "")),
                    sql_literal(r.get("ring_type", "")),
                    sql_literal(r.get("difficulty", "")),
                    sql_literal(r.get("n_accounts", "0"), is_numeric=True),
                    sql_literal(r.get("n_victims", "0"), is_numeric=True),
                    sql_literal(r.get("first_inflow_ts", "")),
                    sql_literal(r.get("last_outflow_ts", "")),
                    sql_literal(r.get("amount_total", "0"), is_numeric=True),
                    f"'{escaped_params}'::jsonb",
                ]
                rows.append(f"  ({', '.join(vals)})")
        if not rows:
            return None
        cols = ", ".join(self.GT_RINGS_COLUMNS)
        return f"INSERT INTO gt_rings ({cols}) VALUES\n" + ",\n".join(rows) + ";"

    def get_gt_accounts_insert_sql(self) -> Optional[str]:
        if not self.gt_accounts_csv.exists():
            return None
        rows = []
        with open(self.gt_accounts_csv, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                vals = [
                    sql_literal(r.get("account_id", "")),
                    sql_literal(r.get("true_is_mule", "false"), is_bool=True),
                    sql_literal(r.get("train_label", "false"), is_bool=True),
                    sql_literal(r.get("gt_ring_id", "")),
                    sql_literal(r.get("role", "")),
                    sql_literal(r.get("scenario", "")),
                ]
                rows.append(f"  ({', '.join(vals)})")
        if not rows:
            return None
        cols = ", ".join(self.GT_ACCOUNTS_COLUMNS)
        return f"INSERT INTO gt_accounts ({cols}) VALUES\n" + ",\n".join(rows) + ";"

    def get_gt_transactions_insert_sql(self) -> Optional[str]:
        if not self.gt_transactions_csv.exists():
            return None
        rows = []
        with open(self.gt_transactions_csv, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                vals = [
                    sql_literal(r.get("txn_id", "")),
                    sql_literal(r.get("is_fraud_related", "false"), is_bool=True),
                    sql_literal(r.get("gt_ring_id", "")),
                ]
                rows.append(f"  ({', '.join(vals)})")
        if not rows:
            return None
        cols = ", ".join(self.GT_TRANSACTIONS_COLUMNS)
        return f"INSERT INTO gt_transactions ({cols}) VALUES\n" + ",\n".join(rows) + ";"

    def generate_sql_script(self, use_copy: bool = True) -> str:
        """Generates transactional SQL script for loading isolated GT tables."""
        lines = [
            "-- TraceMesh Isolated Ground-Truth Load Script",
            "-- Quarantined: DO NOT run in detection pipelines",
            "BEGIN;",
        ]
        if use_copy:
            for cmd in self.get_copy_commands():
                lines.append(cmd)
        else:
            r_ins = self.get_gt_rings_insert_sql()
            if r_ins:
                lines.append(r_ins)
            a_ins = self.get_gt_accounts_insert_sql()
            if a_ins:
                lines.append(a_ins)
            t_ins = self.get_gt_transactions_insert_sql()
            if t_ins:
                lines.append(t_ins)

        lines.append("COMMIT;")
        return "\n".join(lines) + "\n"

    def execute_psql(self, sql_script: str, timeout: int = 120) -> Dict[str, Any]:
        """Executes ground truth SQL via psql binary."""
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
