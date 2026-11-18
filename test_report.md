# TraceMesh Test Execution and Benchmark Report

**Date of Execution**: November 17, 2026  
**Environment**: Windows 11, Python 3.12.10, NetworkX 3.7, Pandas 3.1.1, PyTest 9.2.0, Streamlit 1.67.0  
**Project Root**: `TraceMesh_Final`  
**Dataset Evaluated**: `accounts.csv` (30,000 accounts), `transactions.csv` (30,000 transactions, 25,704 successful), `account_daily_summary.csv` (30,000 summaries), `fraud_rings.csv` (3,243 rings).

---

## 1. Automated Test Suite Results

The comprehensive test suite contains **47 unit, edge-case, regression, and integration tests** spanning Module 6, Module 7, Module 12a, Ground-Truth Evaluation, and Visualization.

```text
============================= test session starts =============================
platform win32 -- Python 3.12.10, pytest-9.2.0, pluggy-1.7.0
rootdir: TraceMesh_Final
plugins: anyio-4.16.0
collected 47 items

tests/test_evaluation.py::test_ground_truth_evaluator_account_metrics PASSED [  2%]
tests/test_evaluation.py::test_ground_truth_evaluator_ring_clustering_jaccard PASSED [  4%]
tests/test_evaluation.py::test_ground_truth_isolation_data_leakage_safety PASSED [  6%]
tests/test_evaluation.py::test_evaluation_default_full_population_scope PASSED [  8%]
tests/test_evaluation.py::test_ring_clustering_one_to_one_matching_prevents_inflation PASSED [ 10%]
tests/test_integration.py::test_full_pipeline_batch_and_stream_integration PASSED [ 12%]
tests/test_module_12_incremental.py::test_sliding_window_transaction_lifecycle PASSED [ 14%]
tests/test_module_12_incremental.py::test_incremental_fan_in_burst_trigger PASSED [ 17%]
tests/test_module_12_incremental.py::test_incremental_rapid_pass_through_sequence PASSED [ 19%]
tests/test_module_12_incremental.py::test_incremental_circular_flow_trigger PASSED [ 21%]
tests/test_module_12_incremental.py::test_incremental_vs_batch_consistency PASSED [ 23%]
tests/test_module_12_incremental.py::test_incremental_duplicate_rejection_and_retention_policy PASSED [ 25%]
tests/test_module_12_incremental.py::test_incremental_out_of_order_transactions PASSED [ 27%]
tests/test_module_12_incremental.py::test_incremental_ring_expiration_and_reactivation_lifecycle PASSED [ 29%]
tests/test_module_12_incremental.py::test_incremental_high_volume_throughput_and_latency PASSED [ 31%]
tests/test_module_12_incremental.py::test_advance_time_without_new_transactions_full_ring_expiration PASSED [ 34%]
tests/test_module_12_incremental.py::test_partial_ring_expiration_and_score_reduction PASSED [ 36%]
tests/test_module_12_incremental.py::test_controlled_normal_stream_no_unjustified_alerts PASSED [ 38%]
tests/test_module_12_incremental.py::test_controlled_suspicious_stream_and_reactivation PASSED [ 40%]
tests/test_module_6_detectors.py::test_graph_builder_directed_multigraph_parallel PASSED [ 42%]
tests/test_module_6_detectors.py::test_graph_builder_window_filtering PASSED [ 44%]
tests/test_module_6_detectors.py::test_graph_builder_ground_truth_isolation PASSED [ 46%]
tests/test_module_6_detectors.py::test_graph_builder_validation_errors PASSED [ 48%]
tests/test_module_6_detectors.py::test_get_window_view PASSED            [ 51%]
tests/test_module_6_detectors.py::test_detector_fan_in_burst_positive_and_negative PASSED [ 53%]
tests/test_module_6_detectors.py::test_detector_fan_out_split_positive_and_negative PASSED [ 55%]
tests/test_module_6_detectors.py::test_detector_rapid_pass_through_positive_and_negative PASSED [ 57%]
tests/test_module_6_detectors.py::test_detector_layering_chain PASSED    [ 59%]
tests/test_module_6_detectors.py::test_detector_circular_flow PASSED     [ 61%]
tests/test_module_6_detectors.py::test_detector_dormant_activation PASSED [ 63%]
tests/test_module_6_detectors.py::test_rule_scores_normalization_and_saturation PASSED [ 65%]
tests/test_module_6_detectors.py::test_missing_values_and_nans PASSED    [ 68%]
tests/test_module_6_detectors.py::test_accounts_with_no_transactions PASSED [ 70%]
tests/test_module_6_detectors.py::test_hard_negatives_regular_merchant_flow PASSED [ 72%]
tests/test_module_6_detectors.py::test_dormant_activation_strict_calendar_continuity PASSED [ 74%]
tests/test_module_6_detectors.py::test_dormant_activation_coexistence_multi_account PASSED [ 76%]
tests/test_module_7_clustering.py::test_simple_three_account_ring PASSED [ 78%]
tests/test_module_7_clustering.py::test_shared_mule_ring_separation PASSED [ 80%]
tests/test_module_7_clustering.py::test_disconnected_suspicious_groups PASSED [ 82%]
tests/test_module_7_clustering.py::test_low_risk_accounts_filtered_out PASSED [ 85%]
tests/test_module_7_clustering.py::test_empty_graph_returns_empty_rings PASSED [ 87%]
tests/test_module_7_clustering.py::test_amount_at_risk_calculation_with_sinks PASSED [ 89%]
tests/test_module_7_clustering.py::test_clustering_determinism_under_node_permutations PASSED [ 91%]
tests/test_visualization.py::test_risk_and_role_colors PASSED            [ 93%]
tests/test_visualization.py::test_extract_filtered_subgraph PASSED       [ 95%]
tests/test_visualization.py::test_render_pyvis_network_html_generation PASSED [ 97%]
tests/test_visualization.py::test_plotly_chart_generators PASSED         [100%]

============================= 47 passed in 7.25s ==============================
```

