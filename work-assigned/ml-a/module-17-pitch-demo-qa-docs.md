# Module 17: Pitch, Demo Script, QA, Docs

**Owner:** BE (lead, deck, docs) + ML-A (Q&A defense, evaluation metrics) + FE (live stage demo operator). **Backup:** All. **Days:** 7-15. See `plan.md` Section 14 and `plan_v2.md` Sections 2 and 7.

## Goal
Design, script, rehearse, and execute an irresistible 3-minute hackathon pitch and live product demonstration, supported by bulletproof judge Q&A defenses, a contingency backup video, and polished repository documentation.

## Inputs
Final benchmark metrics from Module 10, running TraceMesh platform from Integration 2 & 3, competition evaluation guidelines.

## Deliverables
1. **The 3-Minute Winning Pitch Deck (10-12 slides)**:
   - **Slide 1: The Blindspot**: Mule accounts are the circulatory system of financial crime; traditional bank rules monitor single accounts in silos and miss network collusion completely.
   - **Slide 2: The Operational Crisis**: AML teams drown in thousands of daily alerts with a 95%+ false-positive rate; alert fatigue allows real fraud rings to siphon money out of the bank.
   - **Slide 3: TraceMesh Solution**: The first unified hybrid graph-ML platform that detects multi-hop mule rings, clusters coordinated syndicates, and explains network guilt in plain English.
   - **Slide 4: Technical Architecture**: End-to-end flow from Postgres transaction stream -> Directed Multigraph -> 6 Structural Anomaly Detectors -> Feature Engineering -> XGBoost/SHAP Inference -> Graph Neighbor Contagion -> Score Fusion -> Ring Clustering.
   - **Slide 5: The 5 Mule Ring Archetypes**: Visual diagram showcasing Fan-in/out, Rapid Pass-through Hubs, Dormancy Activation, Layering Chains, and Circular Flows.
   - **Slide 6: Quantitative Proof (The Four-Way Comparison)**: Unmistakable chart showing TraceMesh Fusion outperforming Single-Account Rules, Graph Rules, and Tabular ML across PR-AUC, F1, and Ring Recall.
   - **Slide 7: Quantified Business Value**:
     - *Alert Reduction*: 412 fragmented alerts compressed into 9 coordinated cases (97.8% analyst triage reduction).
     - *Simulated Funds Protected*: ₹X Lakhs intercepted before ATM cash-out.
     - *Time-to-Detect*: Reduced from 48 hours to under 25 minutes.
   - **Slide 8: Live Product Demonstration** (stage transition).
   - **Slide 9: Responsible AI & Algorithmic Fairness**: Quantitative proof showing zero disparate impact across income bands or city tiers; deterministic hallucination guards on LLM summaries.
   - **Slide 10: Production Readiness**: Built on Supabase Postgres, FastAPI, React/Cytoscape, sub-second incremental scoring, containerized with offline Docker bundle.
2. **Timed 3-Minute Live Stage Demo Script**:
   - **0:00 - 0:40 (The Problem & Overview)**: Start on the Executive Overview. Point to the Alert Reduction metric: "TraceMesh just turned 412 isolated false alarms into 9 high-confidence ring investigations."
   - **0:40 - 1:30 (Alert Queue to Ring Explorer)**: Open the Alert Queue. Click on Ring `#R-104` (Circular Flow). The Ring Explorer opens. Show the network canvas: "Here you see 5 accounts passing ₹5,00,000 in a closed circle across 3 laps, decaying by 3% each hop to disguise origin."
   - **1:30 - 2:00 (Timeline Replay & Roles)**: Click "Play" on the timeline replay. Point to the moving pulse particles: "Watch as victims deposit funds, the aggregator splits money among mules, and funds head toward an ATM sink. Notice our automated role classification: victims are protected, while mules are highlighted in red."
   - **2:00 - 2:30 (Explainability & Immediate Action)**: Open the Explanation Panel. Show the plain-English narrative: "An auditor doesn't need to read code — every number is mathematically backed. Watch me click 'Freeze Ring Accounts'. All mule accounts are immediately frozen, while legitimate victims remain unaffected."
   - **2:30 - 3:00 (Live Stream Simulation & Closing)**: Jump to the Simulation bar. Hit "Inject Ring". Within 2 seconds, a new alert appears via delta polling. "TraceMesh detects emerging rings in real time. We don't just find fraud; we stop it before the cash leaves the bank."
3. **Judge Q&A Defense Master Sheet (`docs/judges_qa.md`)**:
   - Detailed answers with statistical backing for top hard questions:
     - *Q: Did your model cheat on synthetic data?* (A: Explain separate GT tables, 3% label noise, disjoint seed splits, and single-feature leakage checks <0.75 AUC).
     - *Q: How do you avoid flagging high-volume merchants like kirana stores or payroll?* (A: Show hard-negative evaluation on shops, payroll, landlords; explain why directional asymmetry and retention ratios prevent false alarms).
     - *Q: Isn't cycle search NP-hard? How does this scale?* (A: Restricted to 3-5 hops, 24h temporal windows, and pre-filtered suspicious multigraphs, executing in under 400ms on 250k transactions).
     - *Q: Why not use a Graph Neural Network (GNN)?* (A: Tabular-graph hybrid with XGBoost and SHAP gives 100% regulatory interpretability, deterministic auditability, and sub-second incremental evaluation without GPU dependency).
4. **Contingency Demo Video & Offline Package**:
   - High-definition screen capture with audio walkthrough of the complete demo workflow stored locally.
   - Zero-dependency offline bundle running locally via Docker Compose with Wi-Fi disabled.

## Schedule
- Day 7: Slide deck narrative structure and visual asset gathering.
- Day 10: First draft of 3-minute demo script synchronized with working UI.
- Day 11: Comprehensive Q&A defense document compiled and reviewed with team.
- Day 12: Stage dry runs; offline Docker fallback verification.
- Day 13: Final evaluation metrics plugged into slides; backup video recorded.
- Day 14: **Dress Rehearsal** under realistic presentation conditions (timer, disconnected network).
- Day 15: Hackathon presentation and judging Q&A.

## Can start when
Day 7. Presentation storyline, market context, and script structuring start early.

## Hard dependency
Final benchmark numbers from Module 10 on Day 13.

## Stand-in while blocked
Mock screenshots and estimated metric placeholders.

## Done when
The slide deck is locked, the 3-minute demo runs smoothly within 175-180 seconds, the offline backup video is ready on a USB drive, and every team member is prepared to answer technical judge questions with precision.

