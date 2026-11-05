# Dataset Guide for the ML Engineers (ML-A and ML-B)
 
Goal: produce a **realistic, reproducible, labelled synthetic transaction dataset** with normal behaviour, hard negatives (legitimate accounts that look suspicious) and planted mule rings of five types, plus difficulty knobs and clean ground truth.
 
The detectors, the model and the dashboard are all judged on this data. If it is too easy, the results look fake; if it leaks labels, the results are meaningless. Read Sections 9 and 10 before writing any generator code.
 
Companion files: `schema_changes.md` (table and column names, value lists), `plan.md` Section 5.2 (original design), `modules/module-3-*.md` and `module-4-*.md` (tasks and deadlines).
 
---
 
## 1. Who does what
 
| Part | Owner | Notes |
|---|---|---|
| Generator core: accounts, normal traffic, time patterns, sinks, export, seeds, config | **ML-A** | Day 1-3 |
| Ring templates: fan-in/fan-out, rapid pass-through hub, dormant-then-active | **ML-A** | Day 3-4 |
| Hard negatives (five classes) | **ML-A** | Day 4 |
| Ring templates: layering chain, circular flow | **ML-B** | Day 3-4, then ML-B moves to features. Same interface as ML-A's templates. |
| Difficulty knobs, noise, label noise, shared mules | **ML-A** | Day 5 |
| Realism and leakage review of every dataset before release | **ML-B** | Day 3 (sample), Day 6 (full). Written findings in `data_review.md`. |
| Validation script and data card | **ML-A**, reviewed by ML-B | Day 6-8 |
| Test sets, demo dataset, replay and inject function, stress set | **ML-A** | Day 8-12 |
 
Agree on one **template interface** on Day 1 (in words, written in `docs/data_schema.md`): every ring template takes the world state (accounts, random generator, time range), a difficulty level and a parameter set, and returns the new transactions, the roles of the accounts involved, and a ring ground-truth record. With that interface, ML-B's templates plug into ML-A's generator without conflicts.
 
---
 
## 2. Output files (the data contract)
 
Every dataset is a folder named by its dataset name (for example `train_v1`) containing:
 
| File | Contents |
|---|---|
| `accounts.csv` | The accounts table |
| `transactions.csv` | The transactions table, sorted by `ts` |
| `gt_accounts.csv` | Ground truth per account (never read by the detector or features) |
| `gt_transactions.csv` | Ground truth per transaction |
| `gt_rings.csv` | One row per planted ring |
| `config.json` | Seed, difficulty settings, counts, generator version |
| `dataset_card.md` | Human-readable description (Section 11) |
 
**Formats**
- UTF-8, comma separated, header row, no index column.
- Timestamps: ISO-8601 in UTC with `Z` (for example `2026-03-04T10:15:30Z`). `open_date`: `YYYY-MM-DD`.
- Amounts: INR, two decimals, always greater than 0.
- Booleans: `true` / `false`.
- JSON columns (`params_json`): a JSON string with doubled quotes escaped per CSV rules.
**Columns** (names must match the database exactly; see `schema_changes.md`)
 
`accounts.csv`: `account_id, open_date, kyc_level, account_type, city_cluster, declared_income_band, bank_id`
 
`transactions.csv`: `txn_id, ts, src_account, dst_account, amount, channel, is_injected, injection_id`
 
`gt_accounts.csv`: `account_id, true_is_mule, train_label, gt_ring_id, role, scenario`
 
`gt_transactions.csv`: `txn_id, is_fraud_related, gt_ring_id`
 
`gt_rings.csv`: `gt_ring_id, ring_type, difficulty, n_accounts, n_victims, first_inflow_ts, last_outflow_ts, amount_total, params_json`
 
