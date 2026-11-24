#!/usr/bin/env python3
"""
Generate comprehensive mock fixtures for TraceMesh Module 2.
Ensures 100% adherence to OpenAPI contract, new_schema.sql, and frontend TypeScript models.
"""
import json
import os
from pathlib import Path

FIXTURES_DIR = Path(__file__).resolve().parent

def create_rings():
    rings = {
        "R-104": {
            "ring_id": "R-104",
            "fingerprint": "e89c31b0a8f89b6e828e83b4b0e8913b7728f11a",
            "ring_type": "structural_cycle",
            "score": 96.0,
            "priority": 945600.0,
            "amount_moved": 1420000.00,
            "amount_cashed": 435000.00,
            "amount_at_risk": 985000.00,
            "duration_min": 34.0,
            "status": "new",
            "detected_at": "2026-03-10T10:45:00Z",
            "pattern_tags": ["structural_cycle", "circular_flow", "high_velocity", "cross_channel_upi"],
            "explanation": "Closed circular routing detected: ₹14,20,000 circulated across 4 intermediary mule accounts across 3 laps, with 3% commission decay per lap and partial cash-out at ATM sinks.",
            "nodes": [
                {
                    "account_id": "ACC_VICTIM_401",
                    "role": "victim",
                    "risk_score": 12.0,
                    "ml_prob": 0.08,
                    "rule_score": 0.10,
                    "neighbor_risk": 0.15,
                    "open_date": "2019-04-12",
                    "kyc_level": "full",
                    "account_type": "savings",
                    "city_cluster": "MUMBAI",
                    "declared_income_band": "mid",
                    "bank_id": "TRACE_BANK",
                    "total_incoming": 800000.00,
                    "total_outgoing": 750000.00,
                    "transaction_count": 3,
                    "reason_codes": [
                        {"code": "NORMAL_PROFILE", "label": "Established account profile (5+ years)", "weight": -15.0, "direction": "decreases_risk"}
                    ],
                    "is_frozen": False,
                    "position": [-250, 0, 0]
                },
                {
                    "account_id": "ACC_MULE_401",
                    "role": "collector",
                    "risk_score": 94.0,
                    "ml_prob": 0.95,
                    "rule_score": 0.92,
                    "neighbor_risk": 0.88,
                    "open_date": "2026-02-14",
                    "kyc_level": "minimal",
                    "account_type": "savings",
                    "city_cluster": "MUMBAI",
                    "declared_income_band": "low",
                    "bank_id": "TRACE_BANK",
                    "total_incoming": 1420000.00,
                    "total_outgoing": 1390000.00,
                    "transaction_count": 12,
                    "reason_codes": [
                        {"code": "CYCLE_PARTICIPATION", "label": "Key anchor in length-4 circular fund loop", "weight": 34.0, "direction": "increases_risk"},
                        {"code": "RAPID_FORWARDING", "label": "Funds forwarded in < 5 mins (98% pass-through)", "weight": 28.0, "direction": "increases_risk"}
                    ],
                    "is_frozen": False,
                    "position": [-80, 120, 0]
                },
                {
                    "account_id": "ACC_MULE_402",
                    "role": "mule",
                    "risk_score": 91.0,
                    "ml_prob": 0.89,
                    "rule_score": 0.90,
                    "neighbor_risk": 0.86,
                    "open_date": "2026-01-20",
                    "kyc_level": "minimal",
                    "account_type": "wallet",
                    "city_cluster": "THANE",
                    "declared_income_band": "low",
                    "bank_id": "TRACE_BANK",
                    "total_incoming": 1380000.00,
                    "total_outgoing": 1350000.00,
                    "transaction_count": 9,
                    "reason_codes": [
                        {"code": "CYCLE_PARTICIPATION", "label": "Participated in 3 cycle laps", "weight": 31.0, "direction": "increases_risk"}
                    ],
                    "is_frozen": False,
                    "position": [80, 120, 0]
                },
                {
                    "account_id": "ACC_MULE_403",
                    "role": "mule",
                    "risk_score": 89.0,
                    "ml_prob": 0.88,
                    "rule_score": 0.87,
                    "neighbor_risk": 0.84,
                    "open_date": "2026-02-01",
                    "kyc_level": "minimal",
                    "account_type": "savings",
                    "city_cluster": "NAVI_MUMBAI",
                    "declared_income_band": "lower_mid",
                    "bank_id": "TRACE_BANK",
                    "total_incoming": 1350000.00,
                    "total_outgoing": 1320000.00,
                    "transaction_count": 8,
                    "reason_codes": [
                        {"code": "CYCLE_PARTICIPATION", "label": "Cycle conduit node", "weight": 29.0, "direction": "increases_risk"}
                    ],
                    "is_frozen": False,
                    "position": [120, -50, 0]
                },
                {
                    "account_id": "ACC_MULE_404",
                    "role": "mule",
                    "risk_score": 93.0,
                    "ml_prob": 0.92,
                    "rule_score": 0.91,
                    "neighbor_risk": 0.89,
                    "open_date": "2026-02-10",
                    "kyc_level": "minimal",
                    "account_type": "wallet",
                    "city_cluster": "MUMBAI",
                    "declared_income_band": "low",
                    "bank_id": "TRACE_BANK",
                    "total_incoming": 1320000.00,
                    "total_outgoing": 1290000.00,
                    "transaction_count": 10,
                    "reason_codes": [
                        {"code": "SINK_EXTRACTION", "label": "Direct transfer to ATM sink", "weight": 32.0, "direction": "increases_risk"}
                    ],
                    "is_frozen": False,
                    "position": [-50, -100, 0]
                },
                {
                    "account_id": "ATM_SINK_MUMBAI",
                    "role": "cash_out",
                    "risk_score": 5.0,
                    "ml_prob": 0.01,
                    "rule_score": 0.05,
                    "neighbor_risk": 0.10,
                    "open_date": "2015-01-01",
                    "kyc_level": "full",
                    "account_type": "sink",
                    "city_cluster": "MUMBAI",
                    "declared_income_band": "high",
                    "bank_id": "CASH_OUT_NETWORK",
                    "total_incoming": 435000.00,
                    "total_outgoing": 0.00,
                    "transaction_count": 5,
                    "reason_codes": [
                        {"code": "TERMINAL_SINK", "label": "Designated cash withdrawal point", "weight": 0.0, "direction": "decreases_risk"}
                    ],
                    "is_frozen": False,
                    "position": [250, 0, 0]
                }
            ],
            "edges": [
                {"txn_id": "TXN_401_01", "src_account": "ACC_VICTIM_401", "dst_account": "ACC_MULE_401", "amount": 750000.00, "channel": "UPI", "ts": "2026-03-10T10:15:00Z", "hop_index": 1, "is_suspicious": True},
                {"txn_id": "TXN_401_02", "src_account": "ACC_MULE_401", "dst_account": "ACC_MULE_402", "amount": 730000.00, "channel": "IMPS", "ts": "2026-03-10T10:20:00Z", "hop_index": 2, "is_suspicious": True},
                {"txn_id": "TXN_401_03", "src_account": "ACC_MULE_402", "dst_account": "ACC_MULE_403", "amount": 710000.00, "channel": "UPI", "ts": "2026-03-10T10:25:00Z", "hop_index": 3, "is_suspicious": True},
                {"txn_id": "TXN_401_04", "src_account": "ACC_MULE_403", "dst_account": "ACC_MULE_404", "amount": 690000.00, "channel": "UPI", "ts": "2026-03-10T10:30:00Z", "hop_index": 4, "is_suspicious": True},
                {"txn_id": "TXN_401_05", "src_account": "ACC_MULE_404", "dst_account": "ACC_MULE_401", "amount": 470000.00, "channel": "IMPS", "ts": "2026-03-10T10:35:00Z", "hop_index": 5, "is_suspicious": True},
                {"txn_id": "TXN_401_06", "src_account": "ACC_MULE_404", "dst_account": "ATM_SINK_MUMBAI", "amount": 200000.00, "channel": "ATM_WITHDRAWAL", "ts": "2026-03-10T10:40:00Z", "hop_index": 5, "is_suspicious": True},
                {"txn_id": "TXN_401_07", "src_account": "ACC_MULE_401", "dst_account": "ATM_SINK_MUMBAI", "amount": 235000.00, "channel": "ATM_WITHDRAWAL", "ts": "2026-03-10T10:44:00Z", "hop_index": 6, "is_suspicious": True}
            ]
        },
        "R-101": {
            "ring_id": "R-101",
            "fingerprint": "a1b2c3d4e5f67890123456789abcdef012345678",
            "ring_type": "burst_fanin",
            "score": 94.0,
            "priority": 1128000.0,
            "amount_moved": 1850000.00,
            "amount_cashed": 650000.00,
            "amount_at_risk": 1200000.00,
            "duration_min": 28.0,
            "status": "under_review",
            "detected_at": "2026-03-10T11:15:00Z",
            "pattern_tags": ["burst_fanin", "fan_in_fan_out", "rapid_aggregation"],
            "explanation": "High-velocity fan-in burst detected: 8 victim accounts transferred ₹18,50,000 into collector ACC_COLL_101, which rapidly split funds among 4 mule accounts for cash-out.",
            "nodes": [
                {"account_id": "ACC_COLL_101", "role": "collector", "risk_score": 96.0, "ml_prob": 0.98, "rule_score": 0.94, "neighbor_risk": 0.85, "open_date": "2026-02-18", "kyc_level": "minimal", "account_type": "savings", "city_cluster": "DELHI", "declared_income_band": "low", "bank_id": "TRACE_BANK", "total_incoming": 1850000.0, "total_outgoing": 1750000.0, "transaction_count": 14, "reason_codes": [{"code": "BURST_INFLOW", "label": "8 senders in 28 mins", "weight": 35.0, "direction": "increases_risk"}], "is_frozen": False, "position": [0, 0, 0]},
                {"account_id": "ACC_MULE_101", "role": "mule", "risk_score": 88.0, "ml_prob": 0.86, "rule_score": 0.89, "neighbor_risk": 0.82, "open_date": "2026-02-20", "kyc_level": "minimal", "account_type": "wallet", "city_cluster": "DELHI", "declared_income_band": "low", "bank_id": "TRACE_BANK", "total_incoming": 450000.0, "total_outgoing": 450000.0, "transaction_count": 4, "reason_codes": [{"code": "RAPID_SPLIT", "label": "Fast split receiver", "weight": 25.0, "direction": "increases_risk"}], "is_frozen": False, "position": [180, 80, 0]},
                {"account_id": "ATM_SINK_DELHI", "role": "cash_out", "risk_score": 5.0, "ml_prob": 0.01, "rule_score": 0.05, "neighbor_risk": 0.05, "open_date": "2018-01-01", "kyc_level": "full", "account_type": "sink", "city_cluster": "DELHI", "declared_income_band": "high", "bank_id": "CASH_OUT_NETWORK", "total_incoming": 650000.0, "total_outgoing": 0.0, "transaction_count": 6, "reason_codes": [], "is_frozen": False, "position": [280, 0, 0]}
            ],
            "edges": [
                {"txn_id": "TXN_101_01", "src_account": "ACC_VIC_1", "dst_account": "ACC_COLL_101", "amount": 250000.00, "channel": "UPI", "ts": "2026-03-10T10:50:00Z", "hop_index": 1, "is_suspicious": True},
                {"txn_id": "TXN_101_02", "src_account": "ACC_COLL_101", "dst_account": "ACC_MULE_101", "amount": 450000.00, "channel": "IMPS", "ts": "2026-03-10T11:00:00Z", "hop_index": 2, "is_suspicious": True},
                {"txn_id": "TXN_101_03", "src_account": "ACC_MULE_101", "dst_account": "ATM_SINK_DELHI", "amount": 450000.00, "channel": "ATM_WITHDRAWAL", "ts": "2026-03-10T11:12:00Z", "hop_index": 3, "is_suspicious": True}
            ]
        },
        "R-102": {
            "ring_id": "R-102",
            "fingerprint": "b2c3d4e5f6a17890123456789abcdef012345678",
            "ring_type": "rapid_pass_through",
            "score": 91.0,
            "priority": 746200.0,
            "amount_moved": 820000.00,
            "amount_cashed": 0.00,
            "amount_at_risk": 820000.00,
            "duration_min": 12.0,
            "status": "new",
            "detected_at": "2026-03-10T12:05:00Z",
            "pattern_tags": ["rapid_pass_through", "pass_through_hub", "zero_retention"],
            "explanation": "Rapid transit hub anomaly: Hub account ACC_HUB_201 received ₹8,20,000 from 2 victim sources and forwarded 98.5% within 4.2 minutes across IMPS rails.",
            "nodes": [
                {"account_id": "ACC_HUB_201", "role": "collector", "risk_score": 93.0, "ml_prob": 0.94, "rule_score": 0.91, "neighbor_risk": 0.82, "open_date": "2026-02-25", "kyc_level": "minimal", "account_type": "savings", "city_cluster": "HYDERABAD", "declared_income_band": "low", "bank_id": "TRACE_BANK", "total_incoming": 820000.0, "total_outgoing": 810000.0, "transaction_count": 4, "reason_codes": [{"code": "PASS_THROUGH_SPEED", "label": "Forwarded in 4.2 mins", "weight": 38.0, "direction": "increases_risk"}], "is_frozen": False, "position": [0, 0, 0]},
                {"account_id": "ACC_MULE_201", "role": "mule", "risk_score": 87.0, "ml_prob": 0.85, "rule_score": 0.86, "neighbor_risk": 0.80, "open_date": "2026-02-15", "kyc_level": "minimal", "account_type": "wallet", "city_cluster": "HYDERABAD", "declared_income_band": "low", "bank_id": "TRACE_BANK", "total_incoming": 410000.0, "total_outgoing": 0.0, "transaction_count": 1, "reason_codes": [], "is_frozen": False, "position": [150, 60, 0]},
                {"account_id": "ACC_MULE_202", "role": "mule", "risk_score": 86.0, "ml_prob": 0.84, "rule_score": 0.85, "neighbor_risk": 0.79, "open_date": "2026-02-16", "kyc_level": "minimal", "account_type": "savings", "city_cluster": "HYDERABAD", "declared_income_band": "low", "bank_id": "TRACE_BANK", "total_incoming": 400000.0, "total_outgoing": 0.0, "transaction_count": 1, "reason_codes": [], "is_frozen": False, "position": [150, -60, 0]}
            ],
            "edges": [
                {"txn_id": "TXN_201_01", "src_account": "ACC_VIC_201", "dst_account": "ACC_HUB_201", "amount": 420000.00, "channel": "UPI", "ts": "2026-03-10T11:55:00Z", "hop_index": 1, "is_suspicious": True},
                {"txn_id": "TXN_201_02", "src_account": "ACC_VIC_202", "dst_account": "ACC_HUB_201", "amount": 400000.00, "channel": "UPI", "ts": "2026-03-10T11:58:00Z", "hop_index": 1, "is_suspicious": True},
                {"txn_id": "TXN_201_03", "src_account": "ACC_HUB_201", "dst_account": "ACC_MULE_201", "amount": 410000.00, "channel": "IMPS", "ts": "2026-03-10T12:02:00Z", "hop_index": 2, "is_suspicious": True},
                {"txn_id": "TXN_201_04", "src_account": "ACC_HUB_201", "dst_account": "ACC_MULE_202", "amount": 400000.00, "channel": "IMPS", "ts": "2026-03-10T12:03:00Z", "hop_index": 2, "is_suspicious": True}
            ]
        },
        "R-103": {
            "ring_id": "R-103",
            "fingerprint": "c3d4e5f6a1b27890123456789abcdef012345678",
            "ring_type": "dormant_activation",
            "score": 88.0,
            "priority": 563200.0,
            "amount_moved": 640000.00,
            "amount_cashed": 180000.00,
            "amount_at_risk": 460000.00,
            "duration_min": 45.0,
            "status": "under_review",
            "detected_at": "2026-03-10T13:20:00Z",
            "pattern_tags": ["dormant_activation", "dormant_active", "volume_spike"],
            "explanation": "Dormancy activation spike: Account ACC_DORM_301, completely inactive for 142 days, suddenly moved ₹6,40,000 (85x prior volume) within 45 minutes.",
            "nodes": [
                {"account_id": "ACC_DORM_301", "role": "mule", "risk_score": 90.0, "ml_prob": 0.91, "rule_score": 0.88, "neighbor_risk": 0.75, "open_date": "2025-08-10", "kyc_level": "minimal", "account_type": "savings", "city_cluster": "KOLKATA", "declared_income_band": "low", "bank_id": "TRACE_BANK", "total_incoming": 640000.0, "total_outgoing": 640000.0, "transaction_count": 3, "reason_codes": [{"code": "DORMANCY_BREAK", "label": "142 days inactive before surge", "weight": 36.0, "direction": "increases_risk"}], "is_frozen": False, "position": [0, 0, 0]},
                {"account_id": "EXT_BANK_ICICI", "role": "cash_out", "risk_score": 5.0, "ml_prob": 0.01, "rule_score": 0.05, "neighbor_risk": 0.05, "open_date": "2015-01-01", "kyc_level": "full", "account_type": "sink", "city_cluster": "KOLKATA", "declared_income_band": "high", "bank_id": "EXT_BANK", "total_incoming": 180000.0, "total_outgoing": 0.0, "transaction_count": 1, "reason_codes": [], "is_frozen": False, "position": [180, 0, 0]}
            ],
            "edges": [
                {"txn_id": "TXN_301_01", "src_account": "ACC_VIC_301", "dst_account": "ACC_DORM_301", "amount": 640000.00, "channel": "NEFT", "ts": "2026-03-10T12:40:00Z", "hop_index": 1, "is_suspicious": True},
                {"txn_id": "TXN_301_02", "src_account": "ACC_DORM_301", "dst_account": "EXT_BANK_ICICI", "amount": 180000.00, "channel": "IMPS", "ts": "2026-03-10T13:10:00Z", "hop_index": 2, "is_suspicious": True}
            ]
        },
        "R-105": {
            "ring_id": "R-105",
            "fingerprint": "d4e5f6a1b2c37890123456789abcdef012345678",
            "ring_type": "layering_chain",
            "score": 93.0,
            "priority": 883500.0,
            "amount_moved": 950000.00,
            "amount_cashed": 0.00,
            "amount_at_risk": 950000.00,
            "duration_min": 52.0,
            "status": "new",
            "detected_at": "2026-03-10T14:10:00Z",
            "pattern_tags": ["layering_chain", "multi_hop", "structuring"],
            "explanation": "Multi-hop layering chain: ₹9,50,000 routed through 5 serial mule accounts (A -> B -> C -> D -> E) with 2-4% commission decay at each hop over 52 minutes.",
            "nodes": [
                {"account_id": "ACC_CHAIN_01", "role": "collector", "risk_score": 92.0, "ml_prob": 0.90, "rule_score": 0.91, "neighbor_risk": 0.85, "open_date": "2026-02-12", "kyc_level": "minimal", "account_type": "savings", "city_cluster": "PUNE", "declared_income_band": "low", "bank_id": "TRACE_BANK", "total_incoming": 950000.0, "total_outgoing": 920000.0, "transaction_count": 2, "reason_codes": [], "is_frozen": False, "position": [-200, 0, 0]},
                {"account_id": "ACC_CHAIN_02", "role": "mule", "risk_score": 91.0, "ml_prob": 0.89, "rule_score": 0.90, "neighbor_risk": 0.86, "open_date": "2026-02-14", "kyc_level": "minimal", "account_type": "savings", "city_cluster": "PUNE", "declared_income_band": "low", "bank_id": "TRACE_BANK", "total_incoming": 920000.0, "total_outgoing": 890000.0, "transaction_count": 2, "reason_codes": [], "is_frozen": False, "position": [-100, 0, 0]},
                {"account_id": "ACC_CHAIN_03", "role": "mule", "risk_score": 91.0, "ml_prob": 0.89, "rule_score": 0.90, "neighbor_risk": 0.86, "open_date": "2026-02-16", "kyc_level": "minimal", "account_type": "savings", "city_cluster": "PUNE", "declared_income_band": "low", "bank_id": "TRACE_BANK", "total_incoming": 890000.0, "total_outgoing": 860000.0, "transaction_count": 2, "reason_codes": [], "is_frozen": False, "position": [0, 0, 0]},
                {"account_id": "ACC_CHAIN_04", "role": "mule", "risk_score": 92.0, "ml_prob": 0.90, "rule_score": 0.91, "neighbor_risk": 0.87, "open_date": "2026-02-18", "kyc_level": "minimal", "account_type": "wallet", "city_cluster": "PUNE", "declared_income_band": "low", "bank_id": "TRACE_BANK", "total_incoming": 860000.0, "total_outgoing": 830000.0, "transaction_count": 2, "reason_codes": [], "is_frozen": False, "position": [100, 0, 0]},
                {"account_id": "ACC_CHAIN_05", "role": "mule", "risk_score": 94.0, "ml_prob": 0.93, "rule_score": 0.92, "neighbor_risk": 0.88, "open_date": "2026-02-20", "kyc_level": "minimal", "account_type": "wallet", "city_cluster": "PUNE", "declared_income_band": "low", "bank_id": "TRACE_BANK", "total_incoming": 830000.0, "total_outgoing": 0.0, "transaction_count": 1, "reason_codes": [{"code": "CHAIN_DESTINATION", "label": "5-hop terminal holding node", "weight": 33.0, "direction": "increases_risk"}], "is_frozen": False, "position": [200, 0, 0]}
            ],
            "edges": [
                {"txn_id": "TXN_501_01", "src_account": "ACC_CHAIN_01", "dst_account": "ACC_CHAIN_02", "amount": 920000.00, "channel": "IMPS", "ts": "2026-03-10T13:25:00Z", "hop_index": 1, "is_suspicious": True},
                {"txn_id": "TXN_501_02", "src_account": "ACC_CHAIN_02", "dst_account": "ACC_CHAIN_03", "amount": 890000.00, "channel": "IMPS", "ts": "2026-03-10T13:38:00Z", "hop_index": 2, "is_suspicious": True},
                {"txn_id": "TXN_501_03", "src_account": "ACC_CHAIN_03", "dst_account": "ACC_CHAIN_04", "amount": 860000.00, "channel": "UPI", "ts": "2026-03-10T13:49:00Z", "hop_index": 3, "is_suspicious": True},
                {"txn_id": "TXN_501_04", "src_account": "ACC_CHAIN_04", "dst_account": "ACC_CHAIN_05", "amount": 830000.00, "channel": "UPI", "ts": "2026-03-10T14:02:00Z", "hop_index": 4, "is_suspicious": True}
            ]
        },
        "R-106": {
            "ring_id": "R-106",
            "fingerprint": "e5f6a1b2c3d47890123456789abcdef012345678",
            "ring_type": "mixed",
            "score": 95.0,
            "priority": 1472500.0,
            "amount_moved": 2100000.00,
            "amount_cashed": 550000.00,
            "amount_at_risk": 1550000.00,
            "duration_min": 68.0,
            "status": "frozen",
            "detected_at": "2026-03-10T15:00:00Z",
            "pattern_tags": ["mixed", "complex_syndicate", "cycle_and_fanout"],
            "explanation": "Hybrid multi-stage syndicate: 4 victim accounts funneled ₹21,00,000 into 2 aggregators, who fed a 3-account circular loop before distributing to 5 mule cash-out nodes.",
            "nodes": [
                {"account_id": "ACC_SYN_AGG_1", "role": "collector", "risk_score": 97.0, "ml_prob": 0.98, "rule_score": 0.95, "neighbor_risk": 0.90, "open_date": "2026-01-15", "kyc_level": "minimal", "account_type": "current", "city_cluster": "BENGALURU", "declared_income_band": "low", "bank_id": "TRACE_BANK", "total_incoming": 1100000.0, "total_outgoing": 1050000.0, "transaction_count": 6, "reason_codes": [], "is_frozen": True, "position": [-120, 100, 0]},
                {"account_id": "ACC_SYN_AGG_2", "role": "collector", "risk_score": 96.0, "ml_prob": 0.97, "rule_score": 0.94, "neighbor_risk": 0.89, "open_date": "2026-01-18", "kyc_level": "minimal", "account_type": "savings", "city_cluster": "CHENNAI", "declared_income_band": "low", "bank_id": "TRACE_BANK", "total_incoming": 1000000.0, "total_outgoing": 950000.0, "transaction_count": 5, "reason_codes": [], "is_frozen": True, "position": [-120, -100, 0]},
                {"account_id": "ATM_SINK_BLR", "role": "cash_out", "risk_score": 5.0, "ml_prob": 0.01, "rule_score": 0.05, "neighbor_risk": 0.05, "open_date": "2016-01-01", "kyc_level": "full", "account_type": "sink", "city_cluster": "BENGALURU", "declared_income_band": "high", "bank_id": "CASH_OUT_NETWORK", "total_incoming": 350000.0, "total_outgoing": 0.0, "transaction_count": 4, "reason_codes": [], "is_frozen": False, "position": [220, 0, 0]}
            ],
            "edges": [
                {"txn_id": "TXN_601_01", "src_account": "ACC_SYN_AGG_1", "dst_account": "ATM_SINK_BLR", "amount": 350000.00, "channel": "ATM_WITHDRAWAL", "ts": "2026-03-10T14:45:00Z", "hop_index": 2, "is_suspicious": True}
            ]
        },
        "R-107": {
            "ring_id": "R-107",
            "fingerprint": "f6a1b2c3d4e57890123456789abcdef012345678",
            "ring_type": "burst_fanin",
            "score": 24.0,
            "priority": 7200.0,
            "amount_moved": 450000.00,
            "amount_cashed": 0.00,
            "amount_at_risk": 30000.00,
            "duration_min": 480.0,
            "status": "false_positive",
            "detected_at": "2026-03-10T16:00:00Z",
            "pattern_tags": ["hard_negative_shop", "kirana_merchant", "high_retention"],
            "explanation": "Benign merchant activity (Hard Negative): Retail grocery store with 34 micro-UPI customer payments (median ₹240). Retains 93.3% of funds; zero cash-out to sinks.",
            "nodes": [
                {"account_id": "ACC_SHOP_KIRANA_01", "role": "collector", "risk_score": 22.0, "ml_prob": 0.15, "rule_score": 0.25, "neighbor_risk": 0.18, "open_date": "2021-06-10", "kyc_level": "full", "account_type": "current", "city_cluster": "AHMEDABAD", "declared_income_band": "upper_mid", "bank_id": "TRACE_BANK", "total_incoming": 450000.0, "total_outgoing": 30000.0, "transaction_count": 36, "reason_codes": [{"code": "HIGH_RETENTION", "label": "Retains 93.3% of funds (legitimate merchant balance)", "weight": -28.0, "direction": "decreases_risk"}], "is_frozen": False, "position": [0, 0, 0]}
            ],
            "edges": [
                {"txn_id": "TXN_701_01", "src_account": "ACC_CUST_1", "dst_account": "ACC_SHOP_KIRANA_01", "amount": 420.00, "channel": "UPI", "ts": "2026-03-10T09:15:00Z", "hop_index": 1, "is_suspicious": False}
            ]
        }
    }
    # Duplicate aliases so frontend keys match
    rings["R-089"] = rings["R-101"]
    rings["R-097"] = rings["R-102"]
    rings["R-092"] = rings["R-103"]
    rings["R-085"] = rings["R-105"]
    rings["R-099"] = rings["R-106"]
    return rings

