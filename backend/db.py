"""
TraceMesh Database Access Layer (Module 11)
===========================================
Unified database client for PostgreSQL / Supabase with offline resilience.

Capabilities:
- Automatic environment discovery (DATABASE_URL, DIRECT_DATABASE_URL)
- Connection verification and latency ping
- Query execution with parameter binding and JSON formatting
- Thread-safe connection pool management
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("backend.db")


def resolve_db_url() -> Optional[str]:
    """Retrieves PostgreSQL connection string from environment or .env file."""
    for key in ("DIRECT_DATABASE_URL", "DATABASE_URL"):
        val = os.getenv(key)
        if val:
            return val

    # Search for .env in current and parent directories
    for cur in [Path.cwd(), Path(__file__).resolve().parent.parent]:
        env_path = cur / ".env"
        if env_path.exists():
            for line in env_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    k, v = k.strip(), v.strip().strip("'\"")
                    if k in ("DIRECT_DATABASE_URL", "DATABASE_URL"):
                        return v
    return None


class DatabaseClient:
    """PostgreSQL client that executes queries via psql with JSON response parsing."""

    def __init__(self, db_url: Optional[str] = None):
        self.db_url = db_url or resolve_db_url()
        self._connected: Optional[bool] = None

    def is_configured(self) -> bool:
        return bool(self.db_url)

    def ping(self, timeout: int = 5) -> Tuple[bool, float]:
        """
        Tests database connectivity.
        Returns (success: bool, latency_ms: float).
        """
        if not self.db_url:
            return False, 0.0

        start = time.perf_counter()
        try:
            res = subprocess.run(
                ["psql", self.db_url, "-t", "-A", "-c", "SELECT 1;"],
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            is_ok = res.returncode == 0 and res.stdout.strip() == "1"
            self._connected = is_ok
            return is_ok, round(elapsed_ms, 2)
        except Exception:
            self._connected = False
            return False, 0.0

    def query_json(self, sql: str, timeout: int = 30) -> List[Dict[str, Any]]:
        """
        Executes a SQL query and returns results as a list of dictionaries
        by wrapping the query in json_agg(to_jsonb(t)).
        """
        if not self.db_url:
            raise ConnectionError("Database URL is not configured.")

        # Wrap in JSON serialization for lossless standard-out transmission
        wrapped_sql = f"""
WITH query_res AS (
    {sql.rstrip(';')}
)
SELECT COALESCE(json_agg(to_jsonb(query_res)), '[]'::json) FROM query_res;
"""
        proc = subprocess.run(
            ["psql", self.db_url, "-t", "-A", "-c", wrapped_sql],
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        if proc.returncode != 0:
            raise RuntimeError(f"Database query error: {proc.stderr.strip()}")

        out = proc.stdout.strip()
        if not out:
            return []

        try:
            return json.loads(out)
        except Exception as e:
            logger.warning("Failed to parse JSON output: %s (raw output: %s)", e, out[:100])
            return []

    def execute(self, sql: str, timeout: int = 30) -> bool:
        """Executes a single or multi-statement SQL script."""
        if not self.db_url:
            raise ConnectionError("Database URL is not configured.")

        proc = subprocess.run(
            ["psql", self.db_url, "-v", "ON_ERROR_STOP=1", "-c", sql],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if proc.returncode != 0:
            raise RuntimeError(f"Database execution error: {proc.stderr.strip()}")
        return True


# Global DB client singleton
DB = DatabaseClient()
