# TraceMesh Module 6: Graph Builder and Rule Detectors

## Overview
Module 6 is responsible for ingesting account and transaction tabular datasets, constructing a directed weighted transaction multigraph using NetworkX, and executing six explainable rule-based anomaly detectors. It emits structured evidence per detection hit and computes normalized, explainable risk scores without relying on ground-truth labels.

---

## 1. Graph Construction (`build_graph`)

### Signature
```python
def build_graph(
    accounts_df: pd.DataFrame,
    txns_df: pd.DataFrame,
    window: Optional[Tuple[str, str]] = None,
    sink_accounts: Optional[Iterable[str]] = None,
) -> nx.MultiDiGraph:
```

### Specifications
- **Data Structure**: `networkx.MultiDiGraph`.
- **Nodes**: Each account is a node with attributes (`account_type`, `account_open_date`, `account_age_days`, `kyc_status`, `occupation`, `city`, `branch_id`, `is_sink`).
- **Edges**: Every successful transaction (`transaction_status == 'Success'`) is added as a directed edge (`sender_account -> receiver_account`).
- **Edge Attributes**: `transaction_id`, `amount`, `timestamp` (UTC datetime), `channel`, `transaction_type`.
- **Parallel Transactions**: Preserved using `transaction_id` as edge key.
- **Time Filtering**: Optional `window=(start, end)` includes both endpoints inclusively.
- **Window Presets**: Helper `get_window_view(graph, view)` supports `'10m'`, `'1h'`, `'24h'`, and `'7d'`.
- **Label Isolation**: Ground-truth labels (`is_mule`, `is_fraud`, `ring_id`, `fraud_pattern`) are strictly excluded.
- **Sink Handling**: Sink accounts are explicitly marked when reliable information is supplied via `sink_accounts`. Never inferred from mule labels.

---

## 2. The Six Suspicious Activity Detectors

### Detector 1: Fan-in Burst (`fan_in_burst`)
- **Objective**: Detect rapid aggregation of funds from multiple distinct originators into a single destination account.
- **Logic**: Evaluates in-edges over sliding temporal windows (`window_minutes`, default 60 min). Triggers when distinct senders $\ge 	ext{min\_senders}$ (default 5) and total inflow $\ge 	ext{min\_amount}$ (default INR 1,000).
- **Severity**: Critical if senders $\ge 2 	imes 	ext{min\_senders}$ or amount $\ge 5 	imes 	ext{min\_amount}$; otherwise High.
- **Evidence**: `unique_senders`, `total_inflow`, `window_minutes`, `transaction_count`, `sender_sample`.

### Detector 2: Fan-out Split (`fan_out_split`)
- **Objective**: Detect rapid distribution of funds from a single account across multiple beneficiaries within a short timeframe, especially following inbound transfers.
- **Logic**: Evaluates out-edges over rolling windows (`window_minutes`, default 60 min). Triggers when distinct recipients $\ge 	ext{min\_recipients}$ (default 4) and total outflow $\ge 	ext{min\_amount}$ (default INR 1,000). Inspects preceding inbound funds within `inflow_lookback_minutes` (default 60 min).
- **Severity**: Critical if preceded by substantial inflow and recipients $\ge 2 	imes 	ext{min\_recipients}$; otherwise High.
- **Evidence**: `unique_recipients`, `total_outflow`, `window_minutes`, `preceding_inflow`, `recipient_sample`.

### Detector 3: Rapid Pass-through (`rapid_pass_through`)
- **Objective**: Detect transit/mule accounts that receive inbound money and forward a large fraction to downstream accounts with minimal retention time.
- **Logic**: Pairs inbound transactions $(t_{in}, A_{in})$ with subsequent outbound transactions $(t_{out}, A_{out})$ where $0 \le t_{out} - t_{in} \le 	ext{max\_delay\_minutes}$ (default 30 min). Validates forward ratio $R = A_{out} / A_{in}$ within $[	ext{min\_forward\_ratio}, 	ext{max\_forward\_ratio}]$ (default $[0.80, 1.25]$).
- **Severity**: Critical if forward ratio $\ge 0.90$ and delay $\le 15$ min; High if delay $\le 30$ min; Medium otherwise.
- **Evidence**: `inflow_amount`, `outflow_amount`, `forward_ratio`, `delay_minutes`, `inflow_txn_id`, `outflow_txn_id`, `sender`, `recipient`.