def create_timelines(rings):
    timelines = {}
    for ring_id, ring_data in rings.items():
        edges = sorted(ring_data["edges"], key=lambda x: x["ts"])
        events = []
        if not edges:
            timelines[ring_id] = []
            continue
        first_time = edges[0]["ts"]
        last_time = edges[-1]["ts"]
        for idx, edge in enumerate(edges):
            progress = (idx + 1) / len(edges)
            events.append({
                "txn_id": edge["txn_id"],
                "ts": edge["ts"],
                "timestampMs": idx * 60000,
                "src_account": edge["src_account"],
                "dst_account": edge["dst_account"],
                "amount": edge["amount"],
                "channel": edge["channel"],
                "hop_index": edge["hop_index"],
                "is_suspicious": edge["is_suspicious"],
                "progress": round(progress, 2)
            })
        timelines[ring_id] = events
    return timelines

def create_accounts(rings):
    accounts = {}
    for ring_id, ring in rings.items():
        for node in ring.get("nodes", []):
            aid = node["account_id"]
            if aid not in accounts:
                accounts[aid] = {
                    "account_id": aid,
                    "open_date": node.get("open_date", "2026-01-01"),
                    "kyc_level": node.get("kyc_level", "minimal"),
                    "account_type": node.get("account_type", "savings"),
                    "city_cluster": node.get("city_cluster", "MUMBAI"),
                    "declared_income_band": node.get("declared_income_band", "low"),
                    "bank_id": node.get("bank_id", "TRACE_BANK"),
                    "risk_score": node["risk_score"],
                    "ml_prob": node.get("ml_prob", 0.8),
                    "rule_score": node.get("rule_score", 0.8),
                    "neighbor_risk": node.get("neighbor_risk", 0.7),
                    "total_incoming": node.get("total_incoming", 500000.0),
                    "total_outgoing": node.get("total_outgoing", 480000.0),
                    "transaction_count": node.get("transaction_count", 5),
                    "is_frozen": node.get("is_frozen", False),
                    "reason_codes": node.get("reason_codes", []),
                    "features": {
                        "pass_through_ratio": 0.96,
                        "median_forward_time_min": 4.5,
                        "unique_senders": 3,
                        "unique_receivers": 2,
                        "cash_out_share": 0.35,
                        "night_transaction_share": 0.28
                    },
                    "detector_hits": [
                        {
                            "code": "rapid_pass_through" if node["role"] != "victim" else "normal_flow",
                            "severity": "critical" if node["risk_score"] > 85 else "low",
                            "detail": f"Account {aid} evaluated in active window with {node['transaction_count']} txns.",
                            "window_start": "2026-03-10T10:00:00Z",
                            "window_end": "2026-03-10T11:00:00Z"
                        }
                    ],
                    "rings": [
                        {
                            "ring_id": ring_id,
                            "role": node["role"],
                            "score": ring["score"]
                        }
                    ]
                }
    return accounts

