"""
train.py – Complete pipeline entry-point.
Run: python train.py
"""
import logging
import sys
import time
from pathlib import Path
import pandas as pd
import numpy as np

# --- Project root on PYTHONPATH ---
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s – %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(PROJECT_ROOT / "outputs" / "train.log", mode="w", encoding="utf-8"),
    ],
)
logger = logging.getLogger("train")

# ---------------------------------------------------------------------------
# Ensure output directories exist before the FileHandler tries to write
# ---------------------------------------------------------------------------
(PROJECT_ROOT / "outputs").mkdir(parents=True, exist_ok=True)
(PROJECT_ROOT / "outputs" / "processed").mkdir(parents=True, exist_ok=True)
(PROJECT_ROOT / "outputs" / "visualizations").mkdir(parents=True, exist_ok=True)
(PROJECT_ROOT / "outputs" / "reports").mkdir(parents=True, exist_ok=True)
(PROJECT_ROOT / "models").mkdir(parents=True, exist_ok=True)
(PROJECT_ROOT / "data" / "raw").mkdir(parents=True, exist_ok=True)

from src.data_loader      import load_all
from src.data_validation  import run_validation
from src.preprocessing    import preprocess_accounts, preprocess_transactions, save_processed
from src.graph_builder    import build_graph, compute_graph_features
from src.feature_engineering import build_account_features
from src.rule_detectors   import run_all_rules
from src.train_model      import train
from src.model_evaluation import evaluate, evaluate_approaches
from src.risk_scoring     import compute_risk_scores
from src.ring_detection   import detect_rings


