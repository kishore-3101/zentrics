"""Ground-Truth Evaluation Module for TraceMesh.

Evaluates unsupervised graph detection and clustering outputs against ground-truth labels
in a strictly decoupled post-detection stage, ensuring zero data leakage.

Calculates:
- Account-level detection performance (Precision, Recall, F1, FPR)
- Ring-member detection performance
- Ring topology cluster matching (Jaccard similarity)
- Per-detector precision and alert breakdown
- Role-classification alignment with ground-truth forensic roles
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set, Tuple
import pandas as pd

from shared.models import Hit, RingCandidate


class GroundTruthEvaluator:
    """Evaluates detection outputs against ground truth with strict data leakage isolation."""

    def __init__(
        self,
        accounts_df: pd.DataFrame,
        transactions_df: pd.DataFrame,
        fraud_rings_df: Optional[pd.DataFrame] = None,
    ):
        self.accounts_df = accounts_df
        self.txns_df = transactions_df
        self.fraud_rings_df = fraud_rings_df

        # Ground truth positive sets
        self.gt_mule_accounts: Set[str] = set()
        if "is_mule" in accounts_df.columns:
            self.gt_mule_accounts = set(accounts_df.loc[accounts_df["is_mule"] == 1, "account_id"].astype(str))
        elif fraud_rings_df is not None and "account_id" in fraud_rings_df.columns:
            self.gt_mule_accounts = set(fraud_rings_df["account_id"].astype(str))

        # Ground truth rings map: ring_id -> set of account_ids
        self.gt_rings: Dict[str, Set[str]] = {}
        self.gt_roles: Dict[str, str] = {}
        self.gt_entry_points: Set[str] = set()
        self.gt_exit_points: Set[str] = set()
        if fraud_rings_df is not None and not fraud_rings_df.empty:
            for _, row in fraud_rings_df.iterrows():
                r_id = str(row["ring_id"])
                a_id = str(row["account_id"])
                self.gt_rings.setdefault(r_id, set()).add(a_id)
                if "ring_role" in row and pd.notna(row["ring_role"]):
                    self.gt_roles[a_id] = str(row["ring_role"])
                if row.get("entry_point") == 1 or str(row.get("entry_point")) == "1":
                    self.gt_entry_points.add(a_id)
                if row.get("exit_point") == 1 or str(row.get("exit_point")) == "1":
                    self.gt_exit_points.add(a_id)

    def evaluate_accounts(
        self,
        account_scores: Dict[str, float],
        evaluated_accounts: Optional[Iterable[str]] = None,
        threshold: float = 0.30,
    ) -> Dict[str, Any]:
        """Evaluate binary classification performance at the account level.

        Evaluation Scope:
        If `evaluated_accounts` is None, evaluates across the full eligible account
        population from accounts.csv (e.g. all 30,000 accounts).
        Accounts not assigned a score by detectors receive a default score of 0.0.
        This ensures known negative accounts (is_mule == 0) are properly counted as
        True Negatives (TN) rather than being artificially excluded.
        """
        if evaluated_accounts is None:
            if "account_id" in self.accounts_df.columns:
                eval_accs = set(self.accounts_df["account_id"].astype(str))
            else:
                eval_accs = set(account_scores.keys()) | self.gt_mule_accounts
        else:
            eval_accs = set(evaluated_accounts)

        tp = fp = tn = fn = 0
        for acc in eval_accs:
            is_gt_positive = acc in self.gt_mule_accounts
            pred_score = account_scores.get(acc, 0.0)
            is_pred_positive = pred_score >= threshold

            if is_pred_positive and is_gt_positive:
                tp += 1
            elif is_pred_positive and not is_gt_positive:
                fp += 1
            elif not is_pred_positive and not is_gt_positive:
                tn += 1
            else:
                fn += 1

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0

        return {
            "evaluation_scope": f"Full population ({len(eval_accs):,} accounts)" if evaluated_accounts is None else f"Custom scope ({len(eval_accs):,} accounts)",
            "threshold": threshold,
            "total_evaluated": len(eval_accs),
            "true_positives": tp,
            "false_positives": fp,
            "true_negatives": tn,
            "false_negatives": fn,
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
            "false_positive_rate": round(fpr, 4),
        }

    def evaluate_ring_members(
        self,
        candidate_rings: List[RingCandidate],
        evaluated_accounts: Optional[Iterable[str]] = None,
    ) -> Dict[str, Any]:
        """Evaluate accuracy of detected ring members against ground-truth mule accounts."""
        predicted_members: Set[str] = set()
        for r in candidate_rings:
            predicted_members.update(r.member_account_ids)

        if evaluated_accounts is None:
            if "account_id" in self.accounts_df.columns:
                eval_set = set(self.accounts_df["account_id"].astype(str))
            else:
                eval_set = predicted_members | self.gt_mule_accounts
        else:
            eval_set = set(evaluated_accounts)

        tp = len(predicted_members & self.gt_mule_accounts)
        fp = len(predicted_members - self.gt_mule_accounts)
        fn = len((self.gt_mule_accounts & eval_set) - predicted_members)
        tn = len(eval_set - self.gt_mule_accounts - predicted_members)

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

        return {
            "predicted_ring_members_count": len(predicted_members),
            "ground_truth_mules_in_scope": len(self.gt_mule_accounts & eval_set),
            "true_positive_members": tp,
            "false_positive_members": fp,
            "true_negative_members": tn,
            "false_negative_members": fn,
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
        }

    def evaluate_ring_clustering(
        self,
        candidate_rings: List[RingCandidate],
        min_jaccard: float = 0.25,
    ) -> Dict[str, Any]:
        """Evaluate candidate ring clusters against ground-truth ring groups.
        
        Uses greedy 1-to-1 maximum-weight matching to prevent multiple candidate rings
        from inflating the count of unique ground-truth rings matched.
        """
        if not self.gt_rings or not candidate_rings:
            return {
                "candidate_rings": len(candidate_rings),
                "ground_truth_rings": len(self.gt_rings),
                "one_to_one_matched_rings": 0,
                "precision": 0.0,
                "recall": 0.0,
                "f1_score": 0.0,
                "mean_best_jaccard": 0.0,
                "matching_method": "Greedy 1-to-1 Jaccard assignment",
            }

        # 1. Compute pairwise Jaccard matches
        pairwise_matches: List[Tuple[float, int, str]] = []
        best_jaccards_per_cand: List[float] = []

        for i, cand in enumerate(candidate_rings):
            c_members = set(cand.member_account_ids)
            best_j = 0.0
            for gt_id, gt_members in self.gt_rings.items():
                inter = len(c_members & gt_members)
                union = len(c_members | gt_members)
                if union > 0:
                    j = inter / union
                    if j > best_j:
                        best_j = j
                    if j >= min_jaccard:
                        pairwise_matches.append((j, i, gt_id))
            best_jaccards_per_cand.append(best_j)

        # 2. Greedy 1-to-1 matching (prevents multiple candidate rings claiming same GT ring)
        pairwise_matches.sort(key=lambda x: x[0], reverse=True)
        assigned_cands: Set[int] = set()
        assigned_gt: Set[str] = set()
        matched_1to1_pairs: List[Tuple[int, str, float]] = []

        for j, c_idx, gt_id in pairwise_matches:
            if c_idx not in assigned_cands and gt_id not in assigned_gt:
                assigned_cands.add(c_idx)
                assigned_gt.add(gt_id)
                matched_1to1_pairs.append((c_idx, gt_id, j))

        one_to_one_count = len(matched_1to1_pairs)
        prec_1to1 = one_to_one_count / len(candidate_rings) if candidate_rings else 0.0
        rec_1to1 = one_to_one_count / len(self.gt_rings) if self.gt_rings else 0.0
        f1_1to1 = (2 * prec_1to1 * rec_1to1) / (prec_1to1 + rec_1to1) if (prec_1to1 + rec_1to1) > 0 else 0.0
        mean_jaccard = sum(best_jaccards_per_cand) / len(best_jaccards_per_cand) if best_jaccards_per_cand else 0.0

        unconstrained_cands = sum(1 for j in best_jaccards_per_cand if j >= min_jaccard)
        unconstrained_unique_gt = len({gt_id for _, _, gt_id in pairwise_matches})

        return {
            "candidate_rings_count": len(candidate_rings),
            "ground_truth_rings_count": len(self.gt_rings),
            "min_jaccard_threshold": min_jaccard,
            "one_to_one_matched_rings": one_to_one_count,
            "matched_candidate_rings": one_to_one_count,
            "matched_ground_truth_rings": len(assigned_gt),
            "ring_precision": round(prec_1to1, 4),
            "ring_recall": round(rec_1to1, 4),
            "ring_f1": round(f1_1to1, 4),
            "mean_best_jaccard": round(mean_jaccard, 4),
            "unconstrained_matched_candidates": unconstrained_cands,
            "unconstrained_unique_gt_covered": unconstrained_unique_gt,
            "matching_method": "Greedy one-to-one bipartite matching on Jaccard similarity",
            "jaccard_limitations_doc": (
                "Jaccard similarity measures member set overlap. Limitations: "
                "(1) Shared mule accounts bridging multiple operational rings cause community clustering "
                "to partition differently than synthetic ground-truth boundaries; "
                "(2) One-to-one matching penalizes fragmented ring detections where sub-clusters each contain part of a ground-truth ring; "
                "(3) Asymmetric rings with large fan-in/fan-out perimeters yield lower Jaccard despite capturing core mule routes."
            ),
        }

    def evaluate_detectors(self, hits: List[Hit]) -> Dict[str, Any]:
        """Evaluate alert precision and coverage for each individual detector."""
        per_detector: Dict[str, Dict[str, Any]] = {}

        hits_by_code: Dict[str, List[Hit]] = {}
        for h in hits:
            hits_by_code.setdefault(h.code, []).append(h)

        for code, code_hits in hits_by_code.items():
            alerted_accs = {h.account_id for h in code_hits}
            tp = len(alerted_accs & self.gt_mule_accounts)
            fp = len(alerted_accs - self.gt_mule_accounts)
            prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            per_detector[code] = {
                "hits_count": len(code_hits),
                "unique_alerted_accounts": len(alerted_accs),
                "confirmed_mules": tp,
                "precision": round(prec, 4),
            }

        return per_detector

    def evaluate_role_classification(
        self,
        candidate_rings: List[RingCandidate],
    ) -> Dict[str, Any]:
        """Evaluate role classification alignment for accounts with ground-truth ring roles."""
        role_alignment = {
            "total_mapped_accounts": 0,
            "exact_or_compatible_matches": 0,
            "role_pairs": [],
        }

        # Compatible role mapping table:
        # Candidate roles: source, victim, collector, intermediary, mule, cash_out
        # Ground-truth roles: Controller, Collector, Distributor, Pass-through, Other
        compatible_map = {
            "collector": {"Collector", "Controller", "Distributor"},
            "source": {"Controller", "Distributor", "Other"},
            "victim": {"Other", "Distributor"},
            "intermediary": {"Pass-through", "Collector"},
            "mule": {"Pass-through", "Other"},
            "cash_out": {"Other", "Collector"},
        }

        for r in candidate_rings:
            for acc, pred_role in r.roles.items():
                if acc in self.gt_roles:
                    gt_role = self.gt_roles[acc]
                    role_alignment["total_mapped_accounts"] += 1
                    is_compatible = (
                        gt_role in compatible_map.get(pred_role, set())
                        or (pred_role in ["victim", "source", "collector"] and acc in self.gt_entry_points)
                        or (pred_role in ["cash_out"] and acc in self.gt_exit_points)
                    )
                    if is_compatible:
                        role_alignment["exact_or_compatible_matches"] += 1
                    role_alignment["role_pairs"].append((acc, pred_role, gt_role, is_compatible))

        total = role_alignment["total_mapped_accounts"]
        matches = role_alignment["exact_or_compatible_matches"]
        acc_rate = matches / total if total > 0 else 0.0

        return {
            "evaluated_role_accounts": total,
            "compatible_matches": matches,
            "role_compatibility_rate": round(acc_rate, 4),
        }

    def generate_full_evaluation_report(
        self,
        account_scores: Dict[str, float],
        hits: List[Hit],
        candidate_rings: List[RingCandidate],
        evaluated_accounts: Optional[Iterable[str]] = None,
        threshold: float = 0.30,
    ) -> Dict[str, Any]:
        """Generate complete multi-dimensional evaluation report."""
        return {
            "account_level": self.evaluate_accounts(account_scores, evaluated_accounts=evaluated_accounts, threshold=threshold),
            "ring_members": self.evaluate_ring_members(candidate_rings, evaluated_accounts=evaluated_accounts),
            "ring_clustering": self.evaluate_ring_clustering(candidate_rings),
            "per_detector": self.evaluate_detectors(hits),
            "role_classification": self.evaluate_role_classification(candidate_rings),
            "evaluation_metadata": {
                "ground_truth_isolation": "Strict: Zero labels used in graph builder, detectors, scores, or rings.",
                "positive_label_definition": "Accounts with is_mule == 1 or listed in fraud_rings.csv.",
                "negative_label_definition": "Accounts with is_mule == 0 and not in fraud_rings.csv.",
                "matching_rules": "Exact account ID matching; Jaccard overlap on ring members; compatibility matrix on forensic roles.",
                "limitations": "Ground truth is synthetic or historical sample; undetected real-world fraud may be mislabeled as False Positives.",
            }
        }