**Allowed values**
- `kyc_level`: minimal, full
- `account_type`: savings, current, wallet, sink
- `channel`: UPI, IMPS, NEFT, ATM_WITHDRAWAL
- `declared_income_band`: low, lower_mid, mid, upper_mid, high
- `role` in `gt_accounts`: normal, hard_negative, suspicious_unlabeled, victim, collector, mule, cash_out
- `ring_type`: fan_in_fan_out, layering_chain, circular_flow, pass_through_hub, dormant_active
- `difficulty`: easy, medium, hard
- `scenario`: normal, hard_negative_<class>, suspicious_unlabeled, or the ring type
**Sink accounts.** Cash-out goes somewhere. Create `account_type = sink` accounts: one ATM sink per city cluster (`ATM_SINK_<cluster>`) and 5-10 external-bank sinks (`EXT_BANK_<n>`). Withdrawals and transfers out of the bank are transactions whose destination is a sink. Sinks are never scored.
 
---
 
## 3. Scale and composition (full-size dataset)
 
| Item | Target |
|---|---|
| Accounts | 12,000 normal plus hard negatives plus ring accounts plus sinks |
| Period | 30 days, starting on a fixed date |
| Transactions | about 250,000 (range 150k-500k) |
| Mule accounts (true) | about 1.5-2% of accounts (180-250) |
| Planted rings | 35-45 per dataset |
| Ring mix | about 15 fan-in/fan-out, 8 layering, 6 circular, 8 pass-through hub, 6 dormant |
| Hard-negative accounts | about 1.5 times the number of mule accounts (so a naive rule produces many false positives) |
| Suspicious-unlabeled accounts | 10-20 |
| Victims | normal accounts who happen to send money into a ring; not labelled mule |
 
Rings start at random times between Day 5 and Day 28 (not all at the start, and a few in the last 3 days so a time-based split has rings in the test period).
 
---
 
## 4. Normal behaviour
 
Build the world first; rings come after.
 
**Accounts**
- Types: about 70% savings, 15% current, 15% wallet.
- KYC: about 85% full, 15% minimal.
- City clusters: 8-12 coarse clusters with uneven sizes.
- Income bands: realistic bell shape centred on lower_mid / mid.
- Account age: spread widely (a few days to 10+ years, roughly log-uniform), with **some normal new accounts** (about 5% under 30 days) and some long-idle normal accounts.
- Account IDs: **random, non-sequential** (see Section 9).
**Transactions** (choose a mix; exact shares are yours to tune)
- Salary credits near the end or start of the month: 20k-120k, from a small set of employer accounts.
- Rent: monthly, 8k-40k, first days of the month.
- Merchant payments (UPI): many small payments to merchant accounts, median around 250.
- Peer-to-peer transfers: log-normal, median around 800, heavy right tail.
- Bill payments: monthly, a few thousand.
- Family transfers: recurring pairs and small groups.
- ATM withdrawals: to ATM sinks, 500-10,000.
**Time patterns**
- Daily: peaks 10:00-13:00 and 18:00-22:00, low activity 01:00-05:00.
- Weekly: more peer and merchant activity on weekends.
- Month: salary and rent spikes.
**Realistic messiness (important)**
- Degree distribution is heavy-tailed (a few busy accounts, many quiet ones).
- About 5% of normal accounts occasionally **forward most of what they receive within an hour** (friend sends money, you pay a shop). Without this, "fast pass-through" would be a perfect signal.
- Some normal accounts are near-silent; some have one burst of activity.
---
 
## 5. Hard negatives (legitimate but suspicious-looking)
 
Generate all five classes. Each should be 10-40 accounts depending on class (about 1.5 times the mule count in total).
 
| Class | `scenario` | Behaviour |
|---|---|---|
| Busy shops / kirana | `hard_negative_shop` | High fan-in (50-300 unique senders per day), mostly small amounts (20-500), regular daily rhythm, cash-out rare, retains most money, occasional bulk transfer to supplier |
| Landlords and societies | `hard_negative_landlord` | 10-60 senders on the first days of the month, similar amounts (maintenance or rent), then one or two large outgoing transfers days later (not minutes) |
| Payroll disbursers | `hard_negative_payroll` | One account sending to 20-300 recipients at one time each month, same-day, similar amounts. High fan-out but no preceding fan-in burst from strangers. |
| Collection accounts | `hard_negative_collection` | Festival or crowdfunding: sudden fan-in from many senders over days, amounts varied, **slow** and partial forwarding to one beneficiary |
| Family pooling | `hard_negative_family` | Small closed group sending money back and forth, circular-looking flows among 3-5 accounts, amounts in round-ish family sums, low volume, spread over weeks |
 
