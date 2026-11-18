# TraceMesh Module 7: Community Detection & Ring Clustering

Identifies groups of suspicious accounts forming coordinated mule networks, handles shared mules, scores rings, and assigns forensic compliance roles.

## Features
- **Suspicious Subgraph Extraction**: Focuses computation on high-risk accounts, detector hit transactions, and boundary counterparties.
- **Shared-Mule Separation**: Graph-theoretic articulation point analysis prevents incorrect merging of independent rings that share a common mule.
- **Forensic Role Assignment**: Categorizes participants into `victim`, `collector`, `mule`, and `cash_out`.
- **Financial Risk Metrics**: Computes total amount moved, amount cashed out, and actual amount at risk without double-counting.
- **Explainable Ring Scoring**: Integrates mean/max member risk, amount factors, transaction speed, and pattern diversity into a $0-100$ score.
- **Deterministic Fingerprinting**: SHA-1 hashing of sorted member accounts for stable case tracking.

## Quick Start
```python
from module_7_community_ring_clustering import cluster_rings

rings = cluster_rings(graph, account_scores, hits)
for ring in rings:
    print(f"Ring {ring.ring_id}: Score={ring.score}, Priority={ring.priority}, Action={ring.recommended_action}")
```

## Testing
```bash
python -m pytest tests/test_module_7_clustering.py -v
```
