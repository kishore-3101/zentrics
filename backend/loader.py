r"""
TraceMesh Unified Dataset Loader (Module 5 Deliverable 1 & 4)
=============================================================
Unified CLI orchestrator for dataset loading, validation, and database synchronization.

Features:
- Enforces pre-load validation checklist (datasetguide.md Section 10)
- Enforces strict foreign-key load order:
    1. gt_rings
    2. accounts
    3. gt_accounts
    4. transactions
    5. gt_transactions
- Executes atomic all-or-nothing transaction via PostgreSQL \copy (or INSERT fallback)
- Calls `fn_reset_active_dataset()` to preserve analyst cases and audit log
- Registers active dataset in `datasets` table
- Produces formatted execution and timing report
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.gt_loader import GroundTruthLoader
from backend.raw_loader import RawDataLoader, get_default_db_url
from backend.validation import DatasetValidator, ValidationReport


def resolve_dataset_dir(dataset_arg: str) -> Path:
    """Resolves dataset directory from direct path or relative to data/ folder."""
    p = Path(dataset_arg)
    if p.exists() and p.is_dir():
        return p.resolve()

    # Try relative to workspace data/
    workspace_data = Path.cwd() / "data" / dataset_arg
    if workspace_data.exists() and workspace_data.is_dir():
        return workspace_data.resolve()

    # Try relative to backend parent
    alt_data = Path(__file__).resolve().parent.parent / "data" / dataset_arg
    if alt_data.exists() and alt_data.is_dir():
        return alt_data.resolve()

    return p.resolve()


class DatasetLoader:
    """Orchestrates validation, SQL transaction generation, and execution."""

    def __init__(
        self,
        dataset_dir: str | Path,
        db_url: Optional[str] = None,
        load_raw: bool = True,
        load_gt: bool = True,
        reset_active: bool = True,
        use_copy: bool = True,
    ):
        self.dataset_dir = resolve_dataset_dir(str(dataset_dir))
        self.db_url = db_url or get_default_db_url()
        self.load_raw = load_raw
        self.load_gt = load_gt
        self.reset_active = reset_active
        self.use_copy = use_copy

        self.raw_loader = RawDataLoader(self.dataset_dir, self.db_url)
        self.gt_loader = GroundTruthLoader(self.dataset_dir, self.db_url)

    def validate(self) -> ValidationReport:
        """Runs pre-load validation checklist."""
        validator = DatasetValidator(self.dataset_dir)
        return validator.validate()

    def generate_unified_sql(self) -> str:
        """
        Generates atomic SQL script adhering to foreign key dependency order:
        1. BEGIN;
        2. fn_reset_active_dataset() (if reset_active)
        3. gt_rings (if load_gt)
        4. accounts (if load_raw)
        5. gt_accounts (if load_gt)
        6. transactions (if load_raw)
        7. gt_transactions (if load_gt)
        8. datasets table UPSERT (if load_raw)
        9. COMMIT;
        """
        lines = [
            "-- =============================================================================",
            f"-- TraceMesh Atomic Dataset Load Script: {self.dataset_dir.name}",
            f"-- Generated at: {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}",
            f"-- Format: {'COPY (psql client streaming)' if self.use_copy else 'INSERT (Universal SQL / Supabase Editor)'}",
            "-- =============================================================================",
            "\\set ON_ERROR_STOP on" if self.use_copy else "-- Auto-commit disabled for transactional atomicity",
            "BEGIN;",
        ]

        if self.reset_active:
            lines.extend([
                "",
                "-- Step 0: Safely reset active dataset without touching cases or audit trail",
                "SELECT fn_reset_active_dataset();",
            ])

        # Step 1: gt_rings (no foreign key dependencies)
        if self.load_gt:
            if self.use_copy:
                cmd = self.gt_loader.get_gt_rings_copy_command()
                if cmd:
                    lines.extend(["", "-- Step 1: Load Ground Truth Rings", cmd])
            else:
                ins = self.gt_loader.get_gt_rings_insert_sql()
                if ins:
                    lines.extend(["", "-- Step 1: Load Ground Truth Rings", ins])

        # Step 2: accounts (independent base table)
        if self.load_raw and self.raw_loader.accounts_csv.exists():
            if self.use_copy:
                cols = ", ".join(self.raw_loader.ACCOUNTS_COLUMNS)
                abs_path = str(self.raw_loader.accounts_csv.absolute())
                lines.extend([
                    "",
                    "-- Step 2: Load Core Bank Accounts",
                    f"\\copy accounts ({cols}) FROM '{abs_path}' WITH (FORMAT csv, HEADER true, NULL '');",
                ])
            else:
                ins = self.raw_loader.get_accounts_insert_sql()
                if ins:
                    lines.extend(["", "-- Step 2: Load Core Bank Accounts", ins])

        # Step 3: gt_accounts (depends on accounts and gt_rings)
        if self.load_gt:
            if self.use_copy:
                cmd = self.gt_loader.get_gt_accounts_copy_command()
                if cmd:
                    lines.extend(["", "-- Step 3: Load Account Ground-Truth Annotations", cmd])
            else:
                ins = self.gt_loader.get_gt_accounts_insert_sql()
                if ins:
                    lines.extend(["", "-- Step 3: Load Account Ground-Truth Annotations", ins])

        # Step 4: transactions (depends on accounts)
        if self.load_raw and self.raw_loader.transactions_csv.exists():
            if self.use_copy:
                cols = ", ".join(self.raw_loader.TRANSACTIONS_COLUMNS)
                abs_path = str(self.raw_loader.transactions_csv.absolute())
                lines.extend([
                    "",
                    "-- Step 4: Load Raw Transactions Stream",
                    f"\\copy transactions ({cols}) FROM '{abs_path}' WITH (FORMAT csv, HEADER true, NULL '');",
                ])
            else:
                ins = self.raw_loader.get_transactions_insert_sql()
                if ins:
                    lines.extend(["", "-- Step 4: Load Raw Transactions Stream", ins])

        # Step 5: gt_transactions (depends on transactions and gt_rings)
        if self.load_gt:
            if self.use_copy:
                cmd = self.gt_loader.get_gt_transactions_copy_command()
                if cmd:
                    lines.extend(["", "-- Step 5: Load Transaction Ground-Truth Annotations", cmd])
            else:
                ins = self.gt_loader.get_gt_transactions_insert_sql()
                if ins:
                    lines.extend(["", "-- Step 5: Load Transaction Ground-Truth Annotations", ins])

        # Step 6: Update datasets registry
        if self.load_raw:
            n_acc, n_tx = self.raw_loader.count_rows()
            lines.extend([
                "",
                "-- Step 6: Register dataset metadata and mark as active",
                self.raw_loader.get_dataset_registry_sql(n_acc, n_tx),
            ])

        lines.extend(["", "COMMIT;", ""])
        return "\n".join(lines)

    def run(self, dry_run: bool = False, output_sql: Optional[str] = None) -> int:
        """
        Executes the full load pipeline:
        1. Validate
        2. Generate SQL
        3. Execute or print dry-run
        4. Print load report
        """
        print(f"\n[*] Initiating load process for dataset '{self.dataset_dir.name}'...")
        print(f"[*] Path: {self.dataset_dir}")
        print(f"[*] Engine Format: {'psql COPY' if self.use_copy else 'SQL INSERT'}")

        # 1. Validation
        print("[*] Running pre-load validation checks...")
        val_start = time.perf_counter()
        report = self.validate()
        val_time = time.perf_counter() - val_start

        if not report.is_valid:
            print("\n[!] Pre-load validation FAILED! Transaction aborted before writing.")
            report.print_report()
            return 1

        print(f"[*] Pre-load validation PASSED in {val_time:.3f}s. Zero integrity violations.")

        # 2. SQL Generation
        sql_script = self.generate_unified_sql()

        if output_sql:
            out_p = Path(output_sql).resolve()
            out_p.parent.mkdir(parents=True, exist_ok=True)
            out_p.write_text(sql_script, encoding="utf-8")
            print(f"[*] Generated SQL transaction saved to: {out_p}")

        if dry_run:
            print("\n" + "=" * 70)
            print(" DRY RUN: Generated SQL Transaction Script")
            print("=" * 70)
            print(sql_script)
            print("=" * 70)
            print("[*] Dry run completed successfully without modifying database.")
            return 0

        # 3. Execution
        if not self.db_url:
            print("\n[!] Error: No database URL provided or found in environment.")
            print("    Please set DATABASE_URL or DIRECT_DATABASE_URL in .env, or use --db-url.")
            print("    Alternatively, use --dry-run or -o to export the SQL script.")
            return 1

        print("[*] Executing atomic transaction against database via psql...")
        res = self.raw_loader.execute_psql(sql_script)

        if not res["success"]:
            print(f"\n[!] Database load FAILED after {res['duration_seconds']:.2f}s!")
            print(f"[!] Error message:\n{res['error']}")
            return 1

        # 4. Success Report
        self._print_load_report(res["duration_seconds"])
        return 0

    def _print_load_report(self, duration_s: float):
        n_acc, n_tx = self.raw_loader.count_rows()
        gt_counts = self.gt_loader.count_rows()

        print("\n" + "=" * 70)
        print(f" TRACEMESH DATASET LOAD REPORT: {self.dataset_dir.name}")
        print("=" * 70)
        print(f" {'Table Name':<25} | {'Rows Loaded':<15} | {'Status':<10}")
        print("-" * 70)

        if self.load_gt:
            print(f" {'gt_rings':<25} | {gt_counts['gt_rings']:<15} | {'SUCCESS':<10}")

        if self.load_raw:
            print(f" {'accounts':<25} | {n_acc:<15} | {'SUCCESS':<10}")

        if self.load_gt:
            print(f" {'gt_accounts':<25} | {gt_counts['gt_accounts']:<15} | {'SUCCESS':<10}")

        if self.load_raw:
            print(f" {'transactions':<25} | {n_tx:<15} | {'SUCCESS':<10}")

        if self.load_gt:
            print(f" {'gt_transactions':<25} | {gt_counts['gt_transactions']:<15} | {'SUCCESS':<10}")

        if self.load_raw:
            print(f" {'datasets (registry)':<25} | {1:<15} | {'ACTIVE':<10}")

        print("-" * 70)
        print(f" Total Transaction Elapsed Time : {duration_s:.3f} seconds")
        print(f" Active Dataset Switch          : COMPLETED (fn_reset_active_dataset)")
        print("=" * 70 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description="TraceMesh Dataset Bulk Loader & Validator (PostgreSQL / Supabase)"
    )
    parser.add_argument(
        "--dataset",
        "-d",
        required=True,
        help="Path or name of the dataset folder (e.g. data/toy or toy)",
    )
    parser.add_argument(
        "--format",
        choices=["copy", "insert"],
        default="copy",
        help="SQL load strategy: 'copy' for high-throughput psql \\copy, 'insert' for Supabase Web SQL editor",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Run validation checks and display report without loading",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate and display the transactional SQL script without executing",
    )
    parser.add_argument(
        "--raw-only",
        action="store_true",
        help="Load only raw data (accounts, transactions, datasets registry)",
    )
    parser.add_argument(
        "--gt-only",
        action="store_true",
        help="Load only ground-truth data (gt_rings, gt_accounts, gt_transactions)",
    )
    parser.add_argument(
        "--no-reset",
        action="store_true",
        help="Do not call fn_reset_active_dataset() before loading",
    )
    parser.add_argument(
        "--output-sql",
        "-o",
        help="Save generated transactional SQL script to specified file path",
    )
    parser.add_argument(
        "--db-url",
        help="Database connection URL (defaults to DATABASE_URL or DIRECT_DATABASE_URL)",
    )

    args = parser.parse_args()

    load_raw = not args.gt_only
    load_gt = not args.raw_only
    use_copy = args.format == "copy"

    loader = DatasetLoader(
        dataset_dir=args.dataset,
        db_url=args.db_url,
        load_raw=load_raw,
        load_gt=load_gt,
        reset_active=not args.no_reset,
        use_copy=use_copy,
    )

    if args.validate_only:
        report = loader.validate()
        report.print_report()
        sys.exit(0 if report.is_valid else 1)

    code = loader.run(dry_run=args.dry_run, output_sql=args.output_sql)
    sys.exit(code)


if __name__ == "__main__":
    main()
