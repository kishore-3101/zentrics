"""
Performance and Latency Profiler.
Measures construction speed, memory footprint, and query execution times.
"""

from __future__ import annotations

import os
import time
from typing import Any, Callable, Dict, Tuple


def measure_execution(fn: Callable[[], Any]) -> Tuple[Any, float]:
    """Measures wall-clock execution time in milliseconds."""
    t0 = time.perf_counter()
    res = fn()
    t1 = time.perf_counter()
    return res, (t1 - t0) * 1000.0


def get_process_memory_mb() -> float:
    """Returns current process RSS memory in megabytes."""
    try:
        import psutil
        process = psutil.Process(os.getpid())
        return process.memory_info().rss / (1024 * 1024)
    except Exception:
        return 0.0