Label all hard negatives `true_is_mule = false`, `train_label = false`, role `hard_negative`.
 
---
 
## 6. Planted ring templates
 
For each type below: structure, ranges for **easy**, **medium** and **hard**, and the ground-truth to write. "Hard" means harder to detect, as in plan.md (slower, noisier, more hops, smaller).
 
All rings:
- Victims are existing normal accounts (role `victim`, `true_is_mule = false`).
- Collectors, mules and cash-out accounts are ring accounts; most are new accounts (see Section 7); every ring account is `true_is_mule = true`.
- Cash-out = ATM withdrawals or transfers to sink accounts.
- Write one row to `gt_rings` per ring and mark every ring transaction in `gt_transactions`.
- Money must roughly conserve: what goes out is what came in minus a small commission or retained amount.
- Add **night-time bias** of about 35% of ring activity at night, not 100%.
### 6.1 Fan-in then fan-out (owner: ML-A)
 
Many victims send to a collector, which splits among mules, which cash out.
 
| Parameter | Easy | Medium | Hard |
|---|---|---|---|
| Victims | 20-40 | 10-20 | 6-10 |
| Victim amount | 2k-80k (log-normal, median about 15k) | same | 1k-30k |
| Collectors | 1 | 1-2 | 2-3 |
| Mules | 3-6 | 5-8 | 6-12 |
| Inflow window | 20-40 min | 1-3 h | 3-10 h |
| Collector to mule delay | 2-15 min | 10-60 min | 1-6 h |
| Share cashed out | 90-100% | 80-95% | 60-85% (rest retained or slow) |
| Commission per hop | 2-5% | 3-8% | 3-10% |
| Split amounts | nearly equal | moderate noise | random uneven |
 
### 6.2 Rapid pass-through hub (owner: ML-A)
 
Accounts that receive from several sources and forward almost everything right away.
 
| Parameter | Easy | Medium | Hard |
|---|---|---|---|
| Hub accounts | 1-3 | 1-3 | 1-3 |
| Unique sources per hub | 10-30 | 6-15 | 4-8 |
| Share forwarded | 95-100% | 88-96% | 70-88% |
| Forward delay | 2-10 min | 5-20 min | 20-60 min |
| Forward destinations | 1-2 | 2-3 | 3-5, some normal-looking |
 
### 6.3 Dormant-then-active (owner: ML-A)
 
New or long-idle accounts that suddenly move large amounts.
 
| Parameter | Easy | Medium | Hard |
|---|---|---|---|
| Accounts | 3-6 | 3-6 | 3-6 |
| Prior state | under 14 days old or idle 120+ days, history under 5k | under 30 days or idle 90+ days | normal-looking age, small history |
| Volume jump | 100x history | 20-50x | 5-10x |
| Amount moved | 1-10 lakh within 1-2 days | 0.5-5 lakh | 0.3-2 lakh over 3-5 days |
| Connections | chained to other ring accounts | partly to normal accounts | mixed with normal traffic |
 
### 6.4 Layering chain (owner: ML-B)
 
A to B to C to D to E, near-identical amounts, short delays, small commission at each hop.
 
| Parameter | Easy | Medium | Hard |
|---|---|---|---|
| Hops | 4-5 | 5-6 | 6-8 with a split into two parallel branches that merge |
| Hop delay | 2-10 min | 5-30 min | 30 min to 12 h |
| Commission per hop | 3-6% | 3-10% | 3-10% with amount jitter of +/-3% |
| Chain start | 1-3 victims | 1-3 victims | 1-3 victims plus a few small unrelated deposits into middle accounts |
| Final step | cash-out sink | cash-out sink | split among 2-3 sinks |
 
