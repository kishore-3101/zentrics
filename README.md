# TraceMesh: Fraud Ring Detection System (Modules 6, 7 & 12a)

TraceMesh is a scalable graph-intelligence backend for detecting coordinated mule-account rings, money-laundering layering chains, and suspicious fund velocity.

This package contains the fully tested, production-grade implementations of **Module 6**, **Module 7**, and **Module 12a**, complete with interactive **Streamlit + PyVis Graph Visualizations**, an end-to-end benchmark pipeline, and a strictly decoupled **Ground-Truth Evaluation Module**.

---

## Architecture Flow

```text
Transaction Stream / Batch CSV
               │
               ▼
   Module 6: Graph Builder
  (NetworkX MultiDiGraph, Preserves Parallel Txns, Sinks & Time Windows)
               │
               ▼
   Module 6: Six Rule Detectors
  (Fan-in, Fan-out, Rapid Pass-through, Layering Chain, Circular Flow, Dormant)
               │
               ▼
      Explainable Rule Scores
  (Noisy-OR Formulation in [0.0, 1.0], Anti-inflation)
               │
               ▼
   Module 7: Community Detection & Ring Clustering
  (Suspicious Subgraph, Balanced Shared-Mule Separation, Role Assignment)
               │
               ▼
       Ranked Ring Candidates
  (Score, Priority = Score x Amount-at-Risk, Forensic Roles, Fingerprints)
               │
               ▼
   Module 12a: Incremental Sliding-Window Detection
  (60-minute Temporal Window, Out-of-Order Handling, Dynamic Expiration,
   1-to-2 Hop Neighborhood Re-evaluation, < 2 ms / txn Latency)
               │
               ▼
   Ground-Truth Evaluation (Zero Data Leakage)
  (Precision, Recall, F1, FPR, Ring Topology Jaccard Match, Role Compatibility)
               │
               ▼
   Interactive Graph Dashboard (Streamlit + PyVis)
  (Overview, Network MultiDiGraph, Ring Explorer, Detectors, Account 360, Live Replay)
```

---

## Repository Structure

```text
TraceMesh_Final/
│
├── datasets/                            # Complete original datasets (30,000 rows each)
│   ├── accounts.csv                     # Account profiles, types, KYC, balances
│   ├── transactions.csv                 # Transactions, timestamps, amounts, statuses
│   ├── account_daily_summary.csv        # Historical daily aggregates & counts
│   └── fraud_rings.csv                  # Ground-truth ring metadata (evaluation only)
│
├── module_6_graph_builder_detectors/    # Module 6: Graph Builder & 6 Detectors
│   ├── detectors/
│   │   ├── fan_in_burst.py              # Detector 1: Fan-in fund aggregation
│   │   ├── fan_out_split.py             # Detector 2: Fan-out fund dispersal
│   │   ├── rapid_pass_through.py        # Detector 3: Rapid pass-through transit
│   │   ├── layering_chain.py            # Detector 4: Multi-hop layering chain
│   │   ├── circular_flow.py             # Detector 5: Directed transaction cycles (3-5 hops)
│   │   └── dormant_activation.py        # Detector 6: Strict continuous calendar dormancy
│   ├── graph_builder.py                 # MultiDiGraph builder & window presets
│   ├── orchestrator.py                  # Detector runner & Noisy-OR rule scorer
│   └── README.md
│
├── module_7_community_ring_clustering/  # Module 7: Ring Clustering & Roles
│   ├── clustering.py                    # Deterministic clustering, balanced shared-mule separation, roles, scoring
│   └── README.md
│
├── module_12_incremental_sliding_window/# Module 12a: Incremental Streaming
│   ├── sliding_window.py                # 60-min window manager, watermark, edge eviction, duplicate tracking
│   ├── incremental_engine.py            # Localized 1-2 hop re-evaluator, alert lifecycle (deactivation/reactivation)
│   └── README.md
│
├── evaluation/                          # Ground-Truth Evaluation (Decoupled stage)
│   ├── evaluator.py                     # GroundTruthEvaluator: Precision, Recall, F1, Jaccard, Roles
│   └── README.md
│
├── visualization/                       # Interactive Streamlit + PyVis Visualizer
│   ├── app.py                           # Dashboard entrypoint with navigation router
│   ├── components/
│   │   ├── data_loader.py               # Robust relative dataset loader & caching
│   │   ├── filters.py                   # Subgraph filters (amounts, risk tiers, node caps)
│   │   ├── graph_renderer.py            # PyVis directed multigraph HTML generator
│   │   └── metrics.py                   # Plotly charts (risk distributions, timelines)
│   └── pages/
│       ├── overview.py                  # Page 1: High-level KPI cards and typologies
│       ├── transaction_network.py       # Page 2: Filterable interactive directed multigraph
│       ├── ring_explorer.py             # Page 3: Candidate ring topologies and roles
│       ├── detector_visualization.py    # Page 4: Suspicious subgraphs for each detector
│       ├── account_investigation.py     # Page 5: 360-degree forensic account ego-network
│       └── incremental_graph.py         # Page 6: Live streaming transaction replay
│
├── shared/                              # Shared contracts, models & utilities
│   ├── models.py                        # Hit, RingCandidate, AlertEvent dataclasses
│   ├── config.py                        # Configuration loader with fallback defaults
│   └── utils.py                         # Fingerprint hashing, timestamp parsers, currency formatting
│
├── config/                              # Centralized YAML configuration
│   └── detection_config.yaml            # All thresholds, weights, window sizes
│
├── docs/                                # Technical design & reference documents
│   ├── detectors.md                     # Module 6 specification & hit schema
│   ├── ring_clustering.md               # Module 7 clustering & balanced shared mule strategy
│   ├── incremental_detection.md         # Module 12a streaming architecture & latency
│   └── evaluation.md                    # Ground-truth evaluation methodology & limitations
│
├── tests/                               # Comprehensive unit, edge-case & integration tests (47 tests)
│   ├── test_module_6_detectors.py       # Module 6 tests (positive, negative, strict continuity, coexistence, NaNs)
│   ├── test_module_7_clustering.py      # Module 7 tests (shared-mule, roles, permutation determinism)
│   ├── test_module_12_incremental.py    # Module 12a tests (streaming, lifecycle, controlled streams, expiration)
│   ├── test_evaluation.py               # Ground-truth evaluation metrics, full population scope & 1-to-1 matching
│   ├── test_visualization.py            # Dashboard unit tests (colors, filters, html generation)
│   └── test_integration.py             # End-to-end integration test
│
├── requirements.txt                     # Python package dependencies
├── run_pipeline.py                      # Reproducible end-to-end benchmark and evaluation runner
├── test_report.md                       # Comprehensive test execution & benchmark report
├── .gitignore                           # Git ignore rules
└── README.md                            # Main project overview
```

---

## Installation & Setup

1. **Python Requirement**: Python 3.10+ (tested and verified on Python 3.12.10).
2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

---

## Running the Complete System

### 1. Run Automated Tests
Execute the full automated test suite (47 unit, edge-case, regression, and integration tests across all modules):
```bash
python -m pytest tests/ -v
```

### 2. Run End-to-End Pipeline & Evaluation Benchmark
Execute the complete pipeline against all 4 datasets in `datasets/`:
```bash
python run_pipeline.py
```

### 3. Launch the Interactive Dashboard
Launch the multi-page Streamlit dashboard:
```bash
streamlit run visualization/app.py
```
Open `http://localhost:8501` in your browser to explore the six interactive forensic investigation pages.
