#!/usr/bin/env python3
"""
Test Suite for TraceMesh Module 5 (Loaders and Validation).
===========================================================
Verifies:
1. Pre-load validation checklist against datasetguide.md Section 10 and new_schema.sql
2. Rejection of broken datasets with descriptive error reports
3. Clean pass of canonical toy dataset
4. Foreign key dependency ordering in generated SQL transactions
5. Isolated Ground Truth loader separation
6. Active dataset reset mechanics (fn_reset_active_dataset)
7. Injected transaction removal helper
8. CLI command executions (--validate-only, --dry-run, --raw-only, --gt-only)
"""

import subprocess
import sys
import unittest
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.gt_loader import GroundTruthLoader
from backend.loader import DatasetLoader
from backend.raw_loader import RawDataLoader, remove_injected_transactions
from backend.validation import DatasetValidator


class TestDatasetValidation(unittest.TestCase):
    def setUp(self):
        self.toy_dir = PROJECT_ROOT / "data" / "toy"
        self.broken_dir = PROJECT_ROOT / "data" / "broken"

    def test_toy_dataset_validates_cleanly(self):
        """Toy dataset must pass all schema & Section 10 checks with 0 errors."""
        validator = DatasetValidator(self.toy_dir)
        report = validator.validate()

        self.assertTrue(report.is_valid, f"Toy dataset validation failed: {report.errors}")
        self.assertEqual(len(report.errors), 0)
        self.assertEqual(report.stats.get("Total Accounts"), 10)
        self.assertEqual(report.stats.get("Sink Accounts"), 1)
        self.assertEqual(report.stats.get("Total Transactions"), 30)
        self.assertEqual(report.stats.get("Planted Rings"), 1)
        self.assertEqual(report.stats.get("True Mules"), 4)

    def test_broken_dataset_fails_with_explicit_errors(self):
        """Deliberately broken dataset must be rejected and pinpoint all violations."""
        validator = DatasetValidator(self.broken_dir)
        report = validator.validate()

        self.assertFalse(report.is_valid)
        self.assertGreaterEqual(len(report.errors), 10)

        error_blob = "\n".join(report.errors)

        # Check that specific invariants were flagged
        self.assertIn("super_kyc", error_blob)
        self.assertIn("Duplicate account_id 'ACC_01'", error_blob)
        self.assertIn("invalid_type", error_blob)
        self.assertIn("unknown_type", error_blob)
        self.assertIn("extreme", error_blob)
        self.assertIn("role 'mule' but true_is_mule is false", error_blob)
        self.assertIn("Self-transfer violation", error_blob)
        self.assertIn("Amount must be positive", error_blob)
        self.assertIn("ACC_NON_EXISTENT", error_blob)
        self.assertIn("BITCOIN", error_blob)
        self.assertIn("Timestamp out of order", error_blob)
        self.assertIn("TXN_UNKNOWN", error_blob)


class TestRawDataLoader(unittest.TestCase):
    def setUp(self):
        self.toy_dir = PROJECT_ROOT / "data" / "toy"
        self.loader = RawDataLoader(self.toy_dir)

    def test_row_counts(self):
        n_accounts, n_txns = self.loader.count_rows()
        self.assertEqual(n_accounts, 10)
        self.assertEqual(n_txns, 30)

    def test_copy_commands_format(self):
        cmds = self.loader.get_copy_commands()
        self.assertEqual(len(cmds), 2)

        # Check accounts command
        acc_cmd = cmds[0]
        self.assertTrue(acc_cmd.startswith("\\copy accounts ("))
        self.assertIn("account_id", acc_cmd)
        self.assertIn("open_date", acc_cmd)
        self.assertIn("FORMAT csv, HEADER true, NULL ''", acc_cmd)
        self.assertIn("accounts.csv", acc_cmd)

        # Check transactions command
        txn_cmd = cmds[1]
        self.assertTrue(txn_cmd.startswith("\\copy transactions ("))
        self.assertIn("txn_id", txn_cmd)
        self.assertIn("amount", txn_cmd)
        self.assertIn("FORMAT csv, HEADER true, NULL ''", txn_cmd)
        self.assertIn("transactions.csv", txn_cmd)

    def test_dataset_registry_sql(self):
        sql = self.loader.get_dataset_registry_sql(10, 30)
        self.assertIn("INSERT INTO datasets", sql)
        self.assertIn("'toy'", sql)
        self.assertIn("is_active", sql)
        self.assertIn("ON CONFLICT (dataset_id) DO UPDATE SET", sql)
        self.assertIn("true", sql)

    def test_remove_injected_transactions_sql(self):
        sql = remove_injected_transactions("INJ_SIM_42")
        self.assertEqual(
            sql,
            "DELETE FROM transactions\nWHERE injection_id = 'INJ_SIM_42' AND is_injected = true;",
        )

    def test_insert_sql_generation(self):
        acc_sql = self.loader.get_accounts_insert_sql()
        self.assertIsNotNone(acc_sql)
        self.assertIn("INSERT INTO accounts", acc_sql)
        self.assertIn("'ACC_VIC_01'", acc_sql)

        txn_sql = self.loader.get_transactions_insert_sql()
        self.assertIsNotNone(txn_sql)
        self.assertIn("INSERT INTO transactions", txn_sql)
        self.assertIn("'TXN_TOY_001'", txn_sql)


