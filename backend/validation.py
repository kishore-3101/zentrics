"""
Dataset Validation Engine (Module 5 Deliverable 2)
==================================================
Performs exhaustive pre-load validation on any synthetic or benchmark dataset folder.
Verifies all checks specified in datasetguide.md Section 10 and new_schema.sql.
Zero external dependencies (uses standard library csv, json, datetime, pathlib).
"""

from __future__ import annotations

import csv
import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

# -----------------------------------------------------------------------------
# Canonical Value Lists & Constraints (from datasetguide.md & new_schema.sql)
# -----------------------------------------------------------------------------
ALLOWED_KYC_LEVELS = {"minimal", "full", ""}
ALLOWED_ACCOUNT_TYPES = {"savings", "current", "wallet", "sink"}
ALLOWED_CHANNELS = {"UPI", "IMPS", "NEFT", "ATM_WITHDRAWAL"}
ALLOWED_INCOME_BANDS = {"low", "lower_mid", "mid", "upper_mid", "high", ""}
ALLOWED_ROLES = {"normal", "hard_negative", "suspicious_unlabeled", "victim", "collector", "mule", "cash_out"}
ALLOWED_RING_TYPES = {"fan_in_fan_out", "layering_chain", "circular_flow", "pass_through_hub", "dormant_active"}
ALLOWED_DIFFICULTIES = {"easy", "medium", "hard"}
ALLOWED_DATASET_ROLES = {"toy", "sample", "train", "val", "test", "test_hard", "demo", "stress"}

REQUIRED_COLUMNS = {
    "accounts.csv": ["account_id", "open_date", "kyc_level", "account_type", "city_cluster", "declared_income_band", "bank_id"],
    "transactions.csv": ["txn_id", "ts", "src_account", "dst_account", "amount", "channel", "is_injected", "injection_id"],
    "gt_rings.csv": ["gt_ring_id", "ring_type", "difficulty", "n_accounts", "n_victims", "first_inflow_ts", "last_outflow_ts", "amount_total", "params_json"],
    "gt_accounts.csv": ["account_id", "true_is_mule", "train_label", "gt_ring_id", "role", "scenario"],
    "gt_transactions.csv": ["txn_id", "is_fraud_related", "gt_ring_id"],
}


@dataclass
class ValidationReport:
    dataset_name: str
    folder_path: str
    is_valid: bool = True
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    stats: Dict[str, Any] = field(default_factory=dict)

    def add_error(self, message: str):
        self.is_valid = False
        self.errors.append(message)

    def add_warning(self, message: str):
        self.warnings.append(message)

    def print_report(self):
        print("=" * 70)
        print(f" DATASET VALIDATION REPORT: {self.dataset_name}")
        print(f" Location: {self.folder_path}")
        status_text = "PASSED [CLEAN]" if self.is_valid else "FAILED [ERRORS DETECTED]"
        print(f" Status:   {status_text}")
        print("=" * 70)

        if self.stats:
            print("\nDataset Statistics:")
            for k, v in self.stats.items():
                print(f"  - {k:<25}: {v}")

        if self.errors:
            print(f"\nErrors ({len(self.errors)}):")
            for idx, err in enumerate(self.errors, 1):
                print(f"  [{idx}] ERROR: {err}")

        if self.warnings:
            print(f"\nWarnings ({len(self.warnings)}):")
            for idx, warn in enumerate(self.warnings, 1):
                print(f"  [{idx}] WARN:  {warn}")

        print("=" * 70)