---

## 2. Actual Dataset Pipeline Benchmark Execution

Pipeline execution command:
```bash
python run_pipeline.py
```

### Benchmark Metrics & Timing:
- **Evaluation Window**: 7-Day Window (`2026-08-16T07:16:28` to `2026-08-23T07:16:28`).
- **Graph Dimensions**: 30,000 nodes, 2,036 directed edges (0.357 s).
- **Rule Detectors**: 312 total suspicious hits across 6 detectors (18.457 s).
  - `dormant_active`: 169 hits (strict calendar-day continuity verified)
  - `fan_out_split`: 53 hits
  - `circular_flow`: 35 hits
  - `rapid_pass_through`: 33 hits
  - `layering_chain`: 18 hits
  - `fan_in_burst`: 4 hits
- **Rule Scoring**: 243 accounts scored, 12 high-risk accounts (0.003 s).
- **Community Ring Clustering**: 191 candidate rings detected (0.114 s).
  - Top Ring `RING_0001`: Score 67.15/100, Priority 42,867,454.71, Amount at Risk INR 638,383.54, Typology: circular_flow.
- **Incremental Streaming (Module 12a)**:
  - Production Stream Benchmark: 500 events in 0.461 s (Average latency: 0.91 ms / txn, p95: 1.61 ms / txn, 0 false alarms on normal traffic).
  - Controlled Lifecycle Verification: Circular ring injected (`new_alert`), duplicate replayed (`ignored_or_duplicate`), time advanced 90m (`alert_deactivated`), new cycle injected (`alert_reactivated`).

---

## 3. Decoupled Ground-Truth Evaluation Metrics

Executed in a strictly isolated post-detection evaluation stage without data leakage.

