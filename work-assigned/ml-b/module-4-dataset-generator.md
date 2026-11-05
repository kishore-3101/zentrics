# Module 4: Full Dataset Generator

**Owners:** ML-A (core, three ring types, hard negatives, knobs, label noise, all release sets, inject function) and ML-B (layering chain and circular flow templates, realism and leakage review). **Days:** 1-12. The single source of truth is `datasetguide.md`; this file only splits the work and sets the order.

## Split between the two ML engineers
| Part | Owner | Days |
|---|---|---|
| Generator core: accounts, normal traffic, time patterns, sinks, export, seeds, config | ML-A | 1-3 |
| Fan-in/fan-out, rapid pass-through hub, dormant-then-active templates | ML-A | 3-4 |
| Layering chain and circular flow templates (same interface as ML-A's) | ML-B | 3-4 |
| Hard negatives, five classes | ML-A | 4 |
| Difficulty knobs, noise, label noise, shared mules | ML-A | 5 |
| Realism and leakage review (written in `data_review.md`) | ML-B | 3, 6 |
| Validation script, data card | ML-A (ML-B reviews) | 6-8 |
| `train_v1`, `val_v1` | ML-A | 6 |
| `test_v1` (unseen ring parameters), `test_hard` | ML-A | 8 |
| `demo` dataset, `inject` function | ML-A | 9, 11 |
| `stress` set | ML-A | 12 |

## Order of work
1. Day 1: agree the ring-template interface and file format; freeze.
2. Day 3: both ML engineers release templates so `sample500` v1 can ship.
3. Day 5: all knobs in; leakage traps from Section 9 of the guide are implemented (not just checked).
4. Day 6: validation script passes and ML-B signs off. Only then release `train_v1` and `val_v1`.
5. No generator tuning against validation after Day 8. Test sets are used once. Demo is never used for evaluation.

## Can start when
Day 1, once the interface is written. ML-B's templates are independent of ML-A's.

## Hard dependency
ML-B's templates depend on the generator core world state (accounts, random generator, time range) existing. Workaround: ML-B writes templates against the agreed interface with a tiny fake world, then plugs in on Day 3.

## Blocks others
`train_v1`/`val_v1` unblock Module 9 and tuning in Module 7 (Day 6). Fallback: everyone continues on `sample500` v1.

## Done when
All checklist items in `datasetguide.md` Section 10 are green for each released dataset; same seed gives identical bytes; single-feature leakage check passes; `dataset_card.md` exists per set.