def create_cases_actions():
    return {
        "101": [
            {
                "action_id": 1001,
                "case_id": 101,
                "actor": "system_detector",
                "action": "status_change",
                "from_status": None,
                "to_status": "new",
                "note": "Auto-flagged with priority score 1128000.0",
                "ts": "2026-03-10T11:15:00Z"
            },
            {
                "action_id": 1002,
                "case_id": 101,
                "actor": "Ananya Sharma",
                "action": "status_change",
                "from_status": "new",
                "to_status": "under_review",
                "note": "Assigned to junior analyst for victim verification.",
                "ts": "2026-03-10T11:25:00Z"
            }
        ],
        "104": [
            {
                "action_id": 1003,
                "case_id": 104,
                "actor": "system_detector",
                "action": "status_change",
                "from_status": None,
                "to_status": "new",
                "note": "High-confidence cycle detected (96 score).",
                "ts": "2026-03-10T10:45:00Z"
            }
        ],
        "106": [
            {
                "action_id": 1004,
                "case_id": 106,
                "actor": "Kishore Kumar",
                "action": "freeze",
                "from_status": "under_review",
                "to_status": "frozen",
                "note": "Hot debit-freeze applied across all aggregator and mule accounts.",
                "ts": "2026-03-10T15:15:00Z"
            }
        ],
        "107": [
            {
                "action_id": 1005,
                "case_id": 107,
                "actor": "Ananya Sharma",
                "action": "false_positive",
                "from_status": "new",
                "to_status": "false_positive",
                "note": "GST verified retail supermarket. Whitelisted.",
                "ts": "2026-03-10T16:10:00Z"
            }
        ]
    }

