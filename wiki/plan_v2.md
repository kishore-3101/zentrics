# Mule Ring Detection Dashboard: Upgraded Plan (v2)
### Track 7: Cybersecurity, FinTech and Digital Trust
 
This file replaces the team, timeline and backend sections of `plan.md`. Everything in `plan.md` about the problem, detection logic (Section 5), dashboard contents (Section 6) and evaluation (Section 12) still stands unless this file says otherwise. Read together with:
 
- `schema_changes.md`: every database change
- `datasetguide.md`: how the ML engineers generate data
- `modules/README.md`: the 17 modules, owners, and dependency map
> Today is 5 Nov 2026. "Day 1" below is your first full working day. The plan assumes about 15 working days. If your deadline is shorter, use the cut list in Section 9.
 
---
 
## 1. What changed from plan.md (summary)
 
| # | Change | Why |
|---|---|---|
| 1 | Team is now **6 people with new roles** (Section 2). There is no separate data engineer; the two ML engineers own the dataset. | Matches the team you actually have. |
| 2 | **Database is Supabase (PostgreSQL)**, with a local Docker Postgres as offline backup. | Hosted, shared by all six, free tier is enough. |
| 3 | **Schema revised** (see `schema_changes.md`): Postgres fixes, ground truth split out, sink accounts for cash-out, dataset registry, ring transactions table for replay, case linking by overlap. | Several items would break on Postgres or break the plan. |
| 4 | **Live demo uses polling**, not WebSockets. | Fewer moving parts on stage. |
| 5 | **Ground truth cannot reach the detector.** Separate tables, separate loaders. | Prevents accidental label leakage. |
| 6 | **Noisy training labeVls** plus clean evaluation labels. | Makes results believable. |
| 7 | **Precise definitions** for amount at risk, money saved, ring recall, time-to-detect (Section 5). | The plan used these terms but never pinned them down, and judges will ask. |
| 8 | **Alert-reduction metric** added ("412 account alerts became 9 ring cases"). | Strongest single number for fraud-ops audiences. |
| 9 | **Module-based work split** with explicit blockers and workarounds. | Lets six people work at the same time. |
| 10 | Stretch goals frozen until the acceptance gate in Section 8 is passed. | Scope protection. |
 
---
 
## 2. Team and roles
 
| Code | Person | Role | Owns |
|---|---|---|---|
| **BE** | You | Backend and database lead | Supabase, migrations, API contract, mock server, FastAPI, pipeline runner, loaders, deployment, offline bundle |
| **FE** | Frontend developer | Frontend lead | Dashboard shell, alert queue, overview, Ring Explorer graph, timeline replay, simulation panel |
| **GR** | Graph engineer | Detection lead | Graph builder, six rule detectors, ring clustering, ring scoring, roles, incremental (sliding-window) detection |
| **ML-A** | ML engineer 1 | **Data and evaluation** | Dataset generator (core world, fan-in/out, pass-through, dormant, hard negatives), difficulty knobs, replay and inject-ring function, evaluation harness, ablations, robustness |
| **ML-B** | ML engineer 2 | **Features and model** | Layering-chain and circular-flow templates for the generator (short, early), baselines, feature pipeline, XGBoost, SHAP reason codes, neighbour risk, score fusion |
| **P6** | Sixth person | **Explainability, analyst UX, pitch and QA lead** | Explanation engine, explanation panel, case actions UI, metrics tab UI, fixtures, demo script, deck, Q&A, test plan |
 
### Where the sixth person goes (the question you asked)
 
Put them in **P6: explainability, analyst experience and pitch/QA lead.** Reasons:
 
1. In the original plan this was the most overloaded person (explanation engine, three UI areas, deck, video, documentation). Splitting it off gives the frontend developer room to focus on the graph, which is the hardest UI part and the centre of the demo.
2. It has almost no early dependencies. On Day 1 they can write the persona, wireframes, reason-code dictionary, summary templates and hand-written JSON fixtures without waiting for anyone.
3. It covers the gaps that lose hackathons: a weak story, an untested demo, and unanswered judge questions.
If the sixth person is **not a strong coder**: they own Modules 15 (templates and reason-code dictionary only), 17 (pitch, demo, QA, docs) and the fixtures in Module 2, and the frontend developer takes the case-actions and metrics UI from Module 16. If they **are** a coder, they own Modules 15, 16 and 17 fully, as listed.
 
### Backups (each person has one)
 
| Primary | Backup |
|---|---|
| BE | FE (API) and ML-A (pipeline runner) |
| FE | P6 |
| GR | ML-B |
| ML-A | ML-B |
| ML-B | ML-A |
| P6 | FE |
 
