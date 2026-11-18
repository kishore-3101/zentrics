"""Detector 3: Rapid Pass-through."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List
import networkx as nx

from shared.models import Hit


def detect_rapid_pass_through(graph: nx.MultiDiGraph, config: Dict[str, Any]) -> List[Hit]:
    """Identify accounts receiving money and forwarding a similar amount shortly afterward."""
    cfg = config.get("detectors", {}).get("rapid_pass_through", {})
    if not cfg.get("enabled", True):
        return []

    max_delay_minutes = float(cfg.get("max_delay_minutes", 30))
    min_forward_ratio = float(cfg.get("min_forward_ratio", 0.80))
    max_forward_ratio = float(cfg.get("max_forward_ratio", 1.25))
    min_amount = float(cfg.get("min_amount", 500.0))
    max_delay = timedelta(minutes=max_delay_minutes)

    hits: List[Hit] = []

    for account_id in sorted(graph.nodes):
        in_edges = graph.in_edges(account_id, keys=True, data=True)
        out_edges = graph.out_edges(account_id, keys=True, data=True)
        if not in_edges or not out_edges:
            continue

        sorted_in = sorted(in_edges, key=lambda e: e[3]["timestamp"])
        sorted_out = sorted(out_edges, key=lambda e: e[3]["timestamp"])

        used_out_keys = set()

        for u_in, _, k_in, data_in in sorted_in:
            in_amt = data_in["amount"]
            if in_amt < min_amount:
                continue
            in_ts = data_in["timestamp"]
            window_end = in_ts + max_delay

            # Find matching outflow(s) within max_delay
            candidates = [
                e for e in sorted_out
                if in_ts <= e[3]["timestamp"] <= window_end and e[2] not in used_out_keys
            ]
            if not candidates:
                continue

            # First check single-transaction matching
            matched = False
            for _, v_out, k_out, data_out in candidates:
                out_amt = data_out["amount"]
                ratio = out_amt / in_amt
                if min_forward_ratio <= ratio <= max_forward_ratio:
                    delay_min = (data_out["timestamp"] - in_ts).total_seconds() / 60.0
                    severity = "critical" if (ratio >= 0.90 and delay_min <= 15) else "high"
                    evidence = {
                        "inflow_amount": round(in_amt, 2),
                        "outflow_amount": round(out_amt, 2),
                        "forward_ratio": round(ratio, 4),
                        "delay_minutes": round(delay_min, 2),
                        "inflow_txn_id": data_in["transaction_id"],
                        "outflow_txn_id": data_out["transaction_id"],
                        "sender": u_in,
                        "recipient": v_out,
                    }
                    detail = (
                        f"Rapid pass-through: received INR {in_amt:,.2f} from {u_in} and forwarded "
                        f"{round(ratio * 100, 1)}% (INR {out_amt:,.2f}) to {v_out} within {delay_min:.1f} minutes."
                    )
                    hits.append(Hit(
                        account_id=str(account_id),
                        code="rapid_pass_through",
                        window_start=in_ts,
                        window_end=data_out["timestamp"],
                        severity=severity,
                        evidence=evidence,
                        detail=detail,
                    ))
                    used_out_keys.add(k_out)
                    matched = True
                    break

            if not matched and len(candidates) > 1:
                # Check aggregate forward in window
                agg_out = sum(e[3]["amount"] for e in candidates)
                agg_ratio = agg_out / in_amt
                if min_forward_ratio <= agg_ratio <= max_forward_ratio:
                    last_out_ts = max(e[3]["timestamp"] for e in candidates)
                    delay_min = (last_out_ts - in_ts).total_seconds() / 60.0
                    evidence = {
                        "inflow_amount": round(in_amt, 2),
                        "outflow_amount": round(agg_out, 2),
                        "forward_ratio": round(agg_ratio, 4),
                        "delay_minutes": round(delay_min, 2),
                        "inflow_txn_id": data_in["transaction_id"],
                        "outflow_txn_count": len(candidates),
                    }
                    detail = (
                        f"Rapid pass-through: received INR {in_amt:,.2f} and split-forwarded "
                        f"{round(agg_ratio * 100, 1)}% (INR {agg_out:,.2f}) across {len(candidates)} transfers within {delay_min:.1f} minutes."
                    )
                    hits.append(Hit(
                        account_id=str(account_id),
                        code="rapid_pass_through",
                        window_start=in_ts,
                        window_end=last_out_ts,
                        severity="high",
                        evidence=evidence,
                        detail=detail,
                    ))
                    for e in candidates:
                        used_out_keys.add(e[2])

    return hits