def create_metrics():
    return {
        "overall": {
            "precision": 91.4,
            "recall": 88.7,
            "f1": 90.0,
            "pr_auc": 0.942,
            "ring_recall": 92.5,
            "fpr": 1.8
        },
        "comparison": [
            {
                "metric": "PR-AUC",
                "baseline_rules": 0.612,
                "graph_rules": 0.785,
                "ml_only": 0.834,
                "full_fusion": 0.942
            },
            {
                "metric": "F1-Score",
                "baseline_rules": 58.4,
                "graph_rules": 74.2,
                "ml_only": 81.1,
                "full_fusion": 90.0
            },
            {
                "metric": "Ring Recall @ 70%",
                "baseline_rules": 42.1,
                "graph_rules": 71.5,
                "ml_only": 68.4,
                "full_fusion": 92.5
            },
            {
                "metric": "False Positive Rate",
                "baseline_rules": 14.8,
                "graph_rules": 6.9,
                "ml_only": 5.2,
                "full_fusion": 1.8
            }
        ],
        "curves": {
            "pr_curve": [
                {"threshold": 0.1, "recall": 99.2, "precision": 52.1, "fpr": 18.5, "tpr": 99.2},
                {"threshold": 0.3, "recall": 96.5, "precision": 78.4, "fpr": 8.2, "tpr": 96.5},
                {"threshold": 0.5, "recall": 91.4, "precision": 90.0, "fpr": 2.1, "tpr": 91.4},
                {"threshold": 0.7, "recall": 84.1, "precision": 95.8, "fpr": 0.8, "tpr": 84.1},
                {"threshold": 0.9, "recall": 67.3, "precision": 99.1, "fpr": 0.1, "tpr": 67.3}
            ],
            "roc_curve": [
                {"threshold": 0.1, "recall": 99.2, "precision": 52.1, "fpr": 18.5, "tpr": 99.2},
                {"threshold": 0.3, "recall": 96.5, "precision": 78.4, "fpr": 8.2, "tpr": 96.5},
                {"threshold": 0.5, "recall": 91.4, "precision": 90.0, "fpr": 2.1, "tpr": 91.4},
                {"threshold": 0.7, "recall": 84.1, "precision": 95.8, "fpr": 0.8, "tpr": 84.1},
                {"threshold": 0.9, "recall": 67.3, "precision": 99.1, "fpr": 0.1, "tpr": 67.3}
            ]
        },
        "by_typology_difficulty": [
            {"typology": "burst_fanin", "difficulty": "easy", "recall": 98.0, "f1": 96.2, "sample_size": 25},
            {"typology": "burst_fanin", "difficulty": "medium", "recall": 93.4, "f1": 91.0, "sample_size": 30},
            {"typology": "burst_fanin", "difficulty": "hard", "recall": 85.2, "f1": 84.1, "sample_size": 20},
            {"typology": "structural_cycle", "difficulty": "easy", "recall": 96.5, "f1": 95.0, "sample_size": 18},
            {"typology": "structural_cycle", "difficulty": "medium", "recall": 91.2, "f1": 89.5, "sample_size": 22},
            {"typology": "structural_cycle", "difficulty": "hard", "recall": 82.0, "f1": 81.3, "sample_size": 15},
            {"typology": "rapid_pass_through", "difficulty": "easy", "recall": 97.1, "f1": 95.8, "sample_size": 24},
            {"typology": "rapid_pass_through", "difficulty": "medium", "recall": 92.0, "f1": 90.4, "sample_size": 28},
            {"typology": "rapid_pass_through", "difficulty": "hard", "recall": 84.5, "f1": 83.0, "sample_size": 18},
            {"typology": "layering_chain", "difficulty": "easy", "recall": 94.0, "f1": 92.5, "sample_size": 20},
            {"typology": "layering_chain", "difficulty": "medium", "recall": 89.0, "f1": 87.1, "sample_size": 25},
            {"typology": "layering_chain", "difficulty": "hard", "recall": 80.5, "f1": 79.2, "sample_size": 16},
            {"typology": "dormant_activation", "difficulty": "easy", "recall": 95.2, "f1": 94.0, "sample_size": 15},
            {"typology": "dormant_activation", "difficulty": "medium", "recall": 90.1, "f1": 88.4, "sample_size": 20},
            {"typology": "dormant_activation", "difficulty": "hard", "recall": 81.4, "f1": 80.0, "sample_size": 14}
        ],
        "fairness": [
            {"dimension": "city_cluster", "group": "Tier 1 (Metro)", "normal_fpr": 1.7, "hard_negative_fpr": 2.4, "parity_gap": 0.05},
            {"dimension": "city_cluster", "group": "Tier 2 (Emerging)", "normal_fpr": 1.9, "hard_negative_fpr": 2.6, "parity_gap": 0.04},
            {"dimension": "city_cluster", "group": "Tier 3 (Regional)", "normal_fpr": 1.8, "hard_negative_fpr": 2.5, "parity_gap": 0.02},
            {"dimension": "declared_income_band", "group": "low", "normal_fpr": 2.1, "hard_negative_fpr": 2.8, "parity_gap": 0.06},
            {"dimension": "declared_income_band", "group": "mid", "normal_fpr": 1.6, "hard_negative_fpr": 2.2, "parity_gap": 0.03},
            {"dimension": "declared_income_band", "group": "high", "normal_fpr": 1.5, "hard_negative_fpr": 2.0, "parity_gap": 0.02}
        ],
        "alert_reduction": {
            "baseline_alerts": 412,
            "ring_cases": 9,
            "reduction_pct": 97.8
        }
    }