### Evaluation Scope:
By default, `evaluate_accounts()` evaluates across the **full eligible account population** (`30,000 accounts` from `accounts.csv`), ensuring that unscored accounts are accurately categorized as True Negatives (`TN`) rather than excluded.

| Evaluation Dimension | Metric | Value | Interpretation / Methodology |
| :--- | :--- | :--- | :--- |
| **Account-Level Detection** | Evaluation Population | **30,000 accounts** | Full population from `accounts.csv`. |
| | True Positives (TP) | 67 | Scored accounts ($\ge 0.30$) verified as `is_mule == 1`. |
| | False Positives (FP) | 37 | Scored accounts ($\ge 0.30$) with `is_mule == 0`. |
| | True Negatives (TN) | 25,402 | Unscored or low-risk accounts with `is_mule == 0`. |
| | False Negatives (FN) | 4,494 | Inactive or unobserved mules in the 7-day window. |
| | Alert Precision | **0.6442 (64.42%)** | $TP / (TP + FP)$ on alerted accounts. |
| | Recall | 0.0147 (1.47%) | $TP / (TP + FN)$ over all 4,561 mules in dataset. |
| | F1-Score | 0.0287 | Harmonic mean of precision and recall. |
| | False-Positive Rate (FPR) | **0.0015 (0.15%)** | $FP / (FP + TN)$ across all 25,439 non-mule accounts. |
| **Ring Member Detection** | Predicted Ring Members | 1,499 | Members of detected candidate rings. |
| | Confirmed Mules Identified | 355 | Ring members matching ground-truth mules. |
| | Member Precision | **0.2368 (23.68%)** | Proportion of ring members that are confirmed mules. |
| | Member Recall | 0.0778 (7.78%) | Ground-truth mules captured in candidate rings. |
| | Member F1-Score | 0.1172 | Harmonic mean of member precision and recall. |
| **Ring Cluster Matching** | Candidate Rings Evaluated | 191 | Detected communities with risk score $\ge 50$. |
| | Ground Truth Rings Active | 3,243 | Unique rings in `fraud_rings.csv`. |
| | Greedy 1-to-1 Matched Rings | **85 rings** | One-to-one bipartite matching ($\text{Jaccard} \ge 0.25$). |
| | Greedy 1-to-1 Ring Precision | **0.4450 (44.50%)** | Prevents multiple candidate rings from inflating matches. |
| | Mean Best Jaccard Similarity | 0.2082 | Average highest Jaccard across all candidates. |
| **Role Classification** | Evaluated Accounts with GT Roles | 397 | Accounts mapped to ground-truth forensic roles. |
| | Compatible Forensic Role Matches | **359 accounts** | Compatible with forensic taxonomy and entry/exit points. |
| | Role Compatibility Rate | **0.9043 (90.43%)** | Alignment with forensic role schema. |

---

## 4. Evaluation Methodology & Matching Rules

1. **Zero Data Leakage Isolation**:
   - `build_graph()` explicitly strips ground-truth columns (`is_mule`, `is_fraud`, `ring_id`, `ring_role`) from input DataFrames.
   - All detectors, rule scoring formulas, and graph clustering algorithms operate strictly unsupervised.
   - `GroundTruthEvaluator` runs as an isolated post-pipeline benchmark.

2. **Full Population Account Evaluation Scope**:
   - Rather than scoping evaluation only to accounts that received non-zero detector scores (which artificially inflates FPR by excluding true negatives), evaluation spans all 30,000 accounts.
   - Unscored accounts receive a score of $0.0$, properly evaluating the vast majority of legitimate bank accounts as True Negatives.

3. **Greedy One-to-One Bipartite Ring Matching**:
   - Pairwise Jaccard similarity is computed for all candidate and ground-truth ring pairs.
   - Candidate pairs with $\text{Jaccard} \ge 0.25$ are greedily assigned in descending order of similarity.
   - Each candidate ring is assigned to at most one ground-truth ring, and each ground-truth ring is claimed by at most one candidate ring, preventing multiple candidate sub-clusters from inflating ground-truth discovery rates.