---
 
## 3. Architecture changes
 
The architecture diagram in plan.md stays. Changes:
 
- **Storage layer = Supabase Postgres.** The backend connects with the direct/pooler Postgres connection string. The frontend never talks to Supabase directly.
- **Offline fallback = the same migrations on a local Docker Postgres.** The demo must run with no internet.
- **Datasets are files** (CSV, optionally Parquet) in a shared storage folder; only the **active demo dataset** is loaded into the database. See `schema_changes.md` section D.
- **Pipeline runner** is a single Python entry point that reads the active dataset, runs graph, detectors, features, model, fusion, clustering, explanation, and writes everything into one `pipeline_runs` row's worth of tables.
- **Streaming mode** is the same pipeline run over a sliding window by a worker process that writes `alert_events`. The frontend polls.
### Supabase: what you need and the environment variables
 
You (BE) create the project. Full steps are in `modules/module-1-foundation-supabase.md`. The variables you will end up with:
 
**Backend (`.env`, never committed)**
 
| Variable | What it is | Where you get it |
|---|---|---|
| `DATABASE_URL` | Postgres connection string through the **pooler** (use session mode on the free tier) | Supabase dashboard, Connect / Database settings |
| `DIRECT_DATABASE_URL` | Direct connection string, for migrations (needs IPv6; if your network lacks it, use the session pooler string here too) | Same page |
| `SUPABASE_URL` | Project URL | Project settings, API |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret server key. Backend only. | Project settings, API keys (may be labelled "secret key" in the newer dashboard) |
| `SUPABASE_ANON_KEY` | Public key. Only needed if the frontend ever uses Supabase directly. | Same page (may be labelled "publishable key") |
| `API_TOKEN` | Simple shared token for the demo API | You invent it |
| `CORS_ORIGINS` | Allowed frontend origins | You set it |
| `APP_ENV` | `dev` / `demo` | You set it |
| `ACTIVE_DATASET` | Name of the dataset currently loaded | You set it |
| `PIPELINE_CONFIG_PATH` | Path to thresholds and weights file | Agreed with GR and ML-B |
| `LLM_API_KEY`, `LLM_MODEL` | Optional, only for the explanation rewrite step | Only if used |
| `LOG_LEVEL` | Logging level | You set it |
 
**Frontend (`.env`)**: `VITE_API_BASE_URL`, `VITE_API_TOKEN`. Optional later: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
 
**ML, graph, and data work**: they work from files. They need only `DATASET_DIR` (path to the shared dataset folder). They do not need database credentials until the pipeline runner is integrated.
 