### 6.5 Circular flow (owner: ML-B)
 
A to B to C to A, so money returns to the origin and looks legitimate.
 
| Parameter | Easy | Medium | Hard |
|---|---|---|---|
| Cycle length | 3 | 3-4 | 4-5 |
| Laps | 2-3 | 1-2 | 1 |
| Amount decay per lap | 0-2% | 0-5% | 3-8% |
| Delay between hops | 2-15 min | 10 min to 3 h | 2-12 h |
| Disguise | none | one or two side payments to normal accounts | side payments plus one extra hop into a normal account and back |
| Cash-out | after final lap | partial | partial and delayed |
 
The detector targets cycles of length 3-5 within 24 hours. The "hard" settings deliberately push to the edge of that and a little beyond, so the robustness curve shows where the method stops working.
 
### 6.6 Shared accounts between rings
 
In about **10% of rings**, reuse one mule account from another ring. This tests whether ring clustering wrongly merges separate rings. Record the sharing in `params_json`.
 
---
 
## 7. Ring accounts: making them realistic, not trivially separable
 
Do **not** make ring accounts different from normal accounts in every single column.
 
- **Account age:** about 55% under 30 days old, 20% dormant (idle 90+ days), 25% ordinary ages.
- **KYC:** about 40% of mule accounts minimal, versus about 15% of normal accounts. A hint, not a giveaway.
- **Account type:** mostly savings and wallet, a few current.
- **Declared income band:** mostly low and lower_mid, with some mid, so volume versus income is a signal but not decisive.
- **City:** ring accounts in one ring may be spread over several clusters (about 50%), not all in one.
---
 
## 8. Difficulty, noise and labels
 
**Difficulty knobs (config.json)**: ring size, time spread, amount noise, hops, share of rings at each level. Preset mixes:
 
| Preset | Easy / medium / hard share | Used for |
|---|---|---|
| `mixed` | 30 / 40 / 30 | train, validation, normal test |
| `hard` | 0 / 30 / 70 | hard test set |
| `demo` | clear and visual (see Section 11) | live demo |
 
**Label noise (training labels only)**
- `true_is_mule`: the real truth. Evaluation uses only this.
- `train_label`: what training sees. Flip about 3% of true mules to `false` (missed by the bank) and mark 0.2% of normal accounts `true` (wrongly flagged). Hard negatives stay `false`.
- **Suspicious-unlabeled accounts:** 10-20 legitimate accounts with fast-forwarding behaviour (gig workers, small traders) labelled `false`. Report evaluation both with them counted as negatives and excluded.
**Never put noise in `true_is_mule`.** Evaluation must stay clean.
 
---
 
## 9. Leakage traps (read twice)
 
If any of these exist, a model can score well without detecting rings, and your "graph beats baseline" claim will not survive a question from a judge.
 
1. **Account IDs:** random strings with no order, no prefix by ring, no different length. Ring accounts must not be numbered consecutively or created in a block.
2. **Transaction IDs:** random or shuffled. Never sorted by ring or generated ring-by-ring in file order.
3. **Row order:** `transactions.csv` is sorted by time, which mixes ring and normal rows.
4. **Open dates:** ring accounts must not all share one creation date or cluster at the generator's start date.
5. **Round numbers:** do not use exact round amounts only in rings; normal transactions also use round amounts (500, 1000, 5000).
6. **Timestamps:** do not put ring events on whole minutes or exact fixed delays; add jitter.
7. **Column quirks:** no text, channel or city value unique to ring accounts.
8. **Sink behaviour:** normal withdrawals use sinks too.
9. **Victims:** drawn from the same distribution as normal accounts.
10. **Single-feature check:** after generation, train a one-feature model for each account-level column (age, KYC, type, income, city). None may reach an AUC above about 0.75. Combined account-level fields without graph structure should land roughly in the 0.80-0.90 range; if it is above about 0.95, the data is too easy and must be loosened.
---
 
## 10. Validation checklist (the script must check all of these)
 
Automated, run before releasing any dataset:
 
