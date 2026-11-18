# TraceMesh Module 7: Community Detection and Ring Clustering

## Overview
Module 7 aggregates account risk scores, detector hits, and the transaction multigraph to identify, isolate, score, and rank coordinated mule-account network clusters (rings). It assigns forensic roles (`victim`, `collector`, `mule`, `cash_out`), calculates amounts at risk, and outputs ranked candidate rings with deterministic fingerprints.

---

## 1. Methodology Pipeline

```text
Account Scores + Detector Hits + MultiDiGraph
                      │
                      ▼
        Extract Suspicious Subgraph
  (Suspicious accounts + Hit edges + Boundary nodes)
                      │
                      ▼
     Topology Projection & Connected Components
                      │
                      ▼
        Shared-Mule Separation Check
   (Articulation Point Analysis on Shared Nodes)
                      │
                      ▼
    Candidate Ring Formation (>= 3 Accounts)
                      │
                      ▼
     Role Assignment (Victim, Collector, Mule, Cash-out)
                      │
                      ▼
     Amount Moved & Amount-at-Risk Calculation
                      │
                      ▼
      Ring Scoring (0-100) & Priority Ranking
```

---

## 2. Shared-Mule Separation Strategy

### Problem Statement
In coordinated money laundering operations, professional mule brokers frequently rent or share accounts across multiple syndicates. For example:
- **Ring A**: $A \to B \to C \to D$
- **Ring B**: $D \to E \to F \to G$

Blindly applying connected components or standard clustering algorithms would merge these two distinct rings into a single oversized 7-node ring.

### Algorithmic Solution
TraceMesh implements a graph-theoretic **balanced articulation point (cut vertex)** separation strategy:
1. For each connected component $C$ with $|C| \ge 2 \times \text{min\_ring\_size} - 1$, compute articulation points using DFS lowpoint numbers.
2. For each articulation point $m$, simulate removing $m$ to inspect the resulting disconnected subgraphs $K_1, K_2, \dots$.
3. When both $K_1 \cup \{m\}$ and $K_2 \cup \{m\}$ independently contain $\ge \text{min\_ring\_size}$ accounts ($\ge 3$), the clusters are separated into distinct candidate rings.
4. The shared mule $m$ is preserved as a member in both rings, assuming distinct roles appropriate to each ring's transaction direction (e.g. `cash_out` for Ring A and `collector` for Ring B).

---

## 3. Forensic Role Assignment Procedure

Each member of a detected ring is assigned one of four standard compliance roles:

| Role | Operational Definition | Graph Criteria |
|---|---|---|
| **victim** | External originator of illicit funds | $\text{in\_degree} = 0$, $\text{out\_degree} > 0$, account score $< 0.25$, no fraud hits |
| **collector** | Aggregates funds from victims or external senders | Receives from victims or external sources, distributes into the ring |
| **mule** | Intermediary transit account in chains/cycles | Both $\text{in\_degree} > 0$ and $\text{out\_degree} > 0$ within the ring |
| **cash_out** | Terminal destination or sink account | $\text{out\_degree} = 0$ within ring, or explicitly identified sink account |

---

## 4. Financial Calculations

- **Amount Moved**: Sum of all unique transaction amounts within the ring edge set.
- **Amount Cashed**: Sum of amounts transferred to known sink accounts or terminal cash-out accounts.
- **Amount at Risk**: Total external funds entering the ring from victims/external sources minus amounts already cashed out:
  $$\text{Amount at Risk} = \max(0.0, \text{External Inflow} - \text{Amount Cashed})$$
  This avoids double-counting funds moving repeatedly between intermediary mules.

---

## 5. Ring Scoring, Priority, and Recommended Actions

### Scoring Formula
$$\text{Ring Score} = 0.35 \times \mu_{\text{risk}} + 0.20 \times \max_{\text{risk}} + 0.15 \times S_{\text{amount}} + 0.15 \times S_{\text{speed}} + 0.15 \times S_{\text{pattern}}$$
- $\mu_{\text{risk}}$: Mean account risk across ring members ($0-100$).
- $\max_{\text{risk}}$: Maximum account risk in the ring ($0-100$).
- $S_{\text{amount}}$: Log-scaled amount moved factor ($0-100$).
- $S_{\text{speed}}$: Velocity bonus (faster transfers get higher urgency).
- $S_{\text{pattern}}$: Pattern diversity factor ($0-100$).

### Priority Metric
$$\text{Priority} = \text{Ring Score} \times \text{Amount at Risk}$$
Ensures analysts review high-velocity, high-exposure rings first.

### Recommended Actions
- **Score $\ge 80.0$**: `freeze_and_escalate`
- **Score $50.0 - 79.9$**: `watchlist_review`
- **Score $< 50.0$**: `monitor`

---

## 6. Output Contract (`RingCandidate`)

```python
@dataclass
class RingCandidate:
    ring_id: str
    member_account_ids: List[str]
    community_id: int
    roles: Dict[str, str]
    score: float
    priority: float
    amount_moved: float
    amount_cashed: float
    amount_at_risk: float
    first_inflow_ts: Optional[datetime]
    last_outflow_ts: Optional[datetime]
    ring_transactions: List[Dict[str, Any]]
    pattern_tags: List[str]
    ring_type: str
    detector_evidence: List[Dict[str, Any]]
    recommended_action: str
    fingerprint: str  # SHA-1 of sorted member account IDs
```
