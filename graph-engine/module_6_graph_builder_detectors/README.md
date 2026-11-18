# TraceMesh Module 6: Graph Builder & Rule Detectors

Builds a directed, weighted, timestamped transaction multigraph and executes six explainable rule-based suspicious activity detectors.

## Features
- **NetworkX MultiDiGraph**: Directed multigraph preserving parallel transactions with transaction IDs as edge keys.
- **Configurable Time-Window Filtering**: Subgraph extraction supporting `10m`, `1h`, `24h`, and `7d` presets or custom ranges.
- **Six Rule Detectors**:
  1. `fan_in_burst`: Rapid fund aggregation from multiple senders.
  2. `fan_out_split`: Rapid fund dispersion to multiple recipients.
  3. `rapid_pass_through`: Inbound funds forwarded with minimal holding delay.
  4. `layering_chain`: Multi-hop transfer chains ($3-6$ hops) with amount similarity.
  5. `circular_flow`: Directed fund routing cycles ($3-5$ accounts) within 24 hours.
  6. `dormant_active`: Sudden high-volume transaction bursts on previously dormant accounts.
- **Explainable Rule Scoring**: Normalized Noisy-OR combination producing scores in $[0, 1]$ per account.

## Quick Start
```python
import pandas as pd
from module_6_graph_builder_detectors import build_graph, run_detectors, rule_scores

accounts = pd.read_csv("accounts.csv")
transactions = pd.read_csv("transactions.csv")

graph = build_graph(accounts, transactions)
hits = run_detectors(graph)
scores = rule_scores(hits)
```

## Testing
```bash
python -m pytest tests/test_module_6_detectors.py -v
```
