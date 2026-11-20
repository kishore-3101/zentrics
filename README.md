# Mule Account Ring Detection System – Machine Learning & Graph Intelligence Pipeline

> **Production-Grade Machine Learning Pipeline for Detecting Suspicious Mule Accounts and Connected Fraudulent Transaction Networks**  
> Built for Cybersecurity, FinTech, and Digital Trust Hackathons and Financial Crime Units.

---

## 1. Project Overview & Architecture

Money mule networks form the core backbone of organized financial crime, money laundering, and illicit fund siphonage. In modern digital banking environments, bad actors evade traditional per-transaction rule filters by rapidly chaining funds through multi-tier intermediate accounts ("mules"), employing smurfing, layering chains, fan-out disbursements, and circular flows.

This repository provides an **end-to-end, leak-free, production-grade machine learning and graph intelligence pipeline** that detects individual mule accounts and clusters them into high-priority organized fraud rings.

### System Architecture

```
                                  RAW DATA SOURCES
                  accounts.csv  |  transactions.csv  |  daily_summary.csv
                                         │
                                         ▼
                             DATA VALIDATION & QUALITY
                         (Schema, Types, Duplicates, Gaps)
                                         │
                                         ▼
                            PREPROCESSING & ENCODING
                       (Timestamps, Encodings, Clean Data)
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
     TRANSACTION GRAPH BUILDER                       BEHAVIOURAL FEATURE EXTRACTOR
 (Directed Graph, PageRank, Degree,                (Volume/Flow, Time-to-Forward, Burst,
 Centrality, Communities, Triangles)                 Sliding Windows, Profile, Summary)
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         ▼
                              ACCOUNT FEATURE STORE
                             (63 Canonical Features)
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
     RULE-BASED DETECTORS (6)                        SUPERVISED ML CLASSIFIER
  1. Fan-In Burst                                 • Primary: XGBoost (GBDT)
  2. Rapid Pass-Through                           • Baselines: Random Forest, LogReg
  3. Fan-Out Split                                • Ring-Aware Stratified Splitting
  4. Layering Chain                               • scale_pos_weight for Imbalance
  5. Circular Flow                                • Leakage Free (No Target / Scenario)
  6. Dormant Activation                           • TreeSHAP Explainability
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         ▼
                             UNIFIED RISK SCORE FUSION
             Risk Score = 100 × (0.50 × P_ML + 0.30 × S_Rule + 0.20 × R_Neighbor)
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
        SUSPICIOUS ACCOUNTS                           FRAUD RING DETECTION
      Low / Medium / High Risk                 (Induced Subgraphs, Connected Comps,
      Alert Generation (Top CSV)                Priority Ranking, Capital at Risk)
                                         │
                                         ▼
                               FASTAPI SERVING LAYER
                    (/predict, /batch, /alerts, /rings, /metrics)
```

---

## 2. Rationale for XGBoost Selection

While deep learning architectures (e.g. MLPs, autoencoders) are popular in unstructured computer vision and NLP tasks, **Gradient Boosted Decision Trees (XGBoost)** dominate structured, tabular financial transaction classification:

1. **Heterogeneous Feature Distributions:** Financial transaction features combine extreme power-law distributions (amounts, degrees, centrality) with bounded ratios (pass-through $\in [0, 1]$, night transaction percentage) and categorical indicators. Tree ensembles are scale-invariant and split on feature rank, requiring no artificial feature standardizations.
2. **Extreme Class Imbalance:** In banking ecosystems, mule accounts represent a rare class ($<15\%$). XGBoost allows exact calculation of negative-to-positive class weight `scale_pos_weight = N_neg / N_pos` strictly from the training partition, directly tuning split gradients to maximize the minority class objective without artificial synthesis (e.g. SMOTE) that distorts natural topology.
3. **Capture of Non-Linear Compound Thresholds:** Fraud rules naturally rely on non-linear step functions (e.g., *pass-through ratio $> 0.85$ AND median time-to-forward $< 15\text{ min} \implies \text{flag}$*). Tree algorithms partition this state space with zero parametric distortion.
4. **Native Handling of Graph Sparsity:** Accounts without incoming or outgoing transactions have structural graph zeroes. Decision trees route missing or default values along optimal default split paths.
5. **Exact Polynomial-Time TreeSHAP:** Regulatory compliance and Digital Trust frameworks mandate actionable explanations for Suspicious Activity Reports (SAR/STR). XGBoost features native integration with TreeSHAP, computing exact Shapley values in $O(TLD^2)$ time rather than exponential sampling.

