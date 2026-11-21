"""
TraceMesh Case Linking Engine (Module 11 Deliverable 2)
=======================================================
Implements Jaccard set-overlap case deduplication and tracking across pipeline runs.

When a pipeline run detects a candidate mule ring:
1. Computes the SHA1 fingerprint from sorted member account IDs.
2. Calculates Jaccard similarity (|A ∩ B| / |A ∪ B|) against active cases in `cases`.
3. If Jaccard similarity >= 0.60:
   - Links the ring to the existing case.
   - Appends the new fingerprint to `case_fingerprints`.
   - Updates `cases.last_seen_run_id` and refreshes priority if higher.
4. If Jaccard similarity < 0.60:
   - Creates a new case in `cases` with status = 'new'.
   - Records the fingerprint in `case_fingerprints`.
   - Sets `first_seen_run_id` and `last_seen_run_id`.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple


def compute_fingerprint(member_account_ids: Iterable[str]) -> str:
    """
    Computes deterministic 16-character SHA1 fingerprint from sorted member account IDs.
    """
    sorted_ids = sorted(str(acct).strip() for acct in member_account_ids if str(acct).strip())
    raw_key = ",".join(sorted_ids)
    return hashlib.sha1(raw_key.encode("utf-8")).hexdigest()[:16]


def jaccard_similarity(set_a: Set[str], set_b: Set[str]) -> float:
    """Computes Jaccard index: |A ∩ B| / |A ∪ B|."""
    if not set_a and not set_b:
        return 1.0
    union_len = len(set_a | set_b)
    if union_len == 0:
        return 0.0
    return len(set_a & set_b) / union_len


@dataclass
class CaseRecord:
    case_id: int
    status: str = "new"
    priority: float = 0.0
    assigned_to: Optional[str] = None
    notes: Optional[str] = None
    first_seen_run_id: Optional[int] = None
    last_seen_run_id: Optional[int] = None
    member_accounts: Set[str] = field(default_factory=set)
    fingerprints: Set[str] = field(default_factory=set)


class CaseLinkingEngine:
    """
    Manages cross-run case continuity and deduplication using Jaccard membership overlap.
    """

    SIMILARITY_THRESHOLD = 0.60

    def __init__(self, existing_cases: Optional[List[CaseRecord]] = None):
        self.cases: Dict[int, CaseRecord] = {}
        self.next_case_id: int = 1

        if existing_cases:
            for c in existing_cases:
                self.cases[c.case_id] = c
                if c.case_id >= self.next_case_id:
                    self.next_case_id = c.case_id + 1

    def find_best_matching_case(
        self, member_accounts: Set[str]
    ) -> Tuple[Optional[CaseRecord], float]:
        """
        Scans existing cases to find the one with highest Jaccard similarity.
        Returns (best_case, max_similarity).
        """
        best_case = None
        best_sim = 0.0

        for case in self.cases.values():
            sim = jaccard_similarity(member_accounts, case.member_accounts)
            if sim > best_sim:
                best_sim = sim
                best_case = case

        return best_case, best_sim

    def link_ring(
        self,
        ring_id: str,
        member_accounts: Iterable[str],
        run_id: int,
        priority: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Links a detected ring to an existing case or creates a new case.

        Returns:
            dict containing:
                - case_id: int
                - is_new_case: bool
                - jaccard_score: float
                - fingerprint: str
                - status: str
        """
        members = set(str(a).strip() for a in member_accounts if str(a).strip())
        fp = compute_fingerprint(members)

        best_case, best_sim = self.find_best_matching_case(members)

        if best_case is not None and best_sim >= self.SIMILARITY_THRESHOLD:
            # Link to existing case
            case_id = best_case.case_id
            best_case.fingerprints.add(fp)
            best_case.member_accounts.update(members)
            best_case.last_seen_run_id = run_id
            if priority > best_case.priority:
                best_case.priority = priority

            return {
                "case_id": case_id,
                "is_new_case": False,
                "jaccard_score": round(best_sim, 4),
                "fingerprint": fp,
                "status": best_case.status,
            }
        else:
            # Create a brand new case
            case_id = self.next_case_id
            self.next_case_id += 1

            new_case = CaseRecord(
                case_id=case_id,
                status="new",
                priority=priority,
                first_seen_run_id=run_id,
                last_seen_run_id=run_id,
                member_accounts=members,
                fingerprints={fp},
            )
            self.cases[case_id] = new_case

            return {
                "case_id": case_id,
                "is_new_case": True,
                "jaccard_score": round(best_sim, 4),
                "fingerprint": fp,
                "status": "new",
            }