class TestGroundTruthLoader(unittest.TestCase):
    def setUp(self):
        self.toy_dir = PROJECT_ROOT / "data" / "toy"
        self.loader = GroundTruthLoader(self.toy_dir)

    def test_gt_counts(self):
        counts = self.loader.count_rows()
        self.assertEqual(counts["gt_rings"], 1)
        self.assertEqual(counts["gt_accounts"], 10)
        self.assertEqual(counts["gt_transactions"], 30)

    def test_gt_copy_commands_order(self):
        cmds = self.loader.get_copy_commands()
        self.assertEqual(len(cmds), 3)

        # gt_rings must be loaded first
        self.assertIn("\\copy gt_rings", cmds[0])
        self.assertIn("\\copy gt_accounts", cmds[1])
        self.assertIn("\\copy gt_transactions", cmds[2])

    def test_gt_insert_sql_generation(self):
        r_sql = self.loader.get_gt_rings_insert_sql()
        self.assertIsNotNone(r_sql)
        self.assertIn("INSERT INTO gt_rings", r_sql)
        self.assertIn("'GT_RING_01'", r_sql)

        a_sql = self.loader.get_gt_accounts_insert_sql()
        self.assertIsNotNone(a_sql)
        self.assertIn("INSERT INTO gt_accounts", a_sql)

        t_sql = self.loader.get_gt_transactions_insert_sql()
        self.assertIsNotNone(t_sql)
        self.assertIn("INSERT INTO gt_transactions", t_sql)


class TestLoaderOrchestrator(unittest.TestCase):
    def setUp(self):
        self.toy_dir = PROJECT_ROOT / "data" / "toy"
        self.orchestrator = DatasetLoader(self.toy_dir, reset_active=True)

    def test_load_order_invariants(self):
        """
        Verify strict foreign-key dependency load order:
        gt_rings -> accounts -> gt_accounts -> transactions -> gt_transactions.
        """
        sql = self.orchestrator.generate_unified_sql()

        self.assertIn("BEGIN;", sql)
        self.assertIn("SELECT fn_reset_active_dataset();", sql)

        pos_reset = sql.find("SELECT fn_reset_active_dataset();")
        pos_gt_rings = sql.find("\\copy gt_rings")
        pos_accounts = sql.find("\\copy accounts")
        pos_gt_accounts = sql.find("\\copy gt_accounts")
        pos_transactions = sql.find("\\copy transactions")
        pos_gt_transactions = sql.find("\\copy gt_transactions")
        pos_datasets = sql.find("INSERT INTO datasets")
        pos_commit = sql.find("COMMIT;")

        # Invariant 1: Reset runs before any COPY
        self.assertLess(pos_reset, pos_gt_rings)
        # Invariant 2: gt_rings loads before gt_accounts
        self.assertLess(pos_gt_rings, pos_gt_accounts)
        # Invariant 3: accounts loads before gt_accounts and transactions
        self.assertLess(pos_accounts, pos_gt_accounts)
        self.assertLess(pos_accounts, pos_transactions)
        # Invariant 4: gt_accounts loads before transactions / gt_transactions
        self.assertLess(pos_gt_accounts, pos_transactions)
        # Invariant 5: transactions loads before gt_transactions
        self.assertLess(pos_transactions, pos_gt_transactions)
        # Invariant 6: datasets registry updates before COMMIT
        self.assertLess(pos_gt_transactions, pos_datasets)
        self.assertLess(pos_datasets, pos_commit)

    def test_raw_only_mode(self):
        loader = DatasetLoader(self.toy_dir, load_raw=True, load_gt=False)
        sql = loader.generate_unified_sql()

        self.assertIn("\\copy accounts", sql)
        self.assertIn("\\copy transactions", sql)
        self.assertNotIn("\\copy gt_rings", sql)
        self.assertNotIn("\\copy gt_accounts", sql)
        self.assertNotIn("\\copy gt_transactions", sql)

    def test_gt_only_mode(self):
        loader = DatasetLoader(self.toy_dir, load_raw=False, load_gt=True)
        sql = loader.generate_unified_sql()

        self.assertNotIn("\\copy accounts", sql)
        self.assertNotIn("\\copy transactions", sql)
        self.assertIn("\\copy gt_rings", sql)
        self.assertIn("\\copy gt_accounts", sql)
        self.assertIn("\\copy gt_transactions", sql)

    def test_insert_format_mode(self):
        loader = DatasetLoader(self.toy_dir, use_copy=False)
        sql = loader.generate_unified_sql()

        self.assertIn("INSERT INTO gt_rings", sql)
        self.assertIn("INSERT INTO accounts", sql)
        self.assertIn("INSERT INTO gt_accounts", sql)
        self.assertIn("INSERT INTO transactions", sql)
        self.assertIn("INSERT INTO gt_transactions", sql)
        self.assertNotIn("\\copy", sql)


class TestLoaderCLI(unittest.TestCase):
    def test_cli_validate_only_toy(self):
        proc = subprocess.run(
            [sys.executable, "-m", "backend.loader", "--dataset", "toy", "--validate-only"],
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 0)
        self.assertIn("PASSED [CLEAN]", proc.stdout)

    def test_cli_validate_only_broken(self):
        proc = subprocess.run(
            [sys.executable, "-m", "backend.loader", "--dataset", "broken", "--validate-only"],
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 1)
        self.assertIn("FAILED [ERRORS DETECTED]", proc.stdout)

    def test_cli_dry_run_toy(self):
        proc = subprocess.run(
            [sys.executable, "-m", "backend.loader", "--dataset", "toy", "--dry-run"],
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 0)
        self.assertIn("DRY RUN: Generated SQL Transaction Script", proc.stdout)
        self.assertIn("SELECT fn_reset_active_dataset();", proc.stdout)

    def test_cli_broken_aborts_before_dry_run(self):
        proc = subprocess.run(
            [sys.executable, "-m", "backend.loader", "--dataset", "broken", "--dry-run"],
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 1)
        self.assertIn("Pre-load validation FAILED! Transaction aborted before writing.", proc.stdout)


if __name__ == "__main__":
    unittest.main()
