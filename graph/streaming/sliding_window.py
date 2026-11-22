"""
Sliding Window Graph Manager (Module 12a Deliverable).
Maintains active temporal window, evicts expired edges, and handles time-boundary shifts.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple
import networkx as nx

from graph.shared.utilities import parse_timestamp

logger = logging.getLogger(__name__)


class SlidingWindowManager:
    """Maintains a time-decayed sliding window graph and manages edge expiration."""

    def __init__(
        self,
        G: nx.MultiDiGraph,
        window_duration_minutes: int = 1440, # 24 hours default
        edge_ttl_days: int = 7
    ):
        self.G = G
        self.window_duration = timedelta(minutes=window_duration_minutes)
        self.edge_ttl = timedelta(days=edge_ttl_days)
        self.current_window_end: Optional[datetime] = None

    def advance_time(self, new_timestamp: Any) -> Tuple[int, Set[str]]:
        """
        Advances the virtual time cursor to new_timestamp.
        Evicts edges that fall outside the active edge TTL.
        Returns:
            num_evicted_edges: Number of expired edges pruned.
            affected_accounts: Set of accounts whose local topology changed due to eviction.
        """
        dt = parse_timestamp(new_timestamp)
        if dt is None:
            return 0, set()

        if self.current_window_end is None or dt > self.current_window_end:
            self.current_window_end = dt

        cutoff_time = self.current_window_end - self.edge_ttl
        edges_to_remove = []
        affected_accounts: Set[str] = set()

        for u, v, k, d in self.G.edges(keys=True, data=True):
            edge_ts = d.get("timestamp")
            if edge_ts and edge_ts < cutoff_time:
                edges_to_remove.append((u, v, k))
                affected_accounts.add(u)
                affected_accounts.add(v)

        for u, v, k in edges_to_remove:
            self.G.remove_edge(u, v, key=k)

        if edges_to_remove:
            logger.info("Evicted %d expired edges older than %s", len(edges_to_remove), cutoff_time)

        return len(edges_to_remove), affected_accounts

    def get_active_window_edges(self) -> List[Dict[str, Any]]:
        """Returns all edges currently inside [current_window_end - window_duration, current_window_end]."""
        if self.current_window_end is None:
            return [d for _, _, d in self.G.edges(data=True)]

        window_start = self.current_window_end - self.window_duration
        active = []
        for _, _, d in self.G.edges(data=True):
            ts = d.get("timestamp")
            if ts and window_start <= ts <= self.current_window_end:
                active.append(d)
        return active
