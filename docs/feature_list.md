# Feature List & Evaluation Protocol (Module 8)

Owner: ML-B · Reviewer: ML-A · Status: **DRAFT, to be agreed on Day 1**

Companion files: `datasetguide.md` (data contract), `wiki/schem_changes.md` (tables, value lists), `wiki/modules/module-8-baselines-and-features.md`.

---

## 0. Hard rules (read first)

1. **Feature code must never read any `gt_*` table.** Not for features, not for filtering, not for debugging joins.
2. **Feature code must never read `train_label`** (or any label column). Labels are joined only in the training and evaluation scripts.
3. **No identity leaks:** never use `account_id`, ring IDs, generator seeds, row order or file order as features.
4. **No future data:** in windowed mode, a feature for window `[start, end)` may only use transactions with `ts < end`. History-based features use a lookback strictly before `start`.
5. **Neighbour risk is NOT in this table.** It is a Module 9 second pass over first-pass ML probabilities, never labels.

If any single feature gives PR-AUC > 0.97 on its own, stop and report it to ML-A as a likely leak.

---

## 1. Source columns (confirmed against `datasetguide.md` Section 2)

| Table | Columns used |
|---|---|
| `transactions.csv` | `src_account`, `dst_account`, `amount`, `ts`, `channel` |
| `accounts.csv` | `account_id`, `open_date`, `kyc_level`, `account_type`, `declared_income_band` |

Not used as features: `is_injected`, `injection_id` (they describe the simulation, not behaviour), `bank_id`, `city_cluster` (kept only for the fairness table).

Value lists (from the data contract):
- `ts`: ISO-8601 **UTC** (`Z`). `open_date`: `YYYY-MM-DD`. Amounts are INR, always > 0.
- `channel`: `UPI`, `IMPS`, `NEFT`, `ATM_WITHDRAWAL`.
- `kyc_level`: `minimal`, `full`.
- `account_type`: `savings`, `current`, `wallet`, `sink`. **Sink accounts are never scored**, so drop `account_type = sink` rows from the output. Their transactions still count as counterparties of the accounts that paid them.

---

## 2. Output shape

One row per account per window:

```
account_id | window_start | window_end | <feature columns...>
```

- Features are `float32`. Booleans are 0/1.
- Accounts with no activity in the window still get a row (counts = 0, ratios = 0, times = sentinel, see Section 6).
- The pipeline runner stores the row as `features_json` in `account_scores` (key `run_id, account_id`). **ML-A/BE to confirm** whether the training table keeps the extra window columns.

---

## 3. Windowed mode (needed by the streaming sim, Module 12a)

```python
build_features(
    txns: pd.DataFrame,
    accounts: pd.DataFrame,
    window_start: pd.Timestamp,
    window_end: pd.Timestamp,
    account_ids: list[str] | None = None,   # None = all accounts
    lookback_days: int = 30,                # history for new_beneficiary_rate, dormancy_gap_days
) -> pd.DataFrame
```

- Batch training calls it once over the full dataset period.
- Streaming calls it on short windows (proposed: 1 h and 24 h) for a subset of accounts.
- Same code path in both modes. No separate "streaming version".

---

## 4. Features (30)

Notation: for account `a` in window `W`, **IN** = transactions where `dst_account = a`; **OUT** = transactions where `src_account = a`.

### 4.1 Volume and flow (12)