---

## 3. Dataset Schema & Inferred Column Mapping

The pipeline reads raw datasets from `data/raw/` (or auto-copies from `mule_account_dataset/`) without modifying the originals.

### Canonical Schema

| Dataset | Canonical Columns | Field Description |
|:---|:---|:---|
| `accounts.csv` | `account_id`, `open_date`, `kyc_level`, `account_type`, `city_cluster`, `declared_income_band`, `is_mule`, `ring_id`, `scenario` | Account metadata, customer profile, and ground-truth labels. |
| `transactions.csv` | `txn_id`, `ts`, `src_account`, `dst_account`, `amount`, `channel`, `is_fraud_related` | Directed edge transactions between accounts with timestamps and channels. |
| `fraud_rings.csv` *(opt)* | `ring_id`, `pattern_type`, `member_count`, `total_laundered` | Known organized fraud syndicate reference table. |
| `account_daily_summary.csv` *(opt)* | `account_id`, `date`, `daily_txns`, `failed_txns`, etc. | Daily time-series activity aggregated per account. |

### Column Mapping Adapter
The data loader (`src/data_loader.py`) automatically maps equivalent field variations across external CSV formats:
- `sender_account`, `source_account`, `src_id` $\to$ `src_account`
- `receiver_account`, `target_account`, `dest_account`, `dst_id` $\to$ `dst_account`
- `timestamp`, `txn_time`, `datetime`, `date_time` $\to$ `ts`
- `transaction_id`, `tx_id`, `id` $\to$ `txn_id`
- `mule_flag`, `is_fraud`, `target`, `label` $\to$ `is_mule`

### Ground-Truth & Target Leakage Prevention Rule
To prevent target leakage:
- `is_mule` is strictly reserved as the training target and is never used as a model feature.
- `ring_id`, `is_fraud_related`, and `scenario` are strictly removed from the feature matrix prior to training and inference.
- Graph metrics (PageRank, degree, centrality) and neighbor risk scores rely **only on raw topology and ML probabilities**, never on ground-truth labels.

---

## 4. Account-Level Feature Engineering Pipeline

Every account is represented as a comprehensive 63-dimensional feature vector:

### A. Volume & Flow Metrics
- **Total Inflow / Outflow:** $\sum \text{Amount}_{\text{in}}$, $\sum \text{Amount}_{\text{out}}$
- **Transaction Counts:** Count of incoming and outgoing events.
- **Averages & Maximums:** Mean and peak transaction sizes.
- **Net Flow & Retained Ratio:** $\text{Net} = \text{Inflow} - \text{Outflow}$; $\text{Retained Ratio} = \frac{\text{Net}}{\text{Inflow} + 1}$.
- **Pass-Through Ratio:** $\text{Pass-Through} = \frac{\text{Outflow}}{\text{Inflow} + \epsilon}$ (capped safely; mules exhibit ratios $>0.85$).

### B. Time-Based & Window Features
- **Median & Mean Time-to-Forward (TTF):** Inter-arrival matching between incoming deposits and subsequent outgoing transfers.
- **Night-Time Percentage:** Ratio of transactions occurring between 22:00 and 06:00.
- **Rolling Windows:** Transaction frequency aggregated over 10-minute, 1-hour, 24-hour, and 7-day intervals.
- **Burstiness Index:** Coefficient of variation of inter-transaction time gaps $\frac{\sigma_{\Delta t}}{\mu_{\Delta t}}$ (high values reflect burst-and-dump behavior).
- **Long Inactivity Flag:** Binary indicator for accounts resuming after $>90$ days of silence.