- [ ] All account IDs referenced in transactions exist in accounts; no duplicates.
- [ ] `src_account` differs from `dst_account`; `amount` is above 0.
- [ ] Timestamps parse, are UTC, within the dataset period, sorted.
- [ ] All values within the allowed lists.
- [ ] Every ground-truth ring has all its accounts in `gt_accounts`, and every ring transaction exists.
- [ ] Money conservation per ring within tolerance.
- [ ] Counts match the targets in Section 3 (mule share, hard negatives about 1.5 times mules, ring mix).
- [ ] No mule appears with `true_is_mule = false` and no victim with `true_is_mule = true`.
- [ ] Leakage checks in Section 9 (items 1-10).
- [ ] The same seed and config give a byte-identical dataset.
- [ ] Plots: amount distributions, hourly activity, degree distribution, per-feature mule versus normal histograms, saved into `dataset_card.md`.
Manual (ML-B, written in `data_review.md`): look at three random rings of each type in a quick plot. Would a human find them? Does anything look generated?
 
---
 
## 11. Dataset catalogue and delivery schedule
 
| Name | Role | Size | Seed (suggested) | Deadline | Used by |
|---|---|---|---|---|---|
| `toy` | toy | 10 accounts, 30 transactions, one tiny ring, hand-made | n/a | **Day 1 evening** | GR, ML-B, BE loader tests |
| `sample500` v0 | sample | 500 accounts, normal behaviour plus sinks | 1 | Day 2 | BE loader, ML-B features |
| `sample500` v1 | sample | 500 accounts, **all five ring types (easy and medium)** and 15 hard negatives | 1 | **Day 3** | GR detectors, ML-B model prototype |
| `train_v1` | train | full size, `mixed` preset | 11 | **Day 6** | ML-B model, GR threshold tuning |
| `val_v1` | val | full size, `mixed` | 21 | Day 6 | fusion weights, thresholds |
| `test_v1` | test | full size, `mixed`, **plus ring parameters not in train** (for example longer chains, new delay ranges) | 31 | Day 8 | final metrics |
| `test_hard` | test_hard | full size, `hard` preset | 41 | Day 8 | robustness |
| `demo` | demo | 2,000-3,000 accounts, curated: three visually clear rings (fan-in/fan-out with 20+ victims, layering chain, circular), one hard-negative shop that does **not** trigger | fixed | Day 9 | live demo |
| `inject` function | demo helper | add a new ring of chosen type and difficulty at the current stream time | n/a | Day 11 | simulation panel |
| `stress` | stress | 500k+ transactions | 51 | Day 12 | performance tests |
 
Rules: validation sets are never used to tune the generator after Day 8; test sets are used once for final numbers; the demo dataset is never used for evaluation.
 
---
 
## 12. Dataset card (`dataset_card.md`) must contain
 
Generator version and seed; counts per table, per ring type and per difficulty; hard-negative counts per class; the allowed-value lists; known limitations (synthetic, single bank, simplified behaviour); label-noise settings; validation results; leakage-check results; the plots from Section 10. This also feeds the "honesty" slide.
 
---
 
## 13. Working order for ML-A and ML-B
 
**Day 1:** Agree the template interface and the file format with BE (the format is frozen once agreed). ML-A writes the toy sample by hand. ML-B writes the feature list and evaluation protocol.
**Day 2:** ML-A builds the generator core and releases `sample500` v0. ML-B builds baseline rules on the toy sample.
**Day 3:** ML-A adds fan-in/fan-out and pass-through and releases `sample500` v1 together with ML-B's layering and circular templates. ML-B reviews and writes `data_review.md` v1.
**Day 4-5:** ML-A adds dormant rings, hard negatives, difficulty knobs, shared mules, label noise. ML-B moves fully to features.
**Day 6:** release `train_v1` and `val_v1` after the validation script passes and ML-B signs off the review.
**Day 8-12:** test sets, demo dataset, inject function, stress set (ML-A).
 
If the generator is late, the fallback is that ML-B and GR continue on `sample500` v1, which is enough to build everything; only the final numbers need the full sets.
