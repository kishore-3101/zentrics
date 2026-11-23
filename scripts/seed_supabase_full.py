import json
import logging
from pathlib import Path
from backend.db import DB

logger = logging.getLogger("seed")

CITY_COORDS = {
    "MUMBAI": (19.0760, 72.8777, "Mumbai"),
    "DELHI": (28.6139, 77.2090, "Delhi"),
    "PUNE": (18.5204, 73.8567, "Pune"),
    "KANPUR": (26.4499, 80.3319, "Kanpur"),
    "KOLKATA": (22.5726, 88.3639, "Kolkata"),
    "DUBAI": (25.2048, 55.2708, "Dubai"),
    "BANGALORE": (12.9716, 77.5946, "Bengaluru"),
    "c1": (19.0760, 72.8777, "Mumbai"),
    "c2": (28.6139, 77.2090, "Delhi"),
}

DEVICES = [
    ("DEV_ANDR_01", "Samsung Galaxy S23 (Android 14)", "103.21.124.45"),
    ("DEV_IOS_02", "Apple iPhone 15 (iOS 17.4)", "117.205.88.12"),
    ("DEV_WEB_03", "Chrome / Windows 11 Desktop", "49.204.110.5"),
    ("DEV_ATM_04", "NCR SelfServ 84 ATM Terminal", "172.16.4.10"),
    ("DEV_UPI_05", "OnePlus 11 (Android 13)", "106.51.24.89"),
]