### C. Profile & Activity Metrics
- **Account Age (days):** Elapsed time from `open_date` to transaction window.
- **Balance per Age Day:** Normalized velocity of wealth accumulation.
- **Categorical Encodings:** Label encodings for KYC level, account type, occupation, and city cluster.
- **Daily Summary Aggregations:** Average daily transaction count, failure rate, unique counterparty velocity.

---

## 5. Graph Construction & Centrality Metrics

Using NetworkX, the pipeline constructs a directed transaction graph $G = (V, E)$ where nodes $V$ represent bank accounts and directed edges $E = (u, v)$ represent money transfers with amount and timestamp attributes.

```
(Sender A) ──[$5,000 / 10:15 AM]──► (Mule Account M) ──[$4,850 / 10:22 AM]──► (Beneficiary B)
```

For the real transaction dataset ($N = 18,129$ active nodes, $E = 26,303$ edges), the following structural metrics are calculated:

1. **In-Degree & Out-Degree:** Measures asymmetry between funds collection (fan-in) and disbursement (fan-out).
2. **Unique Counterparties & Fan Ratios:** Identifies dispersion patterns.
3. **PageRank ($\alpha=0.85$):** Quantifies global structural importance and capital concentration.
4. **Betweenness Centrality ($k=500$ sampled pivots):** Identifies critical "bridge" accounts routing funds between otherwise disconnected communities.
5. **Local Clustering / Triangle Participation:** Detects circular money routing loops.
6. **Community Membership:** Fast Greedy Modularity Community detection assigning accounts to structural subnetworks.

---

## 6. Six Rule-Based Detection Algorithms

Six independent, parameterized heuristic detectors inspect account transactions for signature fraud patterns:

| Detector | Pattern Name | Logic & Thresholds | Behavioral Rationale |
|:---|:---|:---|:---|
| **Rule 1** | **Fan-In Burst** | $\ge 10$ unique senders within 1 hour; total incoming $\ge \$1,000$. | Smurfing / aggregation of scam proceeds from multiple victims. |
| **Rule 2** | **Rapid Pass-Through** | Forwards $\ge 85\%$ of received funds within 15 minutes. | Classic transit mule holding zero inventory to minimize clawback risk. |
| **Rule 3** | **Fan-Out Split** | Single large deposit split and distributed to $\ge 4$ new recipients in $\le 30$ min. | Layering and dispersion of stolen funds across secondary mules. |
| **Rule 4** | **Layering Chain** | Path of $\ge 3$ consecutive hops; amounts matched within $\pm 15\%$; delays $< 30$ min. | Structured layering to obscure audit trails. |
| **Rule 5** | **Circular Flow** | Directed cycles of length 3 to 5 within 24 hours; amount similarity within $\pm 20\%$. | Round-tripping / wash trading to fabricate transaction history. |
| **Rule 6** | **Dormant Activation** | Account idle for $> 90$ days (or $< 14$ days old) suddenly transacting $> \$5,000$. | Compromised sleeper accounts or newly minted mule accounts. |

*Results are exported to `outputs/processed/rule_detection_results.csv` with individual flags, raw scores, and human-readable audit explanations.*

---

## 7. Unified Risk Score Fusion Formula

To balance precision and recall, the final risk score combines supervised machine learning probabilities, rule triggers, and structural neighborhood exposure:

$$\text{Account Risk Score} = 100 \times \left(0.50 \cdot P_{\text{ML}} + 0.30 \cdot S_{\text{Rule}} + 0.20 \cdot R_{\text{Neighbor}}\right)$$

Where:
- $P_{\text{ML}} \in [0, 1]$: Calibrated prediction probability from the XGBoost model.
- $S_{\text{Rule}} \in [0, 1]$: Normalized rule trigger score $\min\left(1.0, \frac{\text{Triggered Detectors}}{3.0}\right)$.
- $R_{\text{Neighbor}} \in [0, 1]$: Mean ML risk probability of all direct counterparties with whom the account transacted:
  $$R_{\text{Neighbor}}(u) = \frac{1}{|\mathcal{N}(u)|} \sum_{v \in \mathcal{N}(u)} P_{\text{ML}}(v)$$

