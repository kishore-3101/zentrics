# Module 7: Community Detection, Ring Clustering, Ring Scoring, Roles

**Owner:** GR. **Backup:** ML-B. **Days:** 7-8. See `plan.md` Section 5.8 and `plan_v2.md` Sections 5 and 6.

## Goal
Turn account risks and hits into ranked, explainable ring candidates.

## Deliverables
1. Community detection on the suspicious subgraph (community id per account, written to `account_scores`).
2. Ring clustering: accounts above the risk threshold, connected through suspicious edges; components or communities with at least 3 accounts become candidates. Include a test that two rings sharing one mule are not wrongly merged (the generator plants this in 10% of rings).
3. **Ring score**: mean and max risk, amount moved, amount at risk (inflow minus cash-out to sinks at time t), speed, size, distinct victims, pattern diversity.
4. Priority = ring score x amount at risk (stored).
5. Role assignment (victim, collector, mule, cash-out): a written procedure with one unit test per ring type.
6. Ring facts: first inflow time, last outflow time, amount moved, amount cashed, edge set (`ring_transactions`), pattern tags.
7. Fingerprint: hash of sorted member ids. Case linking itself is done by BE (Module 11).
8. Recommended action by the thresholds in `plan.md` 5.10 (80 and 50).

## Can start when
Day 7 for the real work, but the design starts Day 5. Needs Module 6 hit format.

## Hard dependency
Real tuning needs account risks from Module 9. Stand-in: risk from rule score alone, or oracle-free proxy from hits, so GR never waits for ML-B.

## Blocks others
Module 11 (rings are the main output), Module 15 (explanation consumes ring objects), Module 10 (ring recall).

## Done when
All five ring types produce rings on `sample500` v1; shared-mule test passes; roles correct in unit tests; ring objects match the fixture shape from Module 2.

