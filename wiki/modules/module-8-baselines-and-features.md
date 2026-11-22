# Module 8: Baselines and Feature Pipeline

**Owner:** ML-B. **Backup:** ML-A. **Days:** 1-5. See `plan.md` Sections 5.4 and 5.6.

## Goal
Build the thing we must beat, and the feature table everything else uses.

## Deliverables
1. Feature list and evaluation protocol (Day 1, agreed with ML-A). Protocol includes the definitions in `plan_v2.md` Section 5.
2. **Baselines**: (a) per-account rules using account-level fields only, no graph; (b) simple threshold rules on volume. These are what the headline comparison uses.
3. Feature pipeline, one row per account, per window: volume and flow (in, out, pass-through ratio, median time to forward, burstiness), graph structure (degrees, unique counterparties, one-time counterparty share, cycle and chain participation, centrality on the suspicious subgraph), profile (age versus volume, volume versus declared income band, cash-out share, night share, new-beneficiary rate).
4. Windowed mode usable by streaming (Module 12a): features for a subset of accounts.
5. Features must never read ground-truth tables.

## Schedule
Day 1 feature list; Day 2 baseline rules on toy; Day 4 volume and flow features; Day 5 graph features.

## Can start when
Day 1. Toy then sample500.

## Hard dependency
Graph features need the graph from Module 6 (Day 1-2 on toy). Workaround: compute simple degree features with plain table operations first and switch to the graph later.

## Blocks others
Module 9 (needs features). Module 10 (needs baseline outputs).

## Done when
Feature table builds on `sample500` v1 in seconds and on `train_v1` in minutes; no leakage columns; baselines produce scores in the common output shape.

