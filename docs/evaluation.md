# TraceMesh Ground-Truth Evaluation Specification

## 1. Overview
The evaluation module provides decoupled, post-detection quantitative benchmarks against bank ground-truth datasets.
It assesses account-level binary classification, community ring cluster matching, individual detector precision, and forensic role classification.

## 2. Strict Data-Leakage Protection Rule
**Rule**: Ground-truth labels (`is_mule`, `is_fraud`, `ring_id`, `fraud_pattern`, `ring_role`) are **NEVER** accessed by:
- Graph construction (`build_graph`)
- Rule detectors (`run_detectors`)
- Rule risk scoring (`rule_scores`)
- Community detection and ring formation (`cluster_rings`)
- Streaming incremental engine (`IncrementalDetectorEngine`)

Labels are strictly loaded in the final evaluation stage by `GroundTruthEvaluator`.

## 3. Metric Formulations

### Account-Level Detection
- **True Positives (TP)**: Predicted mule accounts ($S_{\text{risk}} \ge 0.30$) that are ground-truth mules (`is_mule == 1`).
- **False Positives (FP)**: Predicted mule accounts that are legitimate (`is_mule == 0`).
- **False Negatives (FN)**: Ground-truth mules missed by the detector ($S_{\text{risk}} < 0.30$).
- **True Negatives (TN)**: Legitimate accounts correctly left unscored or scored below threshold.
- **Precision**: $\frac{TP}{TP + FP}$
- **Recall**: $\frac{TP}{TP + FN}$
- **F1-Score**: $\frac{2 \cdot \text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}$
- **False-Positive Rate (FPR)**: $\frac{FP}{FP + TN}$

### Ring Cluster Topology (Jaccard Match)
For each detected candidate ring $R_{\text{cand}}$ and ground-truth ring $R_{\text{gt}}$:
$$J(R_{\text{cand}}, R_{\text{gt}}) = \frac{|R_{\text{cand}} \cap R_{\text{gt}}|}{|R_{\text{cand}} \cup R_{\text{gt}}|}$$
A candidate ring is declared a topology match if $\max J \ge 0.25$.

### Role Classification Compatibility
Compares the compliance role output (`victim`, `collector`, `mule`, `cash_out`) with the ground-truth forensic role (`Controller`, `Collector`, `Distributor`, `Pass-through`, `Other`).

## 4. Evaluation Limitations
1. **Historical Ground-Truth Sparsity**: Undetected real-world money mules present in the unlabelled background may be penalized as False Positives.
2. **Temporal Window Boundaries**: Evaluating a 7-day batch window captures rings active during that window; rings that transact outside the window appear as False Negatives for the batch window.