### Risk Tiers & Recommended Action Protocols

| Tier | Score Range | Action Required |
|:---|:---|:---|
| **High Risk** | **$75.0 - 100.0$** | **Immediate account freeze**, suspension of digital outbound transfers, and mandatory filing of Suspicious Transaction Reports (STR/SAR). |
| **Medium Risk** | **$40.0 - 74.99$** | **Enhanced Due Diligence (EDD)**: Step-up authentication, manual analyst review of recent counterparties, lowering of daily velocity limits. |
| **Low Risk** | **$0.0 - 39.99$** | **Standard automated monitoring**: No disruption to legitimate customer operations. |

---

## 8. Graph-Based Fraud Ring Detection

Individual accounts flagged with $\text{Account Risk Score} \ge 60.0$ are projected onto the transaction graph to form an **induced high-risk subgraph** $G_{\text{suspicious}}$.

1. **Connected Component Clustering:** Weakly connected components of size $\ge 3$ accounts are isolated as candidate fraud rings.
2. **Ring Metrics Extraction:** For each ring, the pipeline computes:
   - Account membership count
   - Mean and peak risk scores
   - Total money moved and total amount at risk
   - Active duration window and counterparty boundary diversity
3. **Ring Priority Ranking:**
   $$\text{Priority} = 0.35 \cdot \overline{\text{Risk}} + 0.25 \cdot \text{Vol}_{\text{norm}} + 0.20 \cdot \text{Size}_{\text{norm}} + 0.20 \cdot \text{Pattern}_{\text{norm}}$$

*Outputs are saved to `outputs/fraud_rings.csv` sorted by priority for compliance task forces.*

---

## 9. Model Performance & Evaluation Metrics

The models were evaluated on a held-out test set of **6,000 accounts** partitioned using a ring-aware stratified split to prevent information leakage.

### Real Test Set Evaluation Results

| Model | Accuracy | Precision | Recall | F1-Score | ROC-AUC | PR-AUC | False Positive Rate | False Negative Rate |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Logistic Regression** | 0.9480 | 0.7953 | 0.8860 | 0.8382 | 0.9695 | 0.9291 | 0.0409 | 0.1140 |
| **Random Forest** | 0.9705 | 0.9016 | 0.9046 | 0.9031 | 0.9801 | 0.9532 | 0.0177 | 0.0954 |
| **XGBoost (No Graph)** | 0.9583 | 0.8499 | 0.8816 | 0.8654 | 0.9735 | 0.9369 | 0.0279 | 0.1184 |
| **XGBoost (With Graph)** | **0.9738** | **0.9162** | **0.9112** | **0.9137** | **0.9814** | **0.9564** | **0.0149** | **0.0888** |

### XGBoost Cross-Validation Stability
- **5-Fold Stratified CV Mean F1:** **0.9269**
- **5-Fold Stratified CV Std F1:** **0.0083** (demonstrating outstanding generalization without overfitting)

### Confusion Matrix on Held-Out Test Set ($N=6,000$)
- **True Negatives (Legitimate Correctly Identified):** 5,012
- **False Positives (False Alarms):** 76 ($FPR = 1.49\%$)
- **False Negatives (Missed Mules):** 81 ($FNR = 8.88\%$)
- **True Positives (Mules Correctly Caught):** 831

---

## 10. Baseline Approach Comparison Table & Graph Feature Lift

To demonstrate the direct value of topological analysis and score fusion, we evaluated four distinct approaches on the exact same test dataset (Section 11 requirement):

