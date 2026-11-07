import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from features.baselines import baseline_a, baseline_b, flag_top_n  # noqa: E402
from features.build_features import FEATURES, build_features  # noqa: E402

ACCOUNTS = pd.DataFrame({
    "account_id": ["A", "B", "C", "D", "SINK"],
    "open_date": ["2020-01-01", "2026-03-01", "2020-01-01", "2020-01-01", "2020-01-01"],
    "kyc_level": ["full", "minimal", "full", "full", "full"],
    "account_type": ["savings", "savings", "savings", "savings", "sink"],
    "city_cluster": ["c1"] * 5,
    "declared_income_band": ["mid", "low", "mid", "mid", "mid"],
    "bank_id": ["x"] * 5,
})
# A and C pay B; B forwards ~everything to D within minutes, then D cashes out
TXNS = pd.DataFrame({
    "src_account": ["A", "C", "B", "B", "D"],
    "dst_account": ["B", "B", "D", "D", "SINK"],
    "amount": [5000.0, 4800.0, 4900.0, 4800.0, 9000.0],
    "ts": ["2026-03-10T10:15:00Z", "2026-03-10T10:16:00Z", "2026-03-10T10:20:00Z",
           "2026-03-10T10:25:00Z", "2026-03-10T11:00:00Z"],
    "channel": ["UPI", "UPI", "UPI", "UPI", "ATM_WITHDRAWAL"],
})
WS, WE = pd.Timestamp("2026-03-10", tz="UTC"), pd.Timestamp("2026-03-11", tz="UTC")


def _feats(**kw):
    return build_features(TXNS, ACCOUNTS, WS, WE, **kw).set_index("account_id")


def test_shape_and_sinks_dropped():
    f = _feats()
    assert "SINK" not in f.index
    assert set(FEATURES) <= set(f.columns)
    assert len(f) == 4  # accounts with no activity still get a row


def test_mule_like_account_b():
    b = _feats().loc["B"]
    assert b["in_amount_total"] == 9800 and b["out_amount_total"] == 9700
    assert 0.98 < b["pass_through_ratio"] < 1.0
    assert b["unique_senders"] == 2 and b["unique_receivers"] == 1
    assert b["has_forward"] == 1 and b["median_forward_time_min"] <= 10
    assert b["max_in_1h"] == 2
    assert b["fast_forward_share"] == 1.0


def test_cash_out_and_profile():
    f = _feats()
    assert f.loc["D", "cash_out_share"] == 1.0
    assert f.loc["B", "kyc_level_ord"] == 0
    assert f.loc["B", "account_age_days"] < 30


def test_window_excludes_future():
    f = build_features(TXNS, ACCOUNTS, WS, pd.Timestamp("2026-03-10T10:18:00Z"),
                       account_ids=["B"]).set_index("account_id")
    assert f.loc["B", "in_txn_count"] == 2 and f.loc["B", "out_txn_count"] == 0


def test_baselines():
    feats = _feats().reset_index()
    a = baseline_a(feats)
    assert a["B"] > a["A"]
    b = baseline_b(TXNS, list(ACCOUNTS["account_id"]))
    assert b["D"] == 9000 and b["A"] == 5000
    assert flag_top_n(b, 1)["B"]  # B moves 9,700 out in a day, D 9,000