| # | feature | meaning | formula | source columns |
|---|---|---|---|---|
| 1 | `in_amount_total` | money received | sum of amount over IN | dst_account, amount, ts |
| 2 | `out_amount_total` | money sent | sum of amount over OUT | src_account, amount, ts |
| 3 | `in_txn_count` | number of credits | count of IN | dst_account, ts |
| 4 | `out_txn_count` | number of debits | count of OUT | src_account, ts |
| 5 | `pass_through_ratio` | share of received money sent on | out_amount_total / (in_amount_total + 1), clipped to [0, 5] | amount |
| 6 | `net_retention` | how much money stays | (in - out) / (in + out + 1), range [-1, 1] | amount |
| 7 | `median_forward_time_min` | how fast money is passed on | for each OUT txn, minutes since the latest earlier IN txn; take the median | src/dst_account, ts |
| 8 | `fast_forward_share` | share of outflow sent quickly | sum of OUT amount sent within 30 min after an IN / out_amount_total | amount, ts |
| 9 | `max_in_1h` | burst of incoming credits | max count of IN txns in any rolling 1 h window | dst_account, ts |
| 10 | `max_out_1h` | burst of outgoing debits | max count of OUT txns in any rolling 1 h window | src_account, ts |
| 11 | `burstiness` | clumped vs. steady activity | (sigma - mu) / (sigma + mu) of gaps between consecutive txns (IN and OUT together); 0 if fewer than 3 txns | ts |
| 12 | `amount_cv` | how uniform the amounts are | std(amount) / mean(amount) over IN and OUT; 0 if fewer than 3 txns | amount |

> Dropped from the first draft: `round_amount_share`. `datasetguide.md` Section 9 explicitly removes round-number tells from the data, so it would carry no signal.

### 4.2 Graph structure (10)

**Stage 1** (rows 13-17): plain `groupby` on the transactions table. Usable before GR's graph (Module 6) is ready.
**Stage 2** (rows 18-22): needs GR's graph.

| # | feature | meaning | formula | source columns | stage |
|---|---|---|---|---|---|
| 13 | `unique_senders` | distinct accounts paying in | distinct src_account over IN | src/dst_account | 1 |
| 14 | `unique_receivers` | distinct accounts paid out to | distinct dst_account over OUT | src/dst_account | 1 |
| 15 | `degree_asymmetry` | fan-in vs. fan-out shape | (unique_senders - unique_receivers) / (unique_senders + unique_receivers + 1) | src/dst_account | 1 |
| 16 | `top_counterparty_share` | dependence on one partner | largest single-counterparty amount / total amount (IN and OUT) | src/dst_account, amount | 1 |
| 17 | `reciprocal_share` | two-way relationships | counterparties that both send to and receive from a / all counterparties | src/dst_account | 1 |
| 18 | `relay_count` | times a acted as a relay in a chain | count of pairs (IN x to a, OUT a to y) with y != x, the OUT within 30 min after the IN, and OUT amount between 80% and 100% of the IN amount | all txn columns | 2 |
| 19 | `cycle_count_le4` | sits on a money loop | number of directed simple cycles of length <= 4 through a, with time-ordered edges, in W | src/dst_account, ts | 2 |
| 20 | `pagerank_amount` | how central a is | PageRank on the window graph, edge weight = sum of amount | src/dst_account, amount | 2 |
| 21 | `two_hop_reach` | size of the local network | distinct accounts within 2 hops (either direction) | src/dst_account | 2 |
| 22 | `clustering_coef` | how tightly knit its neighbours are | local clustering coefficient on the undirected window graph | src/dst_account | 2 |

### 4.3 Profile (8)

| # | feature | meaning | formula | source columns |
|---|---|---|---|---|
| 23 | `account_age_days` | how new the account is | (window_end - open_date) in days | open_date |
| 24 | `txn_per_age_day` | activity relative to age | (in_txn_count + out_txn_count) / max(account_age_days, 1) | open_date, ts |
| 25 | `volume_to_income_ratio` | money moved vs. declared income | in_amount_total scaled to a 30-day month (x 30 / window days) / monthly income-band midpoint (Section 5) | amount, declared_income_band |
| 26 | `cash_out_share` | share leaving as cash | OUT amount with channel = ATM_WITHDRAWAL / out_amount_total | channel, amount |
| 27 | `night_share` | late-night activity | txns with 01:00 <= local hour < 05:00 / all txns (see open question 7 on time zone) | ts |
| 28 | `new_beneficiary_rate` | paying people never paid before | OUT txns whose dst_account was never paid by a in the lookback or earlier in W / out_txn_count | src/dst_account, ts |
| 29 | `dormancy_gap_days` | sleeping account waking up | days between the last txn before window_start (within lookback) and the first txn in W; lookback_days if none | ts |
| 30 | `kyc_level_ord` | KYC strength | ordinal encoding of kyc_level (Section 5) | kyc_level |