4. **Forensic Role Compatibility Schema**:
   - Role compatibility is verified against both `ring_role` and `entry_point`/`exit_point` columns from `fraud_rings.csv`:
     - `victim`: compatible with `Other` (with `entry_point == 1`), `Distributor`, or `Other`.
     - `collector`: compatible with `Collector`, `Controller`, or `entry_point == 1`.
     - `mule`: compatible with `Pass-through`, `Other`, or `Distributor`.
     - `cash_out`: compatible with `exit_point == 1`, `Collector`, or `Other`.

---

## 5. Known Limitations

1. **Synthetic / Historical Dataset Ground Truth**:
   - In synthetic fraud datasets, inactive mules that performed no transactions during the evaluated 7-day window are labeled as ground-truth positives (`is_mule = 1`). Unsupervised graph detectors cannot detect accounts with zero transactional evidence during the window, naturally capping recall for narrow observation windows.
2. **Jaccard Similarity on Shared Mule Networks**:
   - When multiple ground-truth rings share a central mule or funnel into a common cash-out sink, community clustering algorithms may merge these rings or partition them along balanced articulation cuts. While forensically valid, this can yield partial Jaccard overlaps ($0.25 \le \text{Jaccard} < 0.70$) against strictly isolated synthetic ring definitions.
3. **Asymmetric Fan-In / Fan-Out Perimeters**:
   - Detection graphs include outer perimeter victims and recipient sinks that may not be enumerated in the core mule ring table, lowering set-overlap Jaccard while accurately capturing the end-to-end fund flow.

---

## 6. List of Files Modified

| File | Purpose of Modification |
| :--- | :--- |
| `module_12_incremental_sliding_window/incremental_engine.py` | Refactored `process_transaction()` and `advance_time()` to use a shared reconciliation engine (`_reconcile_state()`). Zeroes out scores and hits for degree-0 expired accounts, recalculates hits on remaining active subgraphs, deactivates dissolved rings even when neighborhood has zero active edges, and handles `new_alert`, `alert_updated`, `alert_deactivated`, and `alert_reactivated` transitions. |
| `module_6_graph_builder_detectors/detectors/dormant_activation.py` | Removed early return (`if hits: return hits`) in Path A. Enabled Path B fallback for all remaining eligible accounts to collect both confirmed dormancy and unconfirmed inactivity gaps without duplicates. Added degree pre-filtering to maintain sub-second performance on large graphs. |
| `evaluation/evaluator.py` | Updated `evaluate_accounts()` default scope to use the full eligible account population (30,000 accounts), calculating true negatives and realistic FPR (0.15%). Implemented greedy 1-to-1 bipartite ring matching to eliminate duplicate match inflation. Validated role compatibility against `entry_point` and `exit_point` schema. |
| `shared/models.py` | Added `__iter__` and `__len__` methods to `AlertEvent` for seamless backward compatibility between object access and iteration over affected accounts. |
| `run_pipeline.py` | Added controlled suspicious stream lifecycle demonstration (circular injection, duplicate replay rejection, advance-time deactivation, and reactivation) alongside the 500-event latency benchmark. |
| `tests/test_module_12_incremental.py` | Added 4 new regression tests: `test_advance_time_without_new_transactions_full_ring_expiration`, `test_partial_ring_expiration_and_score_reduction`, `test_controlled_normal_stream_no_unjustified_alerts`, and `test_controlled_suspicious_stream_and_reactivation`. |
| `tests/test_module_6_detectors.py` | Added `test_dormant_activation_coexistence_multi_account` verifying simultaneous collection of confirmed dormancy and unconfirmed gaps across multiple accounts. |
| `tests/test_evaluation.py` | Added `test_evaluation_default_full_population_scope` and `test_ring_clustering_one_to_one_matching_prevents_inflation`. |
| `test_report.md` | Comprehensive execution metrics, evaluation methodology, and file modification changelog. |
