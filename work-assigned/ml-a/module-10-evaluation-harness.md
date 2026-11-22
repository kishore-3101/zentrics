# Module 10: Evaluation Harness, Ablations, Robustness

**Owner:** ML-A. **Backup:** ML-B. **Days:** 7-13. See `plan.md` Section 12 and `plan_v2.md` Section 5.

## Deliverables
1. Harness reading ground-truth files (the **only** code allowed to), predictions, and producing: precision, recall, F1, false-positive rate, PR-AUC; ring recall (a ring is found if one predicted ring holds at least 70% of its mule accounts); ring precision; recall by ring type; recall by difficulty; time-to-detect; precision at 5 and 10; alert reduction (account alerts versus ring cases); hard-negative false-positive breakdown per class; money saved (simulated, labelled as such); results with suspicious-unlabeled counted as negatives and excluded.
2. **Four-method comparison**: baseline rules, graph rules, ML only, full fusion.
3. Ablations (remove graph features, remove neighbour risk, remove each detector) and robustness curves as ring difficulty rises.
4. Results written to `metrics` and `metric_artifacts` for the active run, and to files for offline datasets.
5. Evaluation report and results slide numbers (Day 13-14).

## Schedule
Day 7 harness on baseline output; Day 8-9 test sets released (Module 4); Day 10 held-out evaluation with ML-B; Day 11 ablations; Day 12 robustness and stress; Day 13 final tables.

## Can start when
Day 1 (protocol with ML-B) and Day 7 for code. Needs only ground-truth files and a predictions file format.

## Hard dependency
Final numbers need Module 7 rings and Module 9 scores. Stand-in: evaluate baseline output and random output to validate the harness (a random method should score about chance).

## Rules
Test sets are used once for final numbers. Never evaluate on the demo dataset.

## Blocks others
Module 16 metrics tab, Module 17 slides.

## Done when
Numbers reproduce from one command; a deliberately perfect predictor scores 1.0 and a random one scores near chance (harness sanity checks).

