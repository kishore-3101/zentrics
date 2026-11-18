# TraceMesh Ground-Truth Evaluation Module

## Overview
This module provides a rigorous, separate, and decoupled evaluation framework to assess TraceMesh detection performance against ground-truth labels (`is_mule`, `is_fraud`, `fraud_rings.csv`).

## Data-Leakage Protection Rule
**Crucial Requirement**: Ground-truth labels are **NEVER** used during graph construction (Module 6), detector execution (Module 6), rule risk scoring (Module 6), or community ring clustering (Module 7).
Labels are ingested **only** by `GroundTruthEvaluator` during the post-detection evaluation phase.

## Metrics Evaluated
1. **Account-Level Detection**:
   - True Positives (TP), False Positives (FP), True Negatives (TN), False Negatives (FN).
   - Precision: $\frac{TP}{TP + FP}$
   - Recall: $\frac{TP}{TP + FN}$
   - F1-Score: $\frac{2 \cdot P \cdot R}{P + R}$
   - False-Positive Rate (FPR): $\frac{FP}{FP + TN}$
2. **Ring-Member Detection**:
   - Precision, Recall, and F1-score of detected ring members vs ground-truth mule accounts.
3. **Ring Cluster Topology (Jaccard Match)**:
   - Evaluates community overlap:
     $$J(R_{\text{cand}}, R_{\text{gt}}) = \frac{|R_{\text{cand}} \cap R_{\text{gt}}|}{|R_{\text{cand}} \cup R_{\text{gt}}|}$$
4. **Per-Detector Alert Breakdown**:
   - Number of hits, unique alerted accounts, and precision for each of the 6 rule detectors.
5. **Role-Classification Compatibility**:
   - Compares assigned compliance roles (`victim`, `collector`, `mule`, `intermediary`, `cash_out`) against bank forensic roles (`Controller`, `Collector`, `Distributor`, `Pass-through`, `Other`).

## Usage Example
```python
from evaluation import GroundTruthEvaluator

evaluator = GroundTruthEvaluator(accounts_df, txns_df, fraud_rings_df)
report = evaluator.generate_full_evaluation_report(scores, hits, rings, threshold=0.30)

print("Account Precision:", report["account_level"]["precision"])
print("Account Recall:   ", report["account_level"]["recall"])
print("Account F1-Score: ", report["account_level"]["f1_score"])
print("Ring Precision:   ", report["ring_clustering"]["ring_precision"])
```