Key facts to keep in mind (verify on the dashboard, as Supabase changes its UI and limits):
- Free projects have a size limit (around 500 MB at the time of writing) and may be **paused after about a week of inactivity**. Open the project every few days and especially before the demo.
- Load large data with Postgres `COPY` (or the driver's bulk copy), not with the REST API.
- Pick the region nearest to your team and demo venue (India: Mumbai region if available).
- Store the database password in a shared password manager, not in chat.
---
 
## 4. How the six of you work in parallel
 
### 4.1 The rule
 
**Nobody waits for real output from anyone else.** Each person builds against a **frozen contract** and a **stand-in** for the missing piece, and the real piece replaces the stand-in at an integration checkpoint.
 
| Consumer | Needs | Stand-in until the real thing exists | Real thing arrives |
|---|---|---|---|
| FE | API responses | Mock server and JSON fixtures (BE + P6) | Day 8-9 |
| P6 | Ring objects for explanations | Fixture ring objects, one per ring type | Day 9 |
| GR | Transaction data | Toy sample (Day 1) and hand-made graphs, then 500-account sample (Day 2-3) | Full data Day 6 |
| ML-B | Data to build features on | Same toy and 500-account samples | Full data Day 6 |
| BE | Detector, feature, model, explanation functions | Stub functions with the agreed signatures returning fixture-shaped output | Day 7-9 |
| ML-A (evaluation) | Pipeline outputs | Ground truth only, evaluate a trivial baseline first | Day 9 |
 
### 4.2 The five "unlock artifacts" that make parallel work possible
 
These are the only things that must be early. Everything else can be built independently.
 
1. **Day 1, by evening: schema v2 and data file format frozen** (BE with ML-A). Everyone codes against the same column names.
2. **Day 1, by evening: toy sample** (10 accounts, 30 transactions, hand-made, with one tiny ring) by ML-A. Unblocks GR, ML-B, BE loader.
3. **Day 2: API contract (`openapi`) and mock server with fixtures** by BE, fixtures drafted by P6. Unblocks FE and P6.
4. **Day 2-3: 500-account sample with all five ring types** by ML-A. Unblocks realistic detector and feature work.
5. **Day 1: function signatures** for detection, features, model, fusion, explanation (the list in plan.md Section 10.2, updated in the module files). Unblocks BE's stubs.
### 4.3 Hard dependencies (the honest list)
 
True blockers are rare. These are the ones that exist:
 
| This cannot be finished until... | ...this is done | What the person does meanwhile |
|---|---|---|
| Module 11 (pipeline runner, real API) | Module 6 and 7 outputs, Module 9 scores, Module 15 explanations | Builds the runner with stubs; each real function is swapped in as it lands |
| Module 9 (model trained on full data) | Module 4 full dataset (Day 6) | Trains on the 500-account sample; the pipeline code is identical |
| Module 10 (final metrics) | Modules 7, 9 outputs and Module 4 test sets | Builds the harness and tests it on baseline outputs |
| Module 14 (Ring Explorer on real rings) | Module 2 mock server for shape; Module 11 for real data | Builds on fixtures |
| Module 12 stream demo | Modules 6, 7, 11 | Each of its four parts is built separately (see the module) |
| Module 16 metrics tab (real numbers) | Module 10 | Uses placeholder JSON with agreed shape |
 
### 4.4 Integration checkpoints
 
| When | Name | Pass condition | Who must show something |
|---|---|---|---|
| Day 2 end | **Contract check** | Every member runs the repo locally. Mock API serves all endpoints. Toy and 500 sample committed. | All |
| Day 5 | **Integration 1** | Sample data goes load, graph, features without errors. UI shows fixture data. Draft detectors produce hits on the sample. | BE, GR, ML-B, FE |
| Day 9 | **Integration 2** | One command: load active dataset, run pipeline, write database, API serves real rings, dashboard shows them. | All |
| Day 11 | **Integration 3** | Explanations, actions and metrics are live. Stream demo works once end to end. | All |
| Day 13 | **Feature freeze** | Acceptance gate (Section 8) passed. No new features. | All |
| Day 14 | **Dress rehearsal** | Full 3-minute demo, timed, online and offline | All |
 
---
 
## 5. Definitions to fix now (the plan used these terms loosely)
 
- **Account positive:** an account with `true_is_mule = true` (collector, mule or cash-out). Victims are **not** positives.
- **Ring detected (ring recall):** a ground-truth ring counts as found if one predicted ring contains at least 70% of its mule accounts.
- **Ring precision:** share of predicted rings in which at least 70% of accounts are true mule accounts of one ground-truth ring (victims do not count against precision).
- **Time-to-detect:** minutes from the ring's first victim inflow to the moment its ring score first crosses the alert threshold in streaming mode.
- **Amount moved:** total value of ring transactions.
- **Amount cashed:** total value of ring transactions whose destination is a sink account.
- **Amount at risk at time t:** money that has entered ring accounts by time t minus money already cashed out or sent to sinks by time t. This is what could still be stopped.
- **Money saved (simulated):** amount at risk at the moment of the alert, summed over correctly detected rings. State clearly on the slide that it is simulated.
- **Alert reduction:** number of account-level alerts raised by the baseline versus number of ring cases the analyst sees.
- **Precision at K:** of the top K rings in the queue, the share that are real. Report for K = 5, 10.
---
 
## 6. Technical upgrades to the detection and ML plan
 
1. **Fusion weights are tuned, not fixed.** Keep the formula shape from plan.md, but fit the three weights on the validation set and report them.
2. **Neighbour risk uses ML probabilities, never labels,** and is computed in a second pass after first-pass scores.
3. **Leakage traps** (full list in `datasetguide.md`): random account IDs, shuffled order, no round-number tells, overlapping KYC and age distributions. Target: a per-account-only model should be good but clearly beatable (roughly 0.80-0.90 PR-AUC range is believable; 0.99 is a red flag).
4. **Splits:** train, validation and test come from different generator **seeds**, and test also contains **ring parameters never seen in training**. The final numbers come only from test sets, once.
5. **Threshold selection** via an alert budget: pick the threshold that produces a reviewable number of rings per day, and report precision at that budget.
6. **Streaming detection is incremental.** Maintain a sliding window (default 60 min); recompute only accounts touched by new transactions and their neighbours.
7. **Explanations are built from structured facts** (`evidence_json`, `explanation_json`). The optional LLM rewrite only rephrases those facts and is validated: every number in the output must appear in the input facts, otherwise fall back to the template.
8. **Role assignment** (victim, collector, mule, cash-out) is a defined procedure in Module 7 with a unit test per ring type.
9. **Fairness check:** report flag rates by `city_cluster` and `declared_income_band` on hard negatives and normal accounts. One table on one slide.
---
 
## 7. Timeline (15 days) by person
 
Module numbers refer to `modules/`. "(stub)" means building against a stand-in.
 
| Day | BE | FE | GR | ML-A | ML-B | P6 |
|---|---|---|---|---|---|---|
| 1 | M1 Supabase project, migrations 001-005 written, schema review with all | M13 wireframes with P6, scaffold, choose libraries | Read plan; fix function signatures; M6 graph builder on toy | M3 toy sample (evening), start generator core; M4 ring specs | M8 baseline design, feature list, evaluation protocol with ML-A | M15 templates and reason-code dictionary; wireframes; persona |
| 2 | M2 OpenAPI + mock server; M1 push schema, verify | M13 connect to mock API | M6 builder + tests on hand-made graphs | M3 sample500 v0 (normal behaviour); data card v0 | M8 baseline rules on toy | M2 fixtures for every endpoint and ring type |
| 3 | M5 loader (CSV to Postgres with COPY), validation | M13 alert queue | M6 fan-in burst, fan-out split detectors | M4 fan-in/out, pass-through; sample500 v1 | M4 layering + circular templates | M15 explanation engine v1 on fixtures |
| 4 | M5 loaders for gt tables; M11 pipeline runner skeleton (stubs) | M14 Ring Explorer v1 | M6 pass-through and dormant detectors | M4 dormant, hard negatives | M8 volume/flow features | M16 explanation panel UI |
| 5 | **Integration 1.** M11 runner on sample | **Integration 1** | Layering chain detector; **Integration 1** | Difficulty knobs; **Integration 1** | Graph features; **Integration 1** | Case actions UI |
| 6 | M11 `/alerts`, `/rings/{id}`, `/accounts/{id}` | M14 node/edge panels, timeline slider | M6 cycle detector | M4 train_v1, val_v1 (full-size); data card | M9 XGBoost v1 on full data | M16 metrics tab UI with placeholders |
| 7 | M11 `/timeline`, `/metrics`, `/action`, audit log | M14 Play replay | M7 community detection, ring clustering | M10 evaluation harness (on baseline) | M9 SHAP reason codes | M17 deck structure; M15 LLM rewrite with validation |
| 8 | M12b simulation endpoints, polling feed | M13 overview page, KPIs | M7 ring scoring, roles, fingerprints | M4 test sets (new seeds, harder) | M9 neighbour risk, fusion function | M15 review explanation accuracy |
| 9 | **Integration 2.** Real pipeline connected | **Integration 2** real data | **Integration 2**; plug detectors in | M4 demo dataset (curated); **Integration 2** | **Integration 2**; export scores | **Integration 2**; wire explanations |
| 10 | CI, error handling, logging | Layer toggles, performance on big rings | M12a incremental detection | M12c replay and inject-ring function | Held-out evaluation with ML-A | Review explanations vs ring facts; deck draft |
| 11 | **Integration 3.** Caching, pagination | M12d simulation panel | Tune thresholds with ML-B | M10 ablations; M12c done | Tune fusion with GR | **Integration 3**; Q&A document |
| 12 | M1 Docker Compose full stack; offline bundle | UI polish, loading states | False-positive reduction on hard negatives | Robustness curves; stress dataset (500k+) | Calibration; fairness table | Demo script v1; verify competitor slide facts |
| 13 | Load test; deployment | Usability test with 3-5 outsiders | Final detector tests and docs | Final metrics tables and plots | Evaluation report, limitations | Backup demo video; deck revision. **Feature freeze** |
| 14 | README, setup, API docs; deployment check | Final polish; record footage | Technical-depth slide | Results slide | Model slide | **Dress rehearsal x2** |
| 15 | Final deploy check | Buffer | Buffer | Buffer | Buffer | Final rehearsal; submission |
 
---
 
## 8. Acceptance gate for the Day 13 feature freeze
 
All must be true before any stretch goal is touched:
 
- One command runs: load dataset, pipeline, database, API, dashboard.
- At least four ring types detected on the **test** dataset, with recall by type reported.
- Full-fusion beats both baselines on ring recall and on false-positive rate, on test data.
- Hard-negative false-positive breakdown produced.
- Streaming demo runs end to end at least five times in a row without intervention.
- Offline bundle demo works with Wi-Fi off.
- Every endpoint tested; no critical bugs on the demo path.
---
 
## 9. If the deadline is shorter than 15 days
 
Cut in this order (stop cutting when the schedule fits):
 
1. LLM rewrite and Hindi/Telugu (Module 15 level 3).
2. Dark mode, responsive polish, PDF export (keep CSV export).
3. Dormant-activation ring type (keep four types).
4. Incremental detection: replace with "replay pre-computed alerts in time order" (looks identical on stage, far less code).
5. Stress dataset beyond 200k transactions.
6. Calibration and ablation detail (keep the four-method comparison).
Never cut: the baseline comparison, hard negatives, Ring Explorer with replay, the explanation panel, the offline backup.
 
---
 
## 10. Suggestions to win, beyond the solution itself
 
**Story and demo**
1. **Make the clock the hero.** On the alert screen show "First inflow 14:02, alert 14:06, ₹3.1 lakh still recoverable." Time and rupees are what judges remember. Define "recoverable" with the amount-at-risk formula above.
2. **Show the failure of the old way, side by side.** In the demo, show the same ring as 12 unrelated small transfers in a per-account view, then as one ring. One slide or one split-screen, ten seconds.
3. **Let a judge break it.** The "Inject ring" button with a difficulty slider (easy to hard) turns judges into participants. Pre-test all difficulty levels; know which one still gets caught and which one honestly does not, and say so.
4. **One headline number.** For example "412 account alerts reduced to 9 ring cases, with ring recall X% against Y% for per-account rules." Pick the numbers from the final test run, never before.
5. **Fixed seed for the demo.** The demo dataset and injected rings must give identical results on every run. No surprises on stage.
**Credibility**
6. **Be openly honest about limits** (synthetic data, one bank's view, adversaries adapt). Judges trust teams that name their weaknesses before being asked.
7. **Sanity check on a public dataset** if there is time after freeze. Look for a public synthetic AML dataset with laundering patterns (for example the IBM synthetic transactions-for-AML data; verify availability and licence before you claim it). Even a small result on outside data answers "is it just your generator?"
8. **Fairness slide:** flag rates across city clusters and income bands for legitimate accounts.
9. **Cite verified facts only.** Competitor facts in plan.md Section 8 and any statistics on fraud losses must be checked against an official source and dated on the slide. Do not quote a number you cannot link.
 
**Execution**
10. **Judging rubric first.** Get the hackathon's actual scoring criteria and give each criterion a visible moment in the 3-minute demo.
11. **Deployment slide ("what it takes in a real bank"):** inputs needed (transaction feed fields), batch versus stream, where it runs (inside the bank's network), data protection, human approval before any freeze. This answers the most likely hard question.
12. **Rehearse three full times** with a timer, once with Wi-Fi off. Record a backup video on Day 13, not Day 15.
13. **Name and one-page brief.** A memorable product name, one A4 page (problem, approach, result, how to run), a QR code to the repository or the live demo.
14. **Protect the demo path.** After Day 13, anything not on the 3-minute path gets no attention.
15. **Assign a Q&A owner per question** (privacy: BE; detection: GR; model and metrics: ML-A/ML-B; UX: FE; business and policy: P6). The six likely questions are in plan.md Section 13.
 
---
 
## 11. Risks (additions to plan.md Section 14)
 
| Risk | Mitigation |
|---|---|
| Supabase project paused or unreachable | Open it every few days; offline Docker Postgres with identical migrations; nightly dump |
| IPv6-only direct connection fails on your network | Use the session pooler connection string |
| Dataset too easy or too clean | Leakage traps and believability targets in `datasetguide.md`; ML-B reviews the data on Day 3 |
| Ring clustering merges separate rings that share a mule | Generator deliberately includes shared mules (10% of rings); Module 7 has a test for it |
| Analyst cases lost on re-run | Overlap-based case linking (`schema_changes.md` G) |
| Training on victims as mules via feedback view | Fixed in `schema_changes.md` G |
| One module slips and blocks others | Every module lists its stand-in; see `modules/README.md` |
| Sixth person joins late or is non-technical | Split described in Section 2 |
 
---
 
## 12. Working agreements
 
- `main` always runs. Branch per module (`m06-detectors`), PR reviewed by one person, merged same day when possible.
- 15-minute stand-up each day. Each person says: done, doing, **blocked by whom**.
- Any change to the schema, data file format, API contract or function signature: message the group, update the contract file, tag the affected owners. Contract files are the single source of truth.
- Each module owner keeps a short `README` in their folder (what it does, how to run, known gaps).
- Datasets and large files are **not** committed to git; they go in the shared storage folder. Only the toy sample and fixtures live in the repository.
 
