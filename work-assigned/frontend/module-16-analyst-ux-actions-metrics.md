# Module 16: Analyst UX: Explanation Panel, Case Actions, Metrics Tab

**Owner:** FE. **Backup:** BE. **Days:** 4-8. See `plan.md` Section 6.3 and `plan_v2.md` Section 2.

## Goal
Deliver the operational decision cockpit where financial crime analysts read case narratives, execute definitive enforcement actions (freeze accounts, escalate, log audit notes), and inspect model validation benchmarks.

## Inputs
OpenAPI contract from Module 2, explanation schema from Module 15, evaluation metrics and artifacts from Module 10.

## Deliverables
1. **Explanation & Case Narrative Panel (`/rings/{ring_id}`)**:
   - Institutional SAR-style layout placed adjacent to the Ring Explorer canvas:
     - **Executive Finding Card**: One-sentence core anomaly summary with severity badge.
     - **Key Evidence Facts**: Bulleted list of factual statements with highlighted bold metrics (e.g. "**₹4,85,000** received from **18 victim accounts** within **34 minutes**").
     - **Typology Pattern Pills**: Badges indicating active typologies (`Rapid Pass-Through`, `Structural Cycle`, etc.).
     - **Recommended Enforcement Action**: Clear callout box with suggested intervention.
2. **Case Action Cockpit (`POST /rings/{ring_id}/action`)**:
   - Prominent action buttons with confirmation modals:
     - 🛑 **Freeze Ring Accounts**: Simulates placing immediate debit/credit freezes on all collector and mule accounts (explicitly sparing victim accounts).
     - ⚠️ **Escalate to Senior AML**: Opens escalation dialog to assign supervisor and set priority flag.
     - 📝 **Add Case Note**: Rich text input allowing investigators to log hypotheses and findings.
     - ✕ **Mark False Positive**: Requires selecting a structured reason (e.g., "Legitimate Merchant Pooling", "Payroll Disburser", "Family Transfer").
   - **Immutable Audit Trail Table**:
     - Lists all actions from `case_actions` for the active case: Timestamp (UTC), Actor Name/ID, Action Type badge, From Status -> To Status transition, and Analyst Notes.
     - Optimistic UI updates with instant notification toasts and table re-render.
3. **Model & Metrics Tab (`/metrics`)**:
   - Executive Model Benchmark Dashboard:
     - **Top Metric Cards**: Precision, Recall, F1-Score, PR-AUC, Ring Recall (@ 70% threshold), False Positive Rate.
     - **The Four-Way Comparison Bar Chart**:
       - Compares: (1) Baseline Rules, (2) Graph Rules, (3) Tabular ML Only, (4) TraceMesh Full Fusion.
       - Clearly highlights the performance gap TraceMesh closes.
     - **Interactive Precision-Recall & ROC Curves**: Interactive charts rendered from coordinates stored in `metric_artifacts`.
     - **Operational Impact Card**: "Alert Reduction: 412 account alerts consolidated into 9 actionable ring cases (97.8% operational efficiency gain)."
     - **Typology & Difficulty Breakdown Matrix**: Performance breakdown across the five ring archetypes and difficulty tiers (Easy / Medium / Hard).
     - **Fairness & Bias Table**: False positive rates across City Clusters and Declared Income Bands confirming model fairness.

## Schedule
- Day 4: Explanation panel typographic layout and entity-highlight styling.
- Day 5: Action modal dialogs, status transition workflows, optimistic UI state.
- Day 6: Metrics tab layout, Recharts integration, and placeholder JSON parsing.
- Day 7: Connect actions and audit trail to live backend `/action` and `/cases/{id}/actions` endpoints.

## Can start when
Day 4. Mock endpoints and JSON fixtures from Module 2 enable complete UI construction.

## Hard dependency
Metrics tab requires finalized numbers from Module 10 (Day 13) for final display; works with static placeholders prior to that.

## Stand-in while blocked
Module 2 JSON fixtures and static mock metrics data.

## Blocks others
Module 17 live demo script and presentation walkthrough.

## Done when
An investigator can review an auto-generated narrative, click "Freeze Ring Accounts", see the case status immediately switch to `frozen`, verify the immutable audit entry appended to the log, and switch to the Metrics tab to demonstrate quantitative superiority over baselines.