| Approach | Precision | Recall | F1-Score | PR-AUC | FPR | TP | FP | FN | TN |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **A. Rule-Based Detection Alone** | 0.5631 | 0.3816 | 0.4549 | 0.3332 | 0.0531 | 348 | 270 | 564 | 4,818 |
| **B. ML without Graph Features** | 0.8499 | 0.8816 | 0.8654 | 0.9369 | 0.0279 | 804 | 142 | 108 | 4,946 |
| **C. ML with Graph Features** | **0.9162** | **0.9112** | **0.9137** | **0.9564** | **0.0149** | **831** | **76** | **81** | **5,012** |
| **D. Full Score Fusion (ML + Rule + Graph)** | **0.9278** | **0.9024** | **0.9150** | **0.9556** | **0.0126** | **823** | **64** | **89** | **5,024** |

### Key Takeaways & Graph Lift Analysis:
- **Graph Feature Lift:** Incorporating NetworkX graph features (PageRank, degree, betweenness centrality, community ID, triangles) increases the model's F1-score from **0.8654 to 0.9137 (+4.83 percentage points)**.
- **False Alarm Suppression:** Graph features halved the false positive rate from **2.79% down to 1.49%** (cutting false accusations from 142 to 76).
- **Score Fusion Advantage:** Full score fusion yields the lowest False Positive Rate (**1.26%**, with only 64 false alarms across 5,088 legitimate accounts) and highest Precision (**92.78%**), minimizing analyst investigation fatigue.

---

## 11. Pipeline Execution Guide

### Prerequisites
- Python 3.10+ (tested on Python 3.11)
- Install dependencies:
  ```bash
  pip install -r requirements.txt
  ```

### Training Pipeline Execution
Run the complete end-to-end training pipeline:
```bash
python train.py
```
*Executes data loading, validation, preprocessing, graph construction, feature extraction, 6-detector execution, model training (LR, RF, XGBoost), 5-fold CV, full evaluation, SHAP analysis, risk scoring, ring detection, and visualization generation.*

### Inference Pipeline Execution (No Retraining)
Run batch inference using pre-trained artifacts on new or full dataset:
```bash
python predict.py
```
*Loads `models/mule_detection_xgboost.pkl` and `models/feature_columns.json`, scoring all accounts, generating alerts, and clustering rings into `outputs/` without model re-fitting.*

### Unit Test Execution
Execute the comprehensive test suite (data validation, feature math, graph metrics, ML leakage prevention, API endpoints):
```bash
python -m pytest tests/ -v
```

---

## 12. FastAPI Serving & API Reference

Start the production FastAPI server:
```bash
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive Swagger documentation is available at `http://localhost:8000/docs`.

### API Endpoints

#### 1. System Health Check
- **`GET /health`**
  ```json
  {
    "status": "ok",
    "model_loaded": true,
    "model_file": "models/mule_detection_xgboost.pkl"
  }
  ```

#### 2. Single Account Real-Time Risk Scoring
- **`POST /predict`**
  ```bash
  curl -X POST "http://localhost:8000/predict" \
       -H "Content-Type: application/json" \
       -d '{
         "account_id": "ACC_09842",
         "total_incoming": 125000.0,
         "total_outgoing": 124200.0,
         "passthrough_ratio": 0.9936,
         "ttf_median_minutes": 8.4,
         "graph_pagerank": 0.0034,
         "graph_in_degree": 14,
         "graph_out_degree": 6,
         "night_txn_pct": 0.42,
         "rule_detector_count": 3
       }'
  ```
  **Response:**
  ```json
  {
    "account_id": "ACC_09842",
    "mule_probability": 0.9412,
    "account_risk_score": 94.12,
    "risk_category": "High Risk",
    "top_features": ["passthrough_ratio", "ttf_median_minutes", "graph_pagerank"],
    "explanation": "Account flagged because of: passthrough_ratio, ttf_median_minutes, graph_pagerank"
  }
  ```

#### 3. Batch Scoring
- **`POST /predict/batch`**
  - Accepts a JSON array of accounts and returns predictions with aggregate high-risk counts.

#### 4. Active High-Risk Alerts
- **`GET /alerts?limit=50`**
  - Returns prioritized high-risk accounts requiring urgent compliance review.

#### 5. Fraud Rings Overview & Details
- **`GET /rings`**
  - Returns detected syndicate components, size, money moved, and priority scores.
