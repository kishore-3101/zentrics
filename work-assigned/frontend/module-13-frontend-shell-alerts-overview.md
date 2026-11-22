# Module 13: Frontend Shell, Alert Queue, Overview

**Owner:** FE. **Backup:** BE. **Days:** 1-8. See `plan.md` Section 6 and `plan_v2.md` Section 7.

## Goal
Build the production frontend application shell, top-level navigation, executive overview dashboard, and the primary operational alert queue for fraud investigators.

## Inputs
`openapi` contract and JSON fixtures from Module 2, initial wireframes agreed with BE on Day 1.

## Deliverables
1. **Application Shell & Navigation**:
   - Modern React framework (Vite + TypeScript + Tailwind CSS / shadcn/ui).
   - Global layout with responsive sidebar:
     - 📊 Executive Overview (`/overview`)
     - 🚨 Alert Queue (`/alerts`)
     - 🕸️ Ring Explorer (`/rings/:id`)
     - 📈 Models & Evaluation (`/metrics`)
     - 📋 Compliance Audit Log (`/audit`)
   - Header with active environment badge (`DEMO` / `LOCAL`), API connection health indicator, and the Simulation Control bar (Module 12d).
2. **Executive Overview Dashboard (`/overview`)**:
   - 4 Top-line KPI Cards:
     - **Total Money at Risk**: formatted currency (₹ Lakhs/Crores).
     - **Active Mule Rings**: count of rings detected in the current run.
     - **Simulated Money Saved**: calculated prevention value with clear simulation subtitle.
     - **Alert Reduction Factor**: e.g., "97.8% Reduction (412 alerts grouped into 9 actionable rings)".
   - Trend Chart: Alert volume over time segmented by ring type.
   - Typology Breakdown: Visual distribution donut chart (Fan-in/out, Layering, Circular, Pass-through, Dormant).
   - Top 5 Critical Rings Table: Quick-action triage table with direct links to the Ring Explorer.
3. **Alert Queue (`/alerts`)**:
   - High-density tabular triage interface consuming `v_alerts`:
     - Columns: Priority Score (color-coded bar), Ring ID, Typology Badge, Score (0-100), Amount at Risk, Total Moved, Accounts Involved, Duration, Status Pill (`new`, `under_review`, `frozen`, `escalated`, `false_positive`), Assignee Avatar, Detected Timestamp.
     - Multi-faceted filters: Ring Type select, Status multi-select, Minimum Risk Score slider, Amount Range, Date filter.
     - Sorting: Priority DESC (default), Risk Score DESC, Amount at Risk DESC, Detected Time DESC.
     - Live Delta Polling Integration: periodically checks `since_event_id` and prepends incoming rings with a green highlight animation.
     - Row Click: navigates to `/rings/{ring_id}` in the Ring Explorer.
4. **Shared Component Library**:
   - Risk score meters, status badges, currency formatters, relative time formatters, empty states, and loading skeletons.

## Schedule
- Day 1: Wireframes and design tokens agreed with BE; Vite + React + Tailwind setup.
- Day 2: Connect shell to Module 2 mock server; verify end-to-end data fetching.
- Day 3: Alert queue table layout, custom column formatters, status badge components.
- Day 4: Multi-filter engine, client-side pagination, search bar.
- Day 6: Switch API client from mock server to backend real `/alerts` endpoint.
- Day 8: Overview page KPI cards, Recharts / Chart.js visualizations, top-5 critical rings widget.

## Can start when
Day 1. Wireframes and component scaffolding require no external dependencies.

## Hard dependency
Switching to live data requires Module 2 mock server on Day 2 and BE real API on Day 6.

## Stand-in while blocked
Static JSON fixtures provided by Module 2.

## Blocks others
Module 14 (Ring Explorer) and Module 16 (Analyst Actions) mount inside this application shell.

## Done when
Frontend compiles cleanly with zero TypeScript errors, renders KPI charts smoothly, supports instant filtering across hundreds of alerts, and handles both mock and live API backends via `.env` configuration.