class DatasetValidator:
    def __init__(self, dataset_path: str | Path):
        self.path = Path(dataset_path).resolve()
        self.name = self.path.name
        self.report = ValidationReport(dataset_name=self.name, folder_path=str(self.path))

    def validate(self) -> ValidationReport:
        if not self.path.exists() or not self.path.is_dir():
            self.report.add_error(f"Dataset directory does not exist: {self.path}")
            return self.report

        # 1. Check required files
        for fname in REQUIRED_COLUMNS.keys():
            if not (self.path / fname).exists():
                self.report.add_error(f"Missing required file: {fname}")

        config_file = self.path / "config.json"
        if not config_file.exists():
            self.report.add_warning("Missing config.json; dataset metadata cannot be fully registered.")
        else:
            self._validate_config(config_file)

        if not self.report.is_valid:
            return self.report

        # 2. Validate accounts.csv
        account_ids, sink_ids = self._validate_accounts()

        # 3. Validate gt_rings.csv
        ring_ids = self._validate_gt_rings()

        # 4. Validate gt_accounts.csv
        self._validate_gt_accounts(account_ids, ring_ids, sink_ids)

        # 5. Validate transactions.csv
        txn_ids = self._validate_transactions(account_ids)

        # 6. Validate gt_transactions.csv
        self._validate_gt_transactions(txn_ids, ring_ids)

        return self.report

    def _validate_config(self, config_path: Path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            role = cfg.get("role")
            if role and role not in ALLOWED_DATASET_ROLES:
                self.report.add_error(f"config.json 'role' must be in {ALLOWED_DATASET_ROLES}, got '{role}'")
            self.report.stats["Config Seed"] = cfg.get("seed")
            self.report.stats["Dataset Role"] = role or "unknown"
        except Exception as e:
            self.report.add_error(f"config.json is not valid JSON: {e}")

    def _validate_accounts(self) -> Tuple[Set[str], Set[str]]:
        account_ids: Set[str] = set()
        sink_ids: Set[str] = set()
        file_path = self.path / "accounts.csv"

        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            headers = next(reader, None)
            if headers != REQUIRED_COLUMNS["accounts.csv"]:
                self.report.add_error(f"accounts.csv headers mismatch. Expected {REQUIRED_COLUMNS['accounts.csv']}, got {headers}")
                return account_ids, sink_ids

            row_num = 1
            for row in reader:
                row_num += 1
                if len(row) != len(REQUIRED_COLUMNS["accounts.csv"]):
                    self.report.add_error(f"accounts.csv line {row_num}: Expected {len(REQUIRED_COLUMNS['accounts.csv'])} columns, got {len(row)}")
                    continue

                aid, open_date, kyc, acct_type, city, income, bank = row
                aid = aid.strip()
                if not aid:
                    self.report.add_error(f"accounts.csv line {row_num}: Empty account_id")
                    continue

                if aid in account_ids:
                    self.report.add_error(f"accounts.csv line {row_num}: Duplicate account_id '{aid}'")
                account_ids.add(aid)

                # Validate open_date (YYYY-MM-DD)
                try:
                    datetime.strptime(open_date.strip(), "%Y-%m-%d")
                except ValueError:
                    self.report.add_error(f"accounts.csv line {row_num}: Invalid date format '{open_date}', expected YYYY-MM-DD")

                # Validate KYC level
                if kyc.strip() not in ALLOWED_KYC_LEVELS:
                    self.report.add_error(f"accounts.csv line {row_num}: Invalid kyc_level '{kyc}'. Must be in {ALLOWED_KYC_LEVELS}")

                # Validate account_type
                if acct_type.strip() not in ALLOWED_ACCOUNT_TYPES:
                    self.report.add_error(f"accounts.csv line {row_num}: Invalid account_type '{acct_type}'. Must be in {ALLOWED_ACCOUNT_TYPES}")

                if acct_type.strip() == "sink":
                    sink_ids.add(aid)

                # Validate income band
                if income.strip() not in ALLOWED_INCOME_BANDS:
                    self.report.add_error(f"accounts.csv line {row_num}: Invalid declared_income_band '{income}'. Must be in {ALLOWED_INCOME_BANDS}")

        self.report.stats["Total Accounts"] = len(account_ids)
        self.report.stats["Sink Accounts"] = len(sink_ids)
        return account_ids, sink_ids

    def _validate_gt_rings(self) -> Set[str]:
        ring_ids: Set[str] = set()
        file_path = self.path / "gt_rings.csv"

        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            headers = next(reader, None)
            if headers != REQUIRED_COLUMNS["gt_rings.csv"]:
                self.report.add_error(f"gt_rings.csv headers mismatch. Expected {REQUIRED_COLUMNS['gt_rings.csv']}, got {headers}")
                return ring_ids

            row_num = 1
            for row in reader:
                row_num += 1
                if len(row) != len(REQUIRED_COLUMNS["gt_rings.csv"]):
                    self.report.add_error(f"gt_rings.csv line {row_num}: Expected {len(REQUIRED_COLUMNS['gt_rings.csv'])} columns, got {len(row)}")
                    continue

                rid, rtype, diff, n_acc, n_vic, first_in, last_out, amt_tot, params = row
                rid = rid.strip()
                if not rid:
                    self.report.add_error(f"gt_rings.csv line {row_num}: Empty gt_ring_id")
                    continue

                if rid in ring_ids:
                    self.report.add_error(f"gt_rings.csv line {row_num}: Duplicate gt_ring_id '{rid}'")
                ring_ids.add(rid)

                if rtype.strip() not in ALLOWED_RING_TYPES:
                    self.report.add_error(f"gt_rings.csv line {row_num}: Invalid ring_type '{rtype}'. Must be in {ALLOWED_RING_TYPES}")

                if diff.strip() not in ALLOWED_DIFFICULTIES:
                    self.report.add_error(f"gt_rings.csv line {row_num}: Invalid difficulty '{diff}'. Must be in {ALLOWED_DIFFICULTIES}")

                try:
                    if int(n_acc) <= 0:
                        self.report.add_error(f"gt_rings.csv line {row_num}: n_accounts must be positive integer")
                except ValueError:
                    self.report.add_error(f"gt_rings.csv line {row_num}: n_accounts must be integer")

                try:
                    if float(amt_tot) <= 0:
                        self.report.add_error(f"gt_rings.csv line {row_num}: amount_total must be > 0")
                except ValueError:
                    self.report.add_error(f"gt_rings.csv line {row_num}: amount_total must be numeric")

        self.report.stats["Planted Rings"] = len(ring_ids)
        return ring_ids

    def _validate_gt_accounts(self, account_ids: Set[str], ring_ids: Set[str], sink_ids: Set[str]):
        file_path = self.path / "gt_accounts.csv"
        seen_gt_accounts: Set[str] = set()
        mule_count = 0

        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            headers = next(reader, None)
            if headers != REQUIRED_COLUMNS["gt_accounts.csv"]:
                self.report.add_error(f"gt_accounts.csv headers mismatch. Expected {REQUIRED_COLUMNS['gt_accounts.csv']}, got {headers}")
                return

            row_num = 1
            for row in reader:
                row_num += 1
                if len(row) != len(REQUIRED_COLUMNS["gt_accounts.csv"]):
                    self.report.add_error(f"gt_accounts.csv line {row_num}: Expected {len(REQUIRED_COLUMNS['gt_accounts.csv'])} columns, got {len(row)}")
                    continue

                aid, is_mule, train_label, rid, role, scenario = [x.strip() for x in row]
                if aid not in account_ids:
                    self.report.add_error(f"gt_accounts.csv line {row_num}: Foreign key violation - account_id '{aid}' does not exist in accounts.csv")

                if aid in seen_gt_accounts:
                    self.report.add_error(f"gt_accounts.csv line {row_num}: Duplicate account_id '{aid}' in gt_accounts")
                seen_gt_accounts.add(aid)

                if rid and rid not in ring_ids:
                    self.report.add_error(f"gt_accounts.csv line {row_num}: Foreign key violation - gt_ring_id '{rid}' does not exist in gt_rings.csv")

                if role not in ALLOWED_ROLES:
                    self.report.add_error(f"gt_accounts.csv line {row_num}: Invalid role '{role}'. Must be in {ALLOWED_ROLES}")

                # Consistency check: mules must have true_is_mule = true
                is_mule_bool = is_mule.lower() == "true"
                if role in {"collector", "mule", "cash_out"}:
                    mule_count += 1
                    if not is_mule_bool:
                        self.report.add_error(f"gt_accounts.csv line {row_num}: Account '{aid}' has role '{role}' but true_is_mule is false!")

                # Consistency check: victims must NOT have true_is_mule = true
                if role == "victim" and is_mule_bool:
                    self.report.add_error(f"gt_accounts.csv line {row_num}: Victim account '{aid}' cannot have true_is_mule = true!")

                # Consistency check: sinks must NOT have true_is_mule = true
                if aid in sink_ids and is_mule_bool:
                    self.report.add_error(f"gt_accounts.csv line {row_num}: Sink account '{aid}' cannot be marked true_is_mule = true!")

        missing_accounts = account_ids - seen_gt_accounts
        if missing_accounts:
            self.report.add_error(f"gt_accounts.csv is incomplete: {len(missing_accounts)} accounts from accounts.csv have no GT entry.")

        self.report.stats["True Mules"] = mule_count

    def _validate_transactions(self, account_ids: Set[str]) -> Set[str]:
        txn_ids: Set[str] = set()
        file_path = self.path / "transactions.csv"
        prev_ts = None
        total_volume = 0.0

        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            headers = next(reader, None)
            if headers != REQUIRED_COLUMNS["transactions.csv"]:
                self.report.add_error(f"transactions.csv headers mismatch. Expected {REQUIRED_COLUMNS['transactions.csv']}, got {headers}")
                return txn_ids

            row_num = 1
            for row in reader:
                row_num += 1
                if len(row) != len(REQUIRED_COLUMNS["transactions.csv"]):
                    self.report.add_error(f"transactions.csv line {row_num}: Expected {len(REQUIRED_COLUMNS['transactions.csv'])} columns, got {len(row)}")
                    continue

                txnid, ts_str, src, dst, amt_str, channel, injected, inj_id = [x.strip() for x in row]
                if not txnid:
                    self.report.add_error(f"transactions.csv line {row_num}: Empty txn_id")
                    continue

                if txnid in txn_ids:
                    self.report.add_error(f"transactions.csv line {row_num}: Duplicate txn_id '{txnid}'")
                txn_ids.add(txnid)

                # Foreign keys
                if src not in account_ids:
                    self.report.add_error(f"transactions.csv line {row_num}: src_account '{src}' does not exist in accounts.csv")
                if dst not in account_ids:
                    self.report.add_error(f"transactions.csv line {row_num}: dst_account '{dst}' does not exist in accounts.csv")

                # Constraint src != dst
                if src == dst:
                    self.report.add_error(f"transactions.csv line {row_num}: Self-transfer violation - src_account and dst_account are both '{src}'")

                # Amount check
                try:
                    amt = float(amt_str)
                    if amt <= 0:
                        self.report.add_error(f"transactions.csv line {row_num}: Amount must be positive, got {amt}")
                    total_volume += amt
                except ValueError:
                    self.report.add_error(f"transactions.csv line {row_num}: Invalid amount '{amt_str}'")

                # Channel check
                if channel not in ALLOWED_CHANNELS:
                    self.report.add_error(f"transactions.csv line {row_num}: Invalid channel '{channel}'. Must be in {ALLOWED_CHANNELS}")

                # Sorted timestamp check
                try:
                    cur_ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                    if prev_ts is not None and cur_ts < prev_ts:
                        self.report.add_error(f"transactions.csv line {row_num}: Timestamp out of order! '{ts_str}' is earlier than previous '{prev_ts.isoformat()}'")
                    prev_ts = cur_ts
                except Exception:
                    self.report.add_error(f"transactions.csv line {row_num}: Unparseable ISO-8601 timestamp '{ts_str}'")

        self.report.stats["Total Transactions"] = len(txn_ids)
        self.report.stats["Total Volume (INR)"] = f"₹{total_volume:,.2f}"
        return txn_ids

    def _validate_gt_transactions(self, txn_ids: Set[str], ring_ids: Set[str]):
        file_path = self.path / "gt_transactions.csv"
        seen_gt_txns: Set[str] = set()
        fraud_txns = 0

        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            headers = next(reader, None)
            if headers != REQUIRED_COLUMNS["gt_transactions.csv"]:
                self.report.add_error(f"gt_transactions.csv headers mismatch. Expected {REQUIRED_COLUMNS['gt_transactions.csv']}, got {headers}")
                return

            row_num = 1
            for row in reader:
                row_num += 1
                if len(row) != len(REQUIRED_COLUMNS["gt_transactions.csv"]):
                    self.report.add_error(f"gt_transactions.csv line {row_num}: Expected {len(REQUIRED_COLUMNS['gt_transactions.csv'])} columns, got {len(row)}")
                    continue

                txnid, is_fraud, rid = [x.strip() for x in row]
                if txnid not in txn_ids:
                    self.report.add_error(f"gt_transactions.csv line {row_num}: Foreign key violation - txn_id '{txnid}' does not exist in transactions.csv")

                if txnid in seen_gt_txns:
                    self.report.add_error(f"gt_transactions.csv line {row_num}: Duplicate txn_id '{txnid}' in gt_transactions")
                seen_gt_txns.add(txnid)

                if rid and rid not in ring_ids:
                    self.report.add_error(f"gt_transactions.csv line {row_num}: Foreign key violation - gt_ring_id '{rid}' does not exist in gt_rings.csv")

                if is_fraud.lower() == "true":
                    fraud_txns += 1
                    if not rid:
                        self.report.add_warning(f"gt_transactions.csv line {row_num}: Transaction '{txnid}' marked is_fraud_related=true but has no gt_ring_id")

        missing_txns = txn_ids - seen_gt_txns
        if missing_txns:
            self.report.add_error(f"gt_transactions.csv isIncomplete: {len(missing_txns)} transactions from transactions.csv have no GT entry.")

        self.report.stats["Fraud Transactions"] = fraud_txns


if __name__ == "__main__":
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else "data/toy"
    validator = DatasetValidator(target)
    rep = validator.validate()
    rep.print_report()
    sys.exit(0 if rep.is_valid else 1)