def create_overview(rings):
    return {
        "kpis": {
            "activeRings": 7,
            "amountAtRisk": 4995000.00,
            "accountsUnderInvestigation": 45,
            "detectionRate": 92.5,
            "alertReductionPct": 97.8,
            "moneySaved": 1815000.00
        },
        "rings": [
            {"id": "R-106", "typology": "mixed", "riskScore": 95, "totalMoved": 2100000.0, "amountAtRisk": 1550000.0, "accountCount": 11, "status": "frozen"},
            {"id": "R-101", "typology": "burst_fanin", "riskScore": 94, "totalMoved": 1850000.0, "amountAtRisk": 1200000.0, "accountCount": 14, "status": "under_review"},
            {"id": "R-104", "typology": "structural_cycle", "riskScore": 96, "totalMoved": 1420000.0, "amountAtRisk": 985000.0, "accountCount": 6, "status": "new"},
            {"id": "R-105", "typology": "layering_chain", "riskScore": 93, "totalMoved": 950000.0, "amountAtRisk": 950000.0, "accountCount": 6, "status": "new"},
            {"id": "R-102", "typology": "rapid_pass_through", "riskScore": 91, "totalMoved": 820000.0, "amountAtRisk": 820000.0, "accountCount": 5, "status": "new"}
        ],
        "alertVolume": [
            {"bucket": "09:00", "burst_fanin": 0, "rapid_pass_through": 0, "dormant_activation": 0, "structural_cycle": 0, "layering_chain": 0},
            {"bucket": "10:00", "burst_fanin": 1, "rapid_pass_through": 0, "dormant_activation": 0, "structural_cycle": 1, "layering_chain": 0},
            {"bucket": "11:00", "burst_fanin": 2, "rapid_pass_through": 1, "dormant_activation": 0, "structural_cycle": 1, "layering_chain": 0},
            {"bucket": "12:00", "burst_fanin": 1, "rapid_pass_through": 2, "dormant_activation": 1, "structural_cycle": 0, "layering_chain": 1},
            {"bucket": "13:00", "burst_fanin": 0, "rapid_pass_through": 1, "dormant_activation": 1, "structural_cycle": 1, "layering_chain": 1},
            {"bucket": "14:00", "burst_fanin": 2, "rapid_pass_through": 0, "dormant_activation": 0, "structural_cycle": 0, "layering_chain": 2},
            {"bucket": "15:00", "burst_fanin": 1, "rapid_pass_through": 1, "dormant_activation": 0, "structural_cycle": 1, "layering_chain": 0},
            {"bucket": "16:00", "burst_fanin": 0, "rapid_pass_through": 0, "dormant_activation": 1, "structural_cycle": 0, "layering_chain": 1}
        ],
        "activity": [
            {"id": "ACT-1004", "kind": "frozen", "ringId": "R-106", "detail": "Hot debit-freeze applied across all aggregator and mule accounts.", "actor": "Kishore Kumar", "occurredAt": "2026-03-10T15:15:00Z"},
            {"id": "ACT-1002", "kind": "under_review", "ringId": "R-101", "detail": "Assigned to junior analyst for victim verification.", "actor": "Ananya Sharma", "occurredAt": "2026-03-10T11:25:00Z"},
            {"id": "ACT-1003", "kind": "detected", "ringId": "R-104", "detail": "High-confidence cycle detected (96 score).", "actor": "System", "occurredAt": "2026-03-10T10:45:00Z"}
        ],
        "detectionRate": 92.5,
        "previousPeriod": {
            "activeRings": 5,
            "amountAtRisk": 3800000.0,
            "accountsUnderInvestigation": 34,
            "detectionRate": 88.0
        }
    }

