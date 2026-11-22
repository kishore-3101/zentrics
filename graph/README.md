# TraceMesh Graph Engine

Production Financial Intelligence Graph Engine for detecting money mule accounts, complex laundering chains, and organized financial crime rings.

---

## 1. Architecture Overview

The `graph/` system provides graph construction, pattern detection, community clustering, and streaming graph updates:

```
graph/
├── construction/          # MultiDiGraph builder, NodeManager, EdgeManager
├── detection/             # 6 Explainable Detectors + DetectorEngine
├── ring_analysis/         # Louvain community clustering, role assignment, financial exposure
├── streaming/             # IncrementalBuilder, SlidingWindowManager, EventProcessor, AlertLifecycle
├── visualization/         # GraphSerializer, 3D coordinate layout, node/edge visual decorators
├── evaluation/            # Precision, Recall, F1, and performance profilers
├── shared/                # Schemas, constants, and utilities
├── config/                # Central thresholds and parameters
└── tests/                 # Unit, integration, and streaming test suites
```

---

## 2. Implemented Pattern Detectors

Every detector operates on directed, timestamped transaction multigraphs and produces structured, explainable evidence:

1. **Fan-In Burst (`fan_in_burst`)**: Detects rapid aggregation of incoming funds from multiple distinct senders into a collector account within rolling time windows.
2. **Fan-Out Split (`fan_out_split`)**: Identifies rapid dispersal of funds to multiple distinct receivers.
3. **Rapid Pass-Through (`rapid_pass_through`)**: Identifies transit accounts receiving funds and forwarding $\ge 80\%$ onward within minutes (median $< 15$ min).
4. **Layering Chain (`layering_chain`)**: Detects multi-hop directed laundering paths ($3\text{--}6$ hops) with amount similarity ($\pm 20\%$) and chronological ordering.
5. **Circular Flow (`circular_flow`)**: Discovers directed transaction cycles of length $3\text{--}5$ returning to origin within 24 hours without inappropriately converting to a DAG.
6. **Dormant Activation (`dormant_activation`)**: Catches accounts reactivated after $\ge 60$ days of dormancy with high-volume transaction bursts.

---

## 3. Ring Analysis & Role Assignment

- **Community Detection**: Partitions suspicious subgraphs using Louvain modularity optimization.
- **Shared-Mule Disambiguation**: Uses articulation-point analysis to separate independent rings bridging at a shared mule account without corrupting topologies.
- **Forensic Role Assignment**:
  - `victim`: Low-risk inflow source from outside the ring.
  - `collector`: Inflow aggregation hub receiving funds from multiple senders.
  - `mule`: Intermediary transit node in layering chains or circular flows.
  - `cash_out`: Terminal withdrawal point (ATM, merchant sink, or zero internal out-degree).
- **Financial Exposure**:
  - $\text{Amount Moved}$: Total internal transactional volume.
  - $\text{Amount Cashed}$: Volume drained to cash-out sinks.
  - $\text{Amount at Risk} = \max(0, \text{Amount Moved} - \text{Amount Cashed})$.
  - $\text{Priority Index} = \text{Ring Score} \times \text{Amount at Risk}$.

---

## 4. How to Run

### Run Graph Engine Tests
```powershell
python -m pytest graph/tests -v
```

### Run End-to-End Evaluation on the 30k Dataset
```powershell
python -c "
import pandas as pd
from graph.construction.graph_builder import GraphBuilder
from graph.detection.detector_engine import DetectorEngine
from graph.ring_analysis.ring_extraction import RingExtractor
from graph.evaluation.detector_evaluation import evaluate_detector_performance
from graph.evaluation.ring_evaluation import evaluate_ring_performance

txns_df = pd.read_csv('datasets/transactions.csv')
accounts_df = pd.read_csv('datasets/accounts.csv')
fraud_rings_df = pd.read_csv('datasets/fraud_rings.csv')

builder = GraphBuilder()
G = builder.build_from_dataframes(txns_df, accounts_df)
engine = DetectorEngine()
hits = engine.run_all(G)
scores = engine.compute_account_rule_scores(hits)
susp_accounts = {a for a, s in scores.items() if s >= 0.70}
account_risks = {a: round(s * 100.0, 1) for a, s in scores.items()}

extractor = RingExtractor()
rings = extractor.extract_rings(G, susp_accounts, hits, account_risks, builder.node_manager.sink_accounts)
print(f'Rings discovered: {len(rings)}')
print('Evaluation:', evaluate_ring_performance(rings, fraud_rings_df, accounts_df))
"
```

### Start the Backend Service
```powershell
python -m backend.mock_server
```
Endpoints exposed on port `8000`:
- `GET /health`
- `GET /overview`
- `GET /alerts`
- `GET /rings/{id}`
- `GET /rings/{id}/timeline`

### Start the Frontend Application
```powershell
cd frontend
npm run dev
```
Navigate to `http://localhost:5173` to explore:
- **Ring Explorer**: 3D interactive force/orbit graph topology with role color coding, Bezier curves, and timeline replay.
- **Alert Queue**: Ranked alerts sorted by financial priority and composite risk score.
- **Overview Dashboard**: System-wide exposure and top critical rings.