def main():
    t0 = time.time()
    logger.info("=" * 60)
    logger.info("MULE ACCOUNT RING DETECTION – TRAINING PIPELINE")
    logger.info("=" * 60)

    # -----------------------------------------------------------------------
    # 1. LOAD DATA
    # -----------------------------------------------------------------------
    logger.info("\n[STEP 1] Loading datasets…")
    datasets = load_all()
    accounts_raw     = datasets["accounts"]
    transactions_raw = datasets["transactions"]
    fraud_rings_raw  = datasets["fraud_rings"]
    daily_summary    = datasets["daily_summary"]

    # -----------------------------------------------------------------------
    # 2. VALIDATE
    # -----------------------------------------------------------------------
    logger.info("\n[STEP 2] Validating data…")
    cleaned = run_validation(
        accounts_raw, transactions_raw, fraud_rings_raw, daily_summary
    )
    accounts_val     = cleaned["accounts"]
    transactions_val = cleaned["transactions"]

    # -----------------------------------------------------------------------
    # 3. PREPROCESS
    # -----------------------------------------------------------------------
    logger.info("\n[STEP 3] Preprocessing…")
    accounts_pp     = preprocess_accounts(accounts_val)
    transactions_pp = preprocess_transactions(transactions_val)
    save_processed(accounts_pp, transactions_pp)

    # -----------------------------------------------------------------------
    # 4. BUILD GRAPH
    # -----------------------------------------------------------------------
    logger.info("\n[STEP 4] Building transaction graph…")
    G = build_graph(transactions_pp)
    graph_features = compute_graph_features(G, accounts_pp)

    # -----------------------------------------------------------------------
    # 5. FEATURE ENGINEERING
    # -----------------------------------------------------------------------
    logger.info("\n[STEP 5] Engineering account features…")
    account_features = build_account_features(
        accounts_pp, transactions_pp,
        graph_features=graph_features,
        daily_summary=daily_summary if not daily_summary.empty else None,
    )

    # -----------------------------------------------------------------------
    # 6. RULE-BASED DETECTION
    # -----------------------------------------------------------------------
    logger.info("\n[STEP 6] Running rule-based detectors…")
    rule_results = run_all_rules(transactions_pp, accounts_pp)

    # Merge rule flags into account_features for model training
    rule_flag_cols = [c for c in rule_results.columns
                      if c.endswith("_flag") or c == "rule_score_raw" or c == "rule_detector_count"]
    merged_features = account_features.merge(
        rule_results[["account_id"] + rule_flag_cols],
        on="account_id", how="left"
    )
    # Fill zeros
    merged_features[rule_flag_cols] = merged_features[rule_flag_cols].fillna(0)

    # -----------------------------------------------------------------------
    # 7–9. TRAIN MODELS
    # -----------------------------------------------------------------------
    logger.info("\n[STEP 7–9] Training ML models…")
    if "is_mule" not in merged_features.columns:
        logger.error(
            "CRITICAL: 'is_mule' target column not found in feature table.\n"
            "Supervised training cannot proceed without ground-truth labels.\n"
            "Please ensure accounts.csv contains an 'is_mule' column."
        )
        sys.exit(1)

    train_output = train(merged_features, target_col="is_mule")

    # -----------------------------------------------------------------------
    # 10. EVALUATE
    # -----------------------------------------------------------------------
    logger.info("\n[STEP 10] Evaluating models…")
    evaluate(train_output)

    # -----------------------------------------------------------------------
    # 11. RISK SCORING
    # -----------------------------------------------------------------------
    logger.info("\n[STEP 11] Computing account risk scores…")
    # Build ML probabilities for all accounts in merged_features
    from src.inference import predict_proba
    import json
    with open(PROJECT_ROOT / "models" / "feature_columns.json") as f:
        feat_cols = json.load(f)

    import numpy as np
    all_X = merged_features.copy()
    for c in feat_cols:
        if c not in all_X.columns:
            all_X[c] = 0.0
    all_probas = predict_proba(all_X[feat_cols].fillna(0))
    ml_probabilities = dict(zip(merged_features["account_id"], all_probas))
    ml_prob_series = merged_features["account_id"].map(ml_probabilities)
    ml_prob_series.index = merged_features.index

    risk_scores = compute_risk_scores(
        account_features=merged_features,
        ml_probabilities=ml_probabilities,
        rule_results=rule_results,
        transactions=transactions_pp,
    )

    # -----------------------------------------------------------------------
    # 11B. BASELINE APPROACH COMPARISON (Section 11)
    # -----------------------------------------------------------------------
    logger.info("\n[STEP 11B] Evaluating baseline approaches comparison…")
    test_df = train_output["test_df"]
    y_test  = train_output["y_test"]
    xgb_no_graph_proba = train_output["results"]["xgb_no_graph"]["proba"]
    xgb_full_proba     = train_output["xgb_proba"]

    test_acct_ids   = test_df["account_id"].astype(str).values
    risk_scores_map = dict(zip(risk_scores["account_id"].astype(str), risk_scores["account_risk_score"]))
    test_fusion     = pd.Series(test_acct_ids).map(risk_scores_map).fillna(0.0)

    rule_scores_map = dict(zip(rule_results["account_id"].astype(str), rule_results["rule_score_raw"]))
    test_rules      = pd.Series(test_acct_ids).map(rule_scores_map).fillna(0.0)

    evaluate_approaches(
        y_test=y_test,
        rule_scores=test_rules,
        xgb_no_graph_proba=xgb_no_graph_proba,
        xgb_full_proba=xgb_full_proba,
        fusion_scores=test_fusion,
    )

    # -----------------------------------------------------------------------
    # 12. RING DETECTION
    # -----------------------------------------------------------------------
    logger.info("\n[STEP 12] Detecting fraud rings…")
    rings_df = detect_rings(risk_scores, transactions_pp)

    # -----------------------------------------------------------------------
    # SUMMARY
    # -----------------------------------------------------------------------
    elapsed = time.time() - t0
    logger.info("\n" + "=" * 60)
    logger.info("PIPELINE COMPLETE  (%.1f seconds)", elapsed)
    logger.info("=" * 60)
    logger.info("Model saved          : models/mule_detection_xgboost.pkl")
    logger.info("Feature columns      : models/feature_columns.json")
    logger.info("Account features     : outputs/processed/account_features.csv")
    logger.info("Rule detections      : outputs/processed/rule_detection_results.csv")
    logger.info("Suspicious accounts  : outputs/suspicious_accounts.csv")
    logger.info("Fraud rings          : outputs/fraud_rings.csv")
    logger.info("Evaluation report    : outputs/model_evaluation_report.txt")
    logger.info("SHAP explanations    : outputs/shap_explanations.csv")
    logger.info("Visualizations       : outputs/visualizations/")

    n_suspicious = len(risk_scores[risk_scores["risk_category"] == "High Risk"]) if not risk_scores.empty else 0
    n_rings      = len(rings_df) if not rings_df.empty else 0
    logger.info("\nHigh-risk accounts : %d", n_suspicious)
    logger.info("Detected rings     : %d", n_rings)

    if rings_df is not None and not rings_df.empty:
        logger.info("\nTop 5 rings by priority:")
        logger.info(rings_df[["ring_id", "account_count", "mean_risk_score",
                               "amount_at_risk", "ring_priority_score"]].head(5).to_string(index=False))

    logger.info("\n[DISCLAIMER] All outputs are investigative recommendations only.")
    logger.info("Never automatically freeze or block accounts based solely on these scores.")


if __name__ == "__main__":
    main()