def create_simulation():
    return {
        "status": "stopped",
        "speed": 1.0,
        "cursor_ts": "2026-03-10T10:00:00Z",
        "window_minutes": 60,
        "elapsed_seconds": 0
    }

def main():
    rings = create_rings()
    timelines = create_timelines(rings)
    accounts = create_accounts(rings)
    cases_actions = create_cases_actions()
    metrics = create_metrics()
    overview = create_overview(rings)
    simulation = create_simulation()

    with open(FIXTURES_DIR / "rings.json", "w", encoding="utf-8") as f:
        json.dump(rings, f, indent=2)
    print("Generated rings.json")

    with open(FIXTURES_DIR / "timelines.json", "w", encoding="utf-8") as f:
        json.dump(timelines, f, indent=2)
    print("Generated timelines.json")

    with open(FIXTURES_DIR / "accounts.json", "w", encoding="utf-8") as f:
        json.dump(accounts, f, indent=2)
    print("Generated accounts.json")

    with open(FIXTURES_DIR / "cases_actions.json", "w", encoding="utf-8") as f:
        json.dump(cases_actions, f, indent=2)
    print("Generated cases_actions.json")

    with open(FIXTURES_DIR / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    print("Generated metrics.json")

    with open(FIXTURES_DIR / "overview.json", "w", encoding="utf-8") as f:
        json.dump(overview, f, indent=2)
    print("Generated overview.json")

    with open(FIXTURES_DIR / "simulation.json", "w", encoding="utf-8") as f:
        json.dump(simulation, f, indent=2)
    print("Generated simulation.json")

if __name__ == "__main__":
    main()
