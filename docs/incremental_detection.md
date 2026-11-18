# TraceMesh Module 12a: Incremental Sliding-Window Detection

## Overview
Module 12a provides a high-throughput, low-latency stream processing engine designed for live simulations and real-time transaction monitoring. Rather than rebuilding the transaction graph from scratch on every incoming event, it maintains a temporal sliding window in memory, dynamically expires aged transactions, and re-evaluates only the touched accounts and their immediate neighborhood.

---

## 1. Sliding Window Architecture

```text
Incoming Transaction Event
            │
            ▼
┌──────────────────────────────────────────────┐
│        SlidingWindowGraphManager             │
│                                              │
│  • Deduplication via seen_txn_ids            │
│  • Watermark clock progression               │
│  • Expiration: cutoff = watermark - 60 min   │
│  • In-memory MultiDiGraph update             │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│        IncrementalDetectorEngine             │
│                                              │
│  • Extract Touched Neighborhood (radius=2)   │
│  • Localized Subgraph Extraction             │
│  • Local Detector Re-evaluation              │
│  • Incremental Rule Re-scoring               │
│  • Ring Candidate & Alert State Tracking     │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
              Structured AlertEvent
   (new_alert / alert_updated / monitored)
```

---

## 2. Sliding Window Management (`SlidingWindowGraphManager`)

### Core Features
- **Temporal Window**: Default 60 minutes (configurable via `config/detection_config.yaml`).
- **Watermark Mechanism**: Tracks maximum event timestamp seen. Automatically purges transactions where $\text{timestamp} < \text{watermark} - \Delta t$.
- **Idempotency**: Duplicate transaction IDs are safely rejected with zero side-effects.
- **Out-of-Order Handling**: Transactions arriving out of sequence within the active 60-minute window are correctly inserted into the chronological timeline.
- **Edge Eviction**: Expired edges are cleanly removed from the NetworkX graph, keeping in-memory footprints strictly bounded.

---

## 3. Incremental Localized Detection

When a transaction $(u, v)$ arrives:
1. **Touched Accounts**: $\{u, v\}$.
2. **Evaluation Radius**: Expands to $k=2$ hops:
   $$N_k(u, v) = \{u, v\} \cup \text{predecessors}_k(u, v) \cup \text{successors}_k(v, u)$$
   A 2-hop radius is mathematically necessary and sufficient to identify multi-hop patterns (e.g. 3-hop layering chains and 3-node circular loops) without scanning the rest of the 30,000-node graph.
3. **Localized Subgraph Execution**: Detectors run solely on the induced subgraph of $N_k(u, v)$.
4. **Cache Updates**: Incremental hits and scores are refreshed only for evaluated accounts.

---

## 4. Alert Lifecycle and Deduplication

The engine tracks ring candidate states across streaming events:
- **`new_alert`**: Emitted when a newly formed ring candidate crosses the alert score threshold ($\ge 50.0$).
- **`alert_updated`**: Emitted when an existing active ring experiences significant score shifts ($\ge 5.0$) or newly added transactions.
- **`monitored`**: Normal transactions or rings below the alert threshold.
- **Duplicate Suppression**: Repeated events within identical or unchanged rings do not flood compliance queues with redundant alerts.

---

## 5. Performance Characteristics

Benchmarked on the official TraceMesh transaction dataset:
- **Average Event Latency**: $0.75$ ms per transaction.
- **p95 Latency**: $1.31$ ms per transaction.
- **Active Memory**: Bounded to active 60-minute window (typically $500-1,000$ active nodes and edges).
- **Throughput**: $> 1,200$ transactions per second on single core Python.