### Detector 4: Layering Chain (`layering_chain`)
- **Objective**: Detect sequential money laundering hops through 3 to 6 intermediary accounts designed to obscure audit trails.
- **Logic**: Bounded DFS traversal from candidate entry points along directed forward edges. Constraints: $t_{i+1} \ge t_i$, $t_{i+1} - t_i \le 	ext{max\_hop\_delay\_minutes}$ (default 60 min), and $|A_{i+1} - A_i| / A_i \le 	ext{amount\_tolerance}$ (default 20%). Only traverses intermediary nodes with both in- and out-degree $\ge 1$.
- **Severity**: High if hops $\ge 4$, Medium if hops $= 3$.
- **Evidence**: `chain_hops`, `path_accounts`, `amounts`, `total_duration_minutes`, `hop_index`.

### Detector 5: Circular Flow (`circular_flow`)
- **Objective**: Detect round-trip transaction loops involving 3 to 5 accounts where funds return to originators within 24 hours.
- **Logic**: Extracts candidate subgraph of accounts with both in-degree $\ge 1$ and out-degree $\ge 1$. Identifies simple directed cycles of length $3 \le L \le 5$. Canonicalizes cycle representations via minimum lexicographical rotation to eliminate duplicate hits. Validates that cycle duration $\le 	ext{max\_cycle\_duration\_hours}$ (default 24h) and amounts match within `amount_tolerance` (default 25%).
- **Severity**: Critical if duration $\le 6$ hours; High if $\le 24$ hours.
- **Evidence**: `cycle_length`, `cycle_accounts`, `avg_amount`, `cycle_duration_hours`, `cycle_txns`.

### Detector 6: Dormant Activation (`dormant_active`)
- **Objective**: Detect dormant or newly opened accounts that remain idle for extended periods and suddenly awaken with bursts of transaction volume.
- **Logic**: Computes inactivity gaps either from `account_open_date` or consecutive transaction history gaps $> 	ext{dormant\_days\_threshold}$ (default 30 days). Evaluates sudden activation bursts ($\ge 3$ transactions or large volume within 48 hours). Integrates with `account_daily_summary.csv` when available.
- **Severity**: High if idle gap $\ge 60$ days; Medium otherwise.
- **Evidence**: `dormant_days`, `active_txn_count`, `active_volume`, `activation_date`.

---

## 3. Standardized Detector Hit Contract (`Hit`)

Every detector returns instances of `Hit`:
```python
@dataclass
class Hit:
    account_id: str
    code: str              # e.g. 'fan_in_burst', 'circular_flow'
    window_start: datetime # UTC timestamp
    window_end: datetime   # UTC timestamp
    severity: str          # 'low', 'medium', 'high', 'critical'
    evidence: Dict[str, Any]
    detail: str            # Plain-text narrative
```

Compatible with Supabase PostgreSQL `detector_hits` schema:
```sql
CREATE TABLE detector_hits (
    hit_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id BIGINT REFERENCES pipeline_runs(run_id),
    account_id TEXT REFERENCES accounts(account_id),
    code TEXT CHECK (code IN ('fan_in_burst', 'fan_out_split', 'rapid_pass_through', 'layering_chain', 'circular_flow', 'dormant_active')),
    window_start TIMESTAMPTZ,
    window_end TIMESTAMPTZ,
    severity TEXT,
    evidence_json JSONB,
    detail TEXT NOT NULL
);
```

---

## 4. Rule Scoring (`rule_scores`)

Produces an explainable risk score $S(a) \in [0.0, 1.0]$ for each account using a Noisy-OR accumulation formula:
$$S(a) = 1.0 - \prod_{h \in 	ext{hits}(a)} \left(1.0 - \min(0.95, w_{	ext{code}} 	imes 	ext{sev\_factor})ight)$$
- **Detector Weights**: Configurable in `config/detection_config.yaml`.
- **Severity Multipliers**: `low: 0.5`, `medium: 0.75`, `high: 1.0`, `critical: 1.25`.
- **Anti-Inflation**: Ensures scores saturate smoothly at 1.0 without uncontrolled runaway score inflation.