- **`GET /rings/{ring_id}`**
  - Returns full account member rosters, transaction flow paths, and structural patterns.

#### 6. Pipeline Metrics
- **`GET /metrics`**
  - Returns current model performance indicators, scored volumes, and ring statistics.

---

## 13. Limitations & Future Roadmap

1. **Large-Scale Graph Processing:** For transaction graphs exceeding 100M+ edges, in-memory NetworkX can be substituted with distributed graph engines like **Apache Spark GraphX** or GPU-accelerated **NVIDIA cuGraph**.
2. **Graph Neural Networks (GNNs):** Integrating Relational Graph Convolutional Networks (R-GCN) or Graph Attention Networks (GAT) would allow joint, end-to-end representation learning directly over heterogeneous multi-relational edges (e.g., transfers, shared devices, shared IP).
3. **Real-Time Streaming Ingestion:** Connecting the pipeline to Apache Kafka and Apache Flink to calculate dynamic graph features over 15-minute sliding windows for millisecond-level transaction intercept.

---

## 14. Project Directory Structure

```
mule-account-ring-detection/
├── api/
│   ├── main.py                     # FastAPI application with 8 core endpoints
│   └── schemas.py                  # Pydantic data schemas
├── data/
│   └── raw/                        # Protected raw dataset storage
├── models/
│   ├── feature_columns.json        # Canonical 63-feature column order
│   ├── model_metadata.json         # Hyperparameters, metrics, and timestamps
│   └── mule_detection_xgboost.pkl  # Trained production XGBoost model
├── outputs/
│   ├── all_account_risk_scores.csv # 0-100 risk scores for all 30,000 accounts
│   ├── baseline_approach_comparison.csv # Section 11 baseline table (A, B, C, D)
│   ├── data_quality_report.txt     # Ingestion integrity & cleaning log
│   ├── fraud_rings.csv             # Clustered fraud rings & priority ranks
│   ├── model_comparison_metrics.csv# LR vs RF vs XGBoost evaluation
│   ├── model_evaluation_report.txt # Comprehensive evaluation report
│   ├── shap_explanations.csv       # Account-level SHAP importance weights
│   ├── suspicious_accounts.csv     # Flagged medium & high risk accounts
│   ├── test_predictions.csv        # Actual vs predicted probabilities (N=6,000)
│   ├── processed/                  # Cleaned intermediate tables & features
│   └── visualizations/             # Generated visual charts
│       ├── baseline_comparison.png
│       ├── class_distribution.png
│       ├── confusion_matrix_xgboost.png
│       ├── feature_importance_xgboost.png
│       ├── model_comparison.png
│       ├── pr_curve_xgboost.png
│       ├── roc_curve_xgboost.png
│       └── shap_summary.png
├── src/
│   ├── config.py                   # Central paths, thresholds, and mappings
│   ├── data_loader.py              # Schema mapping & safe loading
│   ├── data_validation.py          # Data hygiene, duplicate & range audits
│   ├── feature_engineering.py      # Account-level feature extractor
│   ├── graph_builder.py            # NetworkX directed graph & centralities
│   ├── inference.py                # Standalone inference engine
│   ├── model_evaluation.py         # Metrics, plots, and SHAP explainers
│   ├── preprocessing.py            # Timestamp parsing and categorical encoding
│   ├── ring_detection.py           # Connected components ring clustering
│   ├── risk_scoring.py             # 3-way unified risk fusion formula
│   ├── rule_detectors.py           # 6 vectorized heuristic fraud detectors
│   └── train_model.py              # Ring-aware split, training & CV
├── tests/
│   ├── test_api.py                 # FastAPI integration test suite
│   ├── test_data_validation.py     # Data validation tests
│   ├── test_feature_engineering.py # Math & feature boundary tests
│   ├── test_graph_builder.py       # Graph topology tests
│   └── test_model.py               # Model training & leakage prevention tests
├── predict.py                      # Standalone inference entry point
├── requirements.txt                # Python environment specifications
├── train.py                        # Full end-to-end training pipeline
└── README.md                       # Comprehensive system documentation
```
