# Module 6: Graph Builder and Six Rule Detectors

**Owner:** GR. **Backup:** ML-B. **Days:** 1-6. See `plan.md` Sections 5.3 and 5.5.

## Goal
Build the transaction graph and the six explainable detectors, each emitting structured evidence.

## Deliverables
1. Graph builder: directed multigraph, one node per account, one edge per transaction (amount, time, channel). Sinks marked and excluded from scoring. Time-window views (10 min, 1 h, 24 h, 7 days) and a filtered suspicious subgraph.
2. Six detectors: fan-in burst, fan-out split, rapid pass-through, layering chain, circular flow (length 3-5 within 24 h), dormant activation. Thresholds come from a config file, not hard-coded.
3. Hit format: account, code, window start, window end, severity, **structured evidence** (counts, percentages, delays, amounts), and a display string. The explanation engine (Module 15) reads the structured evidence only.
4. Per-account rule score 0-1 from hits.
5. Tests: tiny hand-made graph per detector (positive and negative case), plus hard-negative graphs that must not fire.
6. `docs/detectors.md`.

## Schedule
Day 1 graph builder on toy; Day 2 tests; Day 3 fan-in burst and fan-out; Day 4 pass-through and dormant; Day 5 layering chain; Day 6 cycle detector.

## Can start when
Day 1. Needs only the column list and toy.

## Hard dependency
None for building. Tuning thresholds needs `sample500` v1 (Day 3) and `train_v1` (Day 6). Workaround: hand-made graphs.

## Blocks others
Module 7 needs the hit format (freeze it Day 3). Module 11 needs the functions. Workaround for them: stubs.

## Notes
Do not read ground-truth tables in this module. Cycle search and chain search can be expensive: restrict to the suspicious subgraph and the time window; record timing on `sample500`.

## Done when
Each detector passes its tests; false-positive rate on hard-negative classes is measured and reported to ML-B; hit format is frozen.

