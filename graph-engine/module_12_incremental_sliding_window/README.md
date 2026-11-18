# TraceMesh Module 12a: Incremental Sliding-Window Detection

Real-time transaction streaming engine that updates an in-memory sliding window graph, evicts expired edges, and evaluates 1-to-2 hop neighborhoods without full graph reconstruction.

## Features
- **Sliding Window Graph Manager**: Tracks a default 60-minute window, advances watermark clock, and expires stale edges automatically.
- **Stream Processing**: Ingests streaming transaction events, rejects duplicates idempotently, and accommodates out-of-order events.
- **Localized Neighborhood Evaluation**: Restricts detector re-evaluation to touched accounts and their local neighborhood, achieving sub-millisecond latencies ($< 1$ ms/txn).
- **Dynamic Alert Management**: Detects threshold crossings and emits structured `AlertEvent` objects with duplicate suppression.

## Quick Start
```python
from module_12_incremental_sliding_window import IncrementalDetectorEngine

engine = IncrementalDetectorEngine(window_minutes=60)
for txn in transaction_stream:
    event = engine.process_transaction(txn)
    if event.current_status in ["new_alert", "alert_updated"]:
        print(f"Alert {event.event_id}: Ring={event.ring_id}, Score={event.alert_score}")
```

## Testing
```bash
python -m pytest tests/test_module_12_incremental.py -v
```
