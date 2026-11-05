# Module 3: Toy and Sample Datasets, Data Contract

**Owner:** ML-A. **Backup:** ML-B. **Days:** 1-3. Read `datasetguide.md` Sections 2, 9, 11 first.

## Goal
Get small, correct, realistic datasets into everyone's hands fast, so detectors, features and loaders never wait for the full generator.

## Deliverables
| Item | When | Contents |
|---|---|---|
| `docs/data_schema.md` | Day 1 | Column names, allowed values, file formats, the ring-template interface in words (world state, difficulty, parameters in; transactions, roles, ground-truth record out). Fix the naming mismatch: ground-truth ring id lives only in `gt_accounts.gt_ring_id`. |
| `toy` | **Day 1 evening** | 10 accounts, 30 transactions, hand-made, one tiny ring, one sink; all five CSVs |
| `sample500` v0 | Day 2 | 500 accounts, normal behaviour plus sinks, no rings |
| `sample500` v1 | **Day 3** | Adds all five ring types (easy and medium) and about 15 hard negatives |
| Data card v0 | Day 2-3 | Counts, allowed values, known limits |

## Decisions to write down on Day 1
- Sink accounts also get a row in `gt_accounts` with role `normal` and `true_is_mule = false`. Sinks are excluded from scoring by `account_type = sink`.
- A mule shared by two rings keeps one `gt_ring_id`; the sharing is recorded in the ring's `params_json`.
- File load order: `gt_rings`, `accounts`, `gt_accounts`, `transactions`, `gt_transactions`.

## Can start when
Immediately (needs only the column list).

## Hard dependency
`sample500` v1 needs ML-B's layering and circular templates (Module 4). If they are late, ship v1 with three types on Day 3 and add the other two on Day 4. Tell GR and ML-B the exact content.

## Blocks others
Module 5, 6, 8. Workaround for them: toy is enough for Day 1-2.

## Done when
Files load with BE's loader without errors; ML-B reviews sample500 v1 and writes `data_review.md` v1.

