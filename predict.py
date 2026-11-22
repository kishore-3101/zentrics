"""
predict.py – Inference entry-point (no retraining).
Run: python predict.py
"""
import logging
import sys
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("predict")

from src.data_loader      import load_accounts, load_transactions, load_daily_summary
from src.preprocessing    import preprocess_accounts, preprocess_transactions
from src.graph_builder    import build_graph, compute_graph_features
from src.feature_engineering import build_account_features
from src.rule_detectors   import run_all_rules
from src.inference        import predict_proba, get_model_info
from src.risk_scoring     import compute_risk_scores
from src.ring_detection   import detect_rings
from src.config           import OUTPUTS_DIR


def main():
    logger.info("=" * 60)
    logger.info("MULE ACCOUNT RING DETECTION – INFERENCE PIPELINE")
    logger.info("=" * 60)

    # Show model info
    try:
        info = get_model_info()
        logger.info("Model info: %s", json.dumps(info, default=str, indent=2))
    except FileNotFoundError as e:
        logger.error(str(e))
        sys.exit(1)

    # Load and preprocess data
    logger.info("Loading data…")
    accounts      = load_accounts()
    transactions  = load_transactions()
    daily_summary = load_daily_summary()
    accounts_pp   = preprocess_accounts(accounts)
    transactions_pp = preprocess_transactions(transactions)

    # Build features
    logger.info("Building features…")
    G = build_graph(transactions_pp)
    gf = compute_graph_features(G, accounts_pp)
    features = build_account_features(
        accounts_pp, transactions_pp,
        graph_features=gf,
        daily_summary=daily_summary if not daily_summary.empty else None,
    )

    # Rule features
    rules = run_all_rules(transactions_pp, accounts_pp)
    flag_cols = [c for c in rules.columns if c.endswith("_flag") or c == "rule_score_raw" or c == "rule_detector_count"]
    features = features.merge(rules[["account_id"] + flag_cols], on="account_id", how="left")
    features[flag_cols] = features[flag_cols].fillna(0)

    # ML predictions
    logger.info("Running ML predictions…")
    with open(PROJECT_ROOT / "models" / "feature_columns.json") as f:
        feat_cols = json.load(f)
    for c in feat_cols:
        if c not in features.columns:
            features[c] = 0.0
    probas = predict_proba(features[feat_cols].fillna(0))
    ml_prob_map = dict(zip(features["account_id"].astype(str), probas))

    # Risk scoring
    logger.info("Computing risk scores…")
    risk_scores = compute_risk_scores(
        account_features=features,
        ml_probabilities=ml_prob_map,
        rule_results=rules,
        transactions=transactions_pp,
    )

    # Ring detection
    logger.info("Detecting rings…")
    rings = detect_rings(risk_scores, transactions_pp)

    # Summary
    high_risk = risk_scores[risk_scores["risk_category"] == "High Risk"]
    logger.info("\n--- RESULTS ---")
    logger.info("Total accounts scored : %d", len(risk_scores))
    logger.info("High risk accounts    : %d", len(high_risk))
    logger.info("Rings detected        : %d", len(rings))
    logger.info("Outputs saved to      : %s", OUTPUTS_DIR)

    # Save full risk table
    out = OUTPUTS_DIR / "all_account_risk_scores.csv"
    risk_scores.to_csv(out, index=False)
    logger.info("Full risk scores      : %s", out)

    # Persist execution, predictions and rings into database
    try:
        from src.database import save_pipeline_execution
        run_id = save_pipeline_execution(risk_scores, rings)
        logger.info("Persisted pipeline execution #%d to database.", run_id)
    except Exception as e:
        logger.warning("Could not persist run to database: %s", e)


if __name__ == "__main__":
    main()