**Total: 30 features** (12 volume and flow, 10 graph, 8 profile), plus the flag column `has_forward` (Section 6).

---

## 5. Lookup tables (proposed; ML-A to confirm)

`declared_income_band` has five values. Midpoints are my proposal, in INR per month:

| declared_income_band | midpoint (INR/month) |
|---|---|
| low | 12,000 |
| lower_mid | 25,000 |
| mid | 50,000 |
| upper_mid | 100,000 |
| high | 250,000 |

| kyc_level | ordinal |
|---|---|
| minimal | 0 |
| full | 1 |

---

## 6. Missing values and edge cases

| case | rule |
|---|---|
| No IN or no OUT in the window | sums and counts = 0, ratios = 0 |
| `median_forward_time_min` has no forwarded txn | sentinel = window length in minutes, plus a 0/1 flag column `has_forward` |
| Fewer than 3 txns for `burstiness` / `amount_cv` | 0 |
| `open_date` after window_end | drop row and log it (data bug) |
| `account_type = sink` | not scored, no output row |

---

## 7. Baselines (the things to beat)

Both baselines are thresholded to the **same alert budget** as the model, so the comparison is fair. Both use only the features above.

**Baseline A: per-account rules, no graph.** Score = number of rules hit / 4:
- `account_age_days` < 30
- `kyc_level_ord` = 0 (minimal KYC)
- `volume_to_income_ratio` > 3
- `pass_through_ratio` > 0.9 **and** `median_forward_time_min` < 60

**Baseline B: volume threshold.** Score = max daily `out_amount_total`. Flag above INR X, where X is chosen so the number of flags matches the alert budget.

---

## 8. Evaluation protocol

**Splits**
- Split by **dataset seed**, never by random rows: train on the `train_v1` seeds, validate on `val_v1`. A random row split puts members of the same ring on both sides and inflates the scores.
- Train on `train_label` (noisy: about 3% of true mules flipped to false, 0.2% of normal accounts flipped to true). Evaluate against the clean `true_is_mule`. Both live in `gt_accounts`, so only the training and evaluation scripts may read them; feature code never does.
- `test_v1` and `test_hard` are used once. `demo` is never used for evaluation (`modules/module-4`).

**Metrics** (reported for Baseline A, Baseline B, XGBoost alone, and the fused score)
- **PR-AUC**, account level. Primary metric.
- **Precision at alert budget**: precision when flagging the top N, where N = reviewable alerts per day x days in the set. *(ML-A to confirm the budget number.)*
- **Ring recall**: share of true rings with at least 2 members in the flagged set (definition in `plan_v2.md` Section 5).
- **Calibration**: Brier score and a reliability plot with 10 bins.
- **Fairness**: flag rate by `city_cluster` and by `declared_income_band`, for normal and hard-negative accounts.

**Ablations**: drop each feature group (volume and flow, graph, profile) and report the PR-AUC change.

**Sanity bands**
- Per-account XGBoost on validation: expect PR-AUC around 0.80-0.90.
- 0.97 or above overall, or any single feature at 0.97 or above alone: treat as leakage and report to ML-A.

**Done when**
- The fused score beats both baselines on validation PR-AUC and precision at budget.
- Reason codes show real facts (for example "12 unique senders in 1 hour").

---

## 9. Open questions for ML-A

1. Income-band midpoints and the `kyc_level` ordinal (Section 5 is my proposal).
2. The team's common output shape: key columns and file format for the feature table.
3. The alert budget (reviewable rings or accounts per day).
4. Window lengths the streaming sim will request (proposed: 1 h and 24 h).
5. Whether `relay_count` and `cycle_count_le4` can be computed from GR's graph (Module 6) in window mode, or I compute them from the table.
6. Confirm that the generator plants no round-amount pattern, so dropping `round_amount_share` is right.
7. **Time zone for `night_share`.** The data is UTC, but the "quiet 01:00-05:00" pattern in `datasetguide.md` Section 4 does not say which zone it uses. I propose converting to IST (UTC+5:30) before taking the hour. If the generator draws hours directly in UTC, use UTC instead.
