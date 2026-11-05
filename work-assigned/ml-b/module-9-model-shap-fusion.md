# Module 9: XGBoost, SHAP Reason Codes, Neighbour Risk, Score Fusion

**Owner:** ML-B. **Backup:** ML-A. **Days:** 6-11.

## Deliverables
1. XGBoost classifier on the feature table, trained on `train_label` (noisy), class imbalance handled, tuned for PR-AUC. Splits come from different dataset seeds, never random rows.
2. SHAP values per account, converted to **reason codes**: code, direction, weight, and the fact behind it (for example 12 unique senders in 1 hour). Written to `shap_json` and `reason_codes`.
3. **Neighbour risk**: second pass using first-pass ML probabilities (never labels) averaged over direct counterparties.
4. **Fusion**: risk = weighted blend of ML probability, rule score and neighbour risk, scaled 0-100. Weights are **fitted on validation data and reported**.
5. Threshold chosen by alert budget (reviewable rings per day), with precision at that budget.
6. Calibration check and a fairness table: flag rates by city cluster and declared income band for normal and hard-negative accounts.
7. Model card: data used, limits, what it cannot do.

## Schedule
Day 6 model v1 on full data; Day 7 SHAP; Day 8 neighbour risk and fusion function; Day 9 export scores for integration; Day 10-11 held-out evaluation and tuning with GR; Day 12 calibration and fairness.

## Can start when
Day 3 on `sample500` v1 as a prototype.

## Hard dependency
Final model needs `train_v1` and `val_v1` (Module 4, Day 6). Workaround: train on sample500 v1; code is identical.

## Reality check
A per-account-only model should land roughly in the 0.80-0.90 PR-AUC range. If it reaches 0.99, tell ML-A: the data leaks.

## Blocks others
Module 7 tuning, Module 11 runner, Module 10 final metrics, Module 15 (reason codes).

## Done when
Scores exported in the common shape; fusion beats both baselines on validation; reason codes display real facts.