def seed():
    fixtures_dir = Path("backend/fixtures")
    with open(fixtures_dir / "rings.json") as f:
        rings = json.load(f)
    with open(fixtures_dir / "alerts.json") as f:
        alerts = json.load(f)
    with open(fixtures_dir / "timelines.json") as f:
        timelines = json.load(f)
    with open(fixtures_dir / "cases_actions.json") as f:
        cases_actions = json.load(f)

    # 1. Pipeline Run #1
    sql_lines = [
        "BEGIN;",
        "INSERT INTO datasets (dataset_id, name, role, is_active) VALUES ('canonical_benchmark', 'TraceMesh Canonical Benchmark Syndicates', 'demo', true) ON CONFLICT (dataset_id) DO NOTHING;",
        "INSERT INTO pipeline_runs (run_id, dataset_id, kind, status, finished_at, duration_s, config_json, n_txns) "
        "OVERRIDING SYSTEM VALUE VALUES (1, 'canonical_benchmark', 'batch', 'done', timezone('utc', now()), 0.5, '{\"weights\": \"fused\"}'::jsonb, 100) "
        "ON CONFLICT (run_id) DO UPDATE SET status = 'done';"
    ]

    # Collect accounts from nodes and edges
    all_accounts = {}
    for ring_id, rdata in rings.items():
        for n in rdata.get("nodes", []):
            aid = n["account_id"]
            cluster = n.get("city_cluster", "MUMBAI").upper()
            lat, lon, city = CITY_COORDS.get(cluster, (19.0760, 72.8777, "Mumbai"))
            kyc = n.get("kyc_level", "full").lower()
            if "verif" in kyc or "full" in kyc:
                kyc = "full"
            else:
                kyc = "minimal"

            atype = n.get("account_type", "savings").lower()
            if atype not in ('savings', 'current', 'wallet', 'sink'):
                atype = 'savings'

            band = n.get("declared_income_band", "mid").lower()
            if band not in ('low', 'lower_mid', 'mid', 'upper_mid', 'high'):
                band = 'mid'

            all_accounts[aid] = {
                "account_id": aid,
                "open_date": n.get("open_date", "2021-01-01"),
                "kyc_level": kyc,
                "account_type": atype,
                "city_cluster": cluster,
                "declared_income_band": band,
                "latitude": lat,
                "longitude": lon,
                "city": city,
            }

        # Ensure all source and destination accounts from edges exist
        for e in rdata.get("edges", []):
            for acc in (e["src_account"], e["dst_account"]):
                if acc not in all_accounts:
                    all_accounts[acc] = {
                        "account_id": acc,
                        "open_date": "2021-01-01",
                        "kyc_level": "full",
                        "account_type": "savings",
                        "city_cluster": "MUMBAI",
                        "declared_income_band": "mid",
                        "latitude": 19.0760,
                        "longitude": 72.8777,
                        "city": "Mumbai",
                    }

    for a in all_accounts.values():
        sql_lines.append(
            f"INSERT INTO accounts (account_id, open_date, kyc_level, account_type, city_cluster, declared_income_band, latitude, longitude, city) "
            f"VALUES ('{a['account_id']}', '{a['open_date']}', '{a['kyc_level']}', '{a['account_type']}', '{a['city_cluster']}', '{a['declared_income_band']}', {a['latitude']}, {a['longitude']}, '{a['city']}') "
            f"ON CONFLICT (account_id) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, city = EXCLUDED.city;"
        )

    # Collect transactions
    dev_idx = 0
    for ring_id, rdata in rings.items():
        for e in rdata.get("edges", []):
            tid = e.get("txn_id") or e.get("edge_id")
            src = e["src_account"]
            dst = e["dst_account"]
            amt = e["amount"]
            chan = e.get("channel", "UPI")
            if chan not in ('UPI', 'IMPS', 'NEFT', 'RTGS', 'ATM_WITHDRAWAL', 'WEB', 'MOBILE_BANKING', 'NET_BANKING', 'P2P_CRYPTO', 'Web', 'Mobile'):
                chan = "UPI"
            ts = e.get("ts", "2026-03-10T10:00:00Z")
            dev_id, dev_type, ip = DEVICES[dev_idx % len(DEVICES)]
            dev_idx += 1
            src_acc = all_accounts.get(src, {})
            lat = src_acc.get("latitude", 19.076)
            lon = src_acc.get("longitude", 72.877)

            sql_lines.append(
                f"INSERT INTO transactions (txn_id, ts, src_account, dst_account, amount, channel, device_id, device_type, ip_address, latitude, longitude) "
                f"VALUES ('{tid}', '{ts}', '{src}', '{dst}', {amt}, '{chan}', '{dev_id}', '{dev_type}', '{ip}', {lat}, {lon}) "
                f"ON CONFLICT (txn_id) DO NOTHING;"
            )

    # Cases & Rings
    for a in alerts:
        rid = a["ring_id"]
        cid = a.get("case_id", 100)
        fp = a.get("fingerprint", f"fp_{rid.lower()}")
        rtype = a.get("ring_type", "circular_flow")
        score = a.get("score", 90.0)
        prio = a.get("priority", 1000.0)
        moved = a.get("amount_moved", 100000.0)
        cashed = a.get("amount_cashed", 0.0)
        at_risk = a.get("amount_at_risk", moved)
        dur = a.get("duration_min", 30.0)
        nacct = a.get("n_accounts", 5)
        nvic = a.get("n_victims", 1)
        tags = a.get("pattern_tags", [])
        tags_arr = "{" + ",".join(f'"{t}"' for t in tags) + "}"
        expl = a.get("explanation", "").replace("'", "''")
        recom = a.get("recommended", "").replace("'", "''")
        status = a.get("status", "new")
        detected = a.get("detected_at", "2026-03-10T10:00:00Z")

        # Case
        sql_lines.append(
            f"INSERT INTO cases (case_id, status, priority, first_seen_run_id, last_seen_run_id) "
            f"OVERRIDING SYSTEM VALUE VALUES ({cid}, '{status}', {prio}, 1, 1) "
            f"ON CONFLICT (case_id) DO UPDATE SET status = EXCLUDED.status, priority = EXCLUDED.priority;"
        )
        sql_lines.append(
            f"INSERT INTO case_fingerprints (case_id, fingerprint, run_id) VALUES ({cid}, '{fp}', 1) "
            f"ON CONFLICT (case_id, fingerprint) DO NOTHING;"
        )

        # Ring
        sql_lines.append(
            f"INSERT INTO rings (run_id, ring_id, fingerprint, ring_type, score, priority, amount_moved, amount_cashed, amount_at_risk, duration_min, n_accounts, n_victims, pattern_tags, explanation, recommended, status, detected_at) "
            f"VALUES (1, '{rid}', '{fp}', '{rtype}', {score}, {prio}, {moved}, {cashed}, {at_risk}, {dur}, {nacct}, {nvic}, '{tags_arr}', '{expl}', '{recom}', '{status}', '{detected}') "
            f"ON CONFLICT (run_id, ring_id) DO UPDATE SET score = EXCLUDED.score, status = EXCLUDED.status;"
        )

        # Ring members
        rdata = rings.get(rid, {})
        for n in rdata.get("nodes", []):
            role = n.get("role", "mule")
            if role not in ('victim', 'collector', 'hacker', 'distributor', 'intermediator', 'mule', 'cash_out', 'sink'):
                role = 'mule'
            sql_lines.append(
                f"INSERT INTO ring_members (run_id, ring_id, account_id, role) "
                f"VALUES (1, '{rid}', '{n['account_id']}', '{role}') "
                f"ON CONFLICT (run_id, ring_id, account_id) DO UPDATE SET role = EXCLUDED.role;"
            )

        # Ring transactions
        for hop_idx, e in enumerate(rdata.get("edges", []), 1):
            tid = e.get("txn_id") or e.get("edge_id")
            sql_lines.append(
                f"INSERT INTO ring_transactions (run_id, ring_id, txn_id, hop_index) "
                f"VALUES (1, '{rid}', '{tid}', {hop_idx}) "
                f"ON CONFLICT (run_id, ring_id, txn_id) DO UPDATE SET hop_index = EXCLUDED.hop_index;"
            )

    # Actions
    for cid_str, act_list in cases_actions.items():
        try:
            cid_int = int(cid_str)
            for act in act_list:
                actor = act.get("actor", "Lead AML Investigator").replace("'", "''")
                action_name = act.get("action", "note")
                if action_name not in ('freeze', 'block', 'escalate', 'false_positive', 'note', 'status_change'):
                    action_name = 'note'
                f_st = act.get("from_status", "new")
                t_st = act.get("to_status", "under_review")
                note_text = act.get("notes", "").replace("'", "''")
                ts_act = act.get("ts", "2026-03-10T11:00:00Z")
                sql_lines.append(
                    f"INSERT INTO case_actions (case_id, actor, action, from_status, to_status, note, ts) "
                    f"VALUES ({cid_int}, '{actor}', '{action_name}', '{f_st}', '{t_st}', '{note_text}', '{ts_act}');"
                )
        except Exception:
            pass

    # Execute in clean chunks of 150 statements to prevent timeout
    chunk_size = 150
    total_chunks = (len(sql_lines) + chunk_size - 1) // chunk_size
    print(f"[*] Total statements to execute: {len(sql_lines)} across {total_chunks} batches...")

    for i in range(0, len(sql_lines), chunk_size):
        chunk = sql_lines[i : i + chunk_size]
        batch_num = (i // chunk_size) + 1
        print(f"[*] Executing Batch {batch_num}/{total_chunks} ({len(chunk)} statements)...")
        batch_sql = "BEGIN;\n" + "\n".join(chunk) + "\nCOMMIT;"
        DB.execute(batch_sql, timeout=60)

    print("[SUCCESS] All tables populated in Supabase!")

if __name__ == "__main__":
    seed()
