# Module 14: Ring Explorer (Graph, Panels, Replay)

**Owner:** FE. **Backup:** BE. **Days:** 4-10. See `plan.md` Section 6.2 and `plan_v2.md` Section 4.

## Goal
Build the centerpiece of the live hackathon presentation: an interactive network graph canvas illustrating mule ring topology, account role assignments, and a scrubbable timeline replay showing illicit money movement.

## Inputs
`openapi` contract and ring JSON fixtures from Module 2, graph schemas from Module 6 & 7, endpoints `/rings/{id}` and `/rings/{id}/timeline` from Module 11.

## Deliverables
1. **Interactive Graph Canvas (Cytoscape.js, React Flow, or G6)**:
   - High-performance directed multigraph rendering of the selected mule ring.
   - **Node Visualization by Role**:
     - *Victim*: Blue / Green node with shield/user icon.
     - *Collector*: Amber / Orange node indicating aggregation point.
     - *Mule*: Red node indicating intermediary pass-through.
     - *Cash-Out Sink*: Purple / Dark Red square/hex node representing ATM or external bank sink.
     - Node badge: Displaying account ID prefix and fused risk score.
   - **Edge Visualization by Transaction**:
     - Directed curved arrows indicating payment direction.
     - Edge stroke weight proportional to transaction amount.
     - Channel badge on hover (UPI / IMPS / NEFT / ATM).
   - Layout Engine: Force-directed / hierarchical DAG layout with sticky node dragging, zoom, pan, and "Fit to Screen" controls.
2. **Account & Edge Inspector Drawer**:
   - Clicking any node opens a right-hand slide-out drawer:
     - Account ID, Opening Date, Account Type, KYC Level, City Cluster, Declared Income Band.
     - Fused Risk Gauge (0-100) with visual breakdown (ML Prob, Rule Score, Neighbor Risk).
     - SHAP Reason Codes: pill badges showing top contributing factors (e.g. `+24.5 High Inflow Velocity`, `+18.2 Dormancy Jump`).
     - Rule hit history with timestamps.
   - Clicking an edge displays: Transaction ID, Timestamp, Amount, Channel, and Hop Delay from previous transaction.
3. **Timeline Playback Engine (`/rings/{ring_id}/timeline`)**:
   - Scrubbable time slider positioned at the bottom of the canvas spanning from first victim deposit to final cash-out.
   - Play / Pause button with speed multiplier toggles (1x, 2x, 5x, 10x).
   - Dynamic step-by-step animation:
     - As the timeline advances, edges light up sequentially with a glowing pulse particle effect representing money transit.
     - Nodes illuminate as they receive funds and fade to settled state once funds are forwarded.
     - Dynamic running balance counters: "Total Inflow", "Amount Cashed Out", and "Amount at Risk" update dynamically in real time.
4. **Ring Header & Pattern Tags**:
   - Ring ID, Typology label, Priority score bar, Total Moved (₹), Amount at Risk (₹), Duration, and Pattern Badges (`#rapid_pass_through`, `#structural_cycle`, `#burst_fanin`).

## Schedule
- Day 4: Canvas setup, graph rendering engine integration, layout algorithm testing with static fixtures.
- Day 5: Role-based styling, custom SVG node markers, and edge arrow designs.
- Day 6: Account inspector slide-out drawer, SHAP reason codes display, edge inspector popovers.
- Day 7: Timeline slider bar, chronological event sequencer, play/pause controls.
- Day 9: **Integration 2** — bind canvas to live backend `/rings/{id}` and `/timeline` endpoints.
- Day 10: Canvas performance optimization: handling rings with 50+ accounts (sub-clustering victim nodes if necessary), smooth zoom animations.

## Can start when
Day 4. Uses Module 2 mock endpoints and ring fixtures.

## Hard dependency
Real backend data integration on Day 9 (Module 11).

## Stand-in while blocked
Module 2 JSON fixtures covering all five ring typologies and mixed topologies.

## Blocks others
Analyst action verification (Module 16) and live demo rehearsals (Module 17).

## Done when
An investigator can open any ring from the alert queue, immediately comprehend the network topology, click accounts to view verifiable risk reason codes, and press Play to witness funds flowing from victims through mules into ATM cash-out sinks.

