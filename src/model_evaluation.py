"""
model_evaluation.py – Generates evaluation report and visualizations.
Gracefully skips plots if matplotlib/seaborn are not installed.
"""
import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import (
    confusion_matrix, roc_curve, precision_recall_curve,
)

from src.config import (
    VIZ_DIR, MODEL_EVALUATION_REPORT, PROCESSED_DIR, OUTPUTS_DIR,
)

logger = logging.getLogger(__name__)

# Optional imports
try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import seaborn as sns
    HAS_PLOTS = True
    logger.info("matplotlib/seaborn available – visualizations enabled.")
except ImportError:
    HAS_PLOTS = False
    logger.warning("matplotlib/seaborn not installed – visualizations will be skipped.")

try:
    import shap
    HAS_SHAP = True
except ImportError:
    HAS_SHAP = False
    logger.warning("shap not installed – SHAP explanations will be skipped.")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _save_fig(name: str) -> None:
    if not HAS_PLOTS:
        return
    VIZ_DIR.mkdir(parents=True, exist_ok=True)
    path = VIZ_DIR / name
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    logger.info("Saved visualization → %s", path)


# ---------------------------------------------------------------------------
# Individual plots
# ---------------------------------------------------------------------------

def plot_confusion_matrix(y_true, y_pred, model_name: str = "XGBoost") -> None:
    if not HAS_PLOTS:
        return
    cm = confusion_matrix(y_true, y_pred)
    fig, ax = plt.subplots(figsize=(5, 4))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", ax=ax,
                xticklabels=["Legit", "Mule"],
                yticklabels=["Legit", "Mule"])
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    ax.set_title(f"{model_name} – Confusion Matrix")
    _save_fig(f"confusion_matrix_{model_name.lower()}.png")


def plot_roc_curve(y_true, y_proba, model_name: str = "XGBoost", auc: float = 0) -> None:
    if not HAS_PLOTS:
        return
    fpr, tpr, _ = roc_curve(y_true, y_proba)
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.plot(fpr, tpr, label=f"{model_name} (AUC={auc:.3f})")
    ax.plot([0, 1], [0, 1], "k--")
    ax.set_xlabel("False Positive Rate")
    ax.set_ylabel("True Positive Rate")
    ax.set_title("ROC Curve")
    ax.legend()
    _save_fig(f"roc_curve_{model_name.lower()}.png")


def plot_pr_curve(y_true, y_proba, model_name: str = "XGBoost", ap: float = 0) -> None:
    if not HAS_PLOTS:
        return
    prec, rec, _ = precision_recall_curve(y_true, y_proba)
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.plot(rec, prec, label=f"{model_name} (AP={ap:.3f})")
    ax.set_xlabel("Recall")
    ax.set_ylabel("Precision")
    ax.set_title("Precision-Recall Curve")
    ax.legend()
    _save_fig(f"pr_curve_{model_name.lower()}.png")


def plot_feature_importance(model, feat_cols: list, top_n: int = 25) -> None:
    if not HAS_PLOTS:
        return
    try:
        imp = getattr(model, "feature_importances_", None)
        if imp is None:
            return
        imp_df = pd.DataFrame({"feature": feat_cols, "importance": imp})
        imp_df = imp_df.nlargest(top_n, "importance")
        fig, ax = plt.subplots(figsize=(8, 6))
        sns.barplot(data=imp_df, x="importance", y="feature", ax=ax, palette="viridis")
        ax.set_title("Top Feature Importances (XGBoost)")
        _save_fig("feature_importance_xgboost.png")
    except Exception as e:
        logger.warning("Feature importance plot failed: %s", e)


def plot_model_comparison(all_metrics: list) -> None:
    if not HAS_PLOTS:
        return
    df = pd.DataFrame(all_metrics)
    metric_cols = ["precision", "recall", "f1", "roc_auc", "pr_auc"]
    df_plot = df[["model"] + metric_cols].set_index("model")
    fig, ax = plt.subplots(figsize=(9, 5))
    df_plot.T.plot(kind="bar", ax=ax)
    ax.set_title("Model Comparison")
    ax.set_ylabel("Score")
    ax.set_ylim(0, 1)
    ax.tick_params(axis="x", rotation=30)
    _save_fig("model_comparison.png")


def plot_class_distribution(y: pd.Series) -> None:
    if not HAS_PLOTS:
        return
    fig, ax = plt.subplots(figsize=(5, 4))
    vc = y.value_counts()
    ax.bar(["Legit (0)", "Mule (1)"], [vc.get(0, 0), vc.get(1, 0)],
           color=["steelblue", "tomato"])
    ax.set_title("Class Distribution")
    ax.set_ylabel("Count")
    _save_fig("class_distribution.png")


def plot_shap_summary(model, X_test: pd.DataFrame, feat_cols: list) -> None:
    if not HAS_SHAP or not HAS_PLOTS:
        return
    try:
        explainer = shap.TreeExplainer(model)
        shap_vals  = explainer.shap_values(X_test[feat_cols])
        fig, ax = plt.subplots(figsize=(10, 7))
        shap.summary_plot(shap_vals, X_test[feat_cols], show=False)
        _save_fig("shap_summary.png")
    except Exception as e:
        logger.warning("SHAP summary plot failed: %s", e)


# ---------------------------------------------------------------------------
# SHAP per-account explanations
# ---------------------------------------------------------------------------

def generate_shap_explanations(
    model,
    X_test: pd.DataFrame,
    feat_cols: list,
    test_df: pd.DataFrame,
    y_pred: np.ndarray,
    top_n: int = 5,
) -> pd.DataFrame:
    from src.config import SHAP_EXPLANATIONS_CSV

    if not HAS_SHAP:
        logger.warning("shap not installed – generating feature-importance-based explanations.")
        # Fallback: use model feature importances
        imp = getattr(model, "feature_importances_", None)
        if imp is None:
            return pd.DataFrame()
        imp_series = pd.Series(imp, index=feat_cols).sort_values(ascending=False)
        rows = []
        for idx in X_test.index:
            row_vals  = X_test.loc[idx]
            top_feats = imp_series.head(top_n).index.tolist()
            explanation = " | ".join(
                f"{f}={row_vals[f]:.3f}" for f in top_feats
            )
            rows.append({
                "account_id" : test_df.loc[idx, "account_id"] if "account_id" in test_df.columns else idx,
                "predicted"  : int(y_pred[list(X_test.index).index(idx)]) if idx in X_test.index else -1,
                "top_features": str(top_feats),
                "explanation" : explanation,
            })
        exp_df = pd.DataFrame(rows)
        SHAP_EXPLANATIONS_CSV.parent.mkdir(parents=True, exist_ok=True)
        exp_df.to_csv(SHAP_EXPLANATIONS_CSV, index=False)
        return exp_df

    try:
        explainer  = shap.TreeExplainer(model)
        shap_vals  = explainer.shap_values(X_test[feat_cols])
        shap_df    = pd.DataFrame(shap_vals, columns=feat_cols, index=X_test.index)

        rows = []
        pred_list = list(y_pred)
        for i, idx in enumerate(X_test.index):
            sv    = shap_df.loc[idx].abs().sort_values(ascending=False)
            top_f = sv.head(top_n).index.tolist()
            explanation = " | ".join(
                f"{f} (SHAP={shap_df.loc[idx, f]:+.3f})" for f in top_f
            )
            acct_id = test_df.loc[idx, "account_id"] if "account_id" in test_df.columns else idx
            rows.append({
                "account_id"  : acct_id,
                "predicted"   : int(y_pred[i]),
                "top_features": str(top_f),
                "explanation" : explanation,
            })

        exp_df = pd.DataFrame(rows)
        SHAP_EXPLANATIONS_CSV.parent.mkdir(parents=True, exist_ok=True)
        exp_df.to_csv(SHAP_EXPLANATIONS_CSV, index=False)
        logger.info("SHAP explanations saved → %s", SHAP_EXPLANATIONS_CSV)
        return exp_df

    except Exception as e:
        logger.error("SHAP explanation failed: %s", e)
        return pd.DataFrame()


# ---------------------------------------------------------------------------
# Full evaluation pipeline
# ---------------------------------------------------------------------------

def evaluate(train_output: dict) -> None:
    """
    Generate all evaluation artefacts from the dict returned by train().
    """
    results    = train_output["results"]
    all_metrics= train_output["all_metrics"]
    feat_cols  = train_output["feat_cols"]
    X_test     = train_output["X_test"]
    y_test     = train_output["y_test"]
    xgb_proba  = train_output["xgb_proba"]
    xgb_pred   = train_output["xgb_pred"]
    test_df    = train_output["test_df"]

    xgb_model = results["xgb"]["model"]
    xgb_m     = results["xgb"]["metrics"]

    # --- Text report ---
    lines = ["MULE ACCOUNT RING DETECTION – MODEL EVALUATION REPORT", "=" * 70]
    for m in all_metrics:
        lines += [
            f"\n--- {m['model']} ---",
            f"  Accuracy   : {m['accuracy']:.4f}",
            f"  Precision  : {m['precision']:.4f}",
            f"  Recall     : {m['recall']:.4f}",
            f"  F1-Score   : {m['f1']:.4f}",
            f"  ROC-AUC    : {m['roc_auc']:.4f}",
            f"  PR-AUC     : {m['pr_auc']:.4f}",
            f"  FPR        : {m['fpr']:.4f}",
            f"  FNR        : {m['fnr']:.4f}",
            f"  Confusion  : TN={m['tn']} FP={m['fp']} FN={m['fn']} TP={m['tp']}",
        ]
    if "cv_f1_mean" in results.get("xgb", {}):
        lines += [
            f"\n--- XGBoost Cross-Validation (k-fold on training set) ---",
            f"  CV F1 mean : {results['xgb']['cv_f1_mean']:.4f}",
            f"  CV F1 std  : {results['xgb']['cv_f1_std']:.4f}",
        ]

    if not HAS_PLOTS:
        lines.append("\n[NOTE] matplotlib/seaborn not installed – visualizations skipped.")
    if not HAS_SHAP:
        lines.append("[NOTE] shap not installed – SHAP plots skipped; fallback explanations used.")

    report_text = "\n".join(lines)
    MODEL_EVALUATION_REPORT.parent.mkdir(parents=True, exist_ok=True)
    MODEL_EVALUATION_REPORT.write_text(report_text, encoding="utf-8")
    logger.info("Evaluation report saved → %s", MODEL_EVALUATION_REPORT)
    print(report_text)

    # --- Visualizations ---
    plot_confusion_matrix(y_test, xgb_pred, "XGBoost")
    plot_roc_curve(y_test, xgb_proba, "XGBoost", auc=xgb_m["roc_auc"])
    plot_pr_curve(y_test, xgb_proba, "XGBoost", ap=xgb_m["pr_auc"])
    plot_feature_importance(xgb_model, feat_cols)
    plot_model_comparison(all_metrics)
    plot_class_distribution(y_test)
    plot_shap_summary(xgb_model, X_test, feat_cols)

    # --- Per-account predictions CSV ---
    pred_df = test_df[["account_id"]].copy() if "account_id" in test_df.columns else pd.DataFrame()
    pred_df = pred_df.reset_index(drop=True)
    pred_df["actual"]      = y_test.values
    pred_df["predicted"]   = xgb_pred
    pred_df["probability"] = xgb_proba
    out_path = OUTPUTS_DIR / "test_predictions.csv"
    pred_df.to_csv(out_path, index=False)
    logger.info("Test predictions saved → %s", out_path)

    # --- SHAP explanations ---
    generate_shap_explanations(xgb_model, X_test, feat_cols, test_df, xgb_pred)

    # --- Comparison metrics CSV ---
    metrics_df = pd.DataFrame(all_metrics)
    metrics_df.to_csv(OUTPUTS_DIR / "model_comparison_metrics.csv", index=False)


# ---------------------------------------------------------------------------
# Section 11: 4-Way Baseline Approach Comparison
# ---------------------------------------------------------------------------

def evaluate_approaches(
    y_test: pd.Series,
    rule_scores: pd.Series,
    xgb_no_graph_proba: np.ndarray,
    xgb_full_proba: np.ndarray,
    fusion_scores: pd.Series,
) -> pd.DataFrame:
    """
    Section 11 Baseline Comparison:
    A. Per-account rule-based detection
    B. ML without graph features
    C. ML with graph features
    D. Full fusion model
    """
    from sklearn.metrics import (
        precision_score, recall_score, f1_score,
        average_precision_score, confusion_matrix,
    )

    y_true = y_test.values

    # Rule-based prediction: >= 1 detector triggered (score > 0)
    rule_norm = (rule_scores - rule_scores.min()) / max(rule_scores.max() - rule_scores.min(), 1e-9) if rule_scores.max() > rule_scores.min() else rule_scores
    rule_pred = (rule_norm >= 0.16).astype(int)

    # ML NoGraph
    ng_pred = (xgb_no_graph_proba >= 0.5).astype(int)

    # ML Full
    full_pred = (xgb_full_proba >= 0.5).astype(int)

    # Fusion
    fusion_norm = fusion_scores / 100.0 if fusion_scores.max() > 1.0 else fusion_scores
    fusion_pred = (fusion_norm >= 0.5).astype(int)

    configs = [
        ("A. Rule-Based Detection",      y_true, rule_pred,   rule_norm.values),
        ("B. ML without Graph Features", y_true, ng_pred,     xgb_no_graph_proba),
        ("C. ML with Graph Features",    y_true, full_pred,   xgb_full_proba),
        ("D. Full Score Fusion",         y_true, fusion_pred, fusion_norm.values),
    ]

    rows = []
    for name, yt, yp, yprob in configs:
        cm = confusion_matrix(yt, yp)
        tn, fp, fn, tp = cm.ravel() if cm.shape == (2, 2) else (0, 0, 0, 0)
        fpr = fp / max(fp + tn, 1)
        prec = precision_score(yt, yp, zero_division=0)
        rec = recall_score(yt, yp, zero_division=0)
        f1 = f1_score(yt, yp, zero_division=0)
        pr_auc = average_precision_score(yt, yprob) if len(np.unique(yt)) > 1 else float("nan")

        rows.append({
            "approach"           : name,
            "precision"          : round(float(prec), 4),
            "recall"             : round(float(rec), 4),
            "f1_score"           : round(float(f1), 4),
            "pr_auc"             : round(float(pr_auc), 4),
            "false_positive_rate": round(float(fpr), 4),
            "tp"                 : int(tp),
            "fp"                 : int(fp),
            "fn"                 : int(fn),
            "tn"                 : int(tn),
        })

    comp_df = pd.DataFrame(rows)
    out_csv = OUTPUTS_DIR / "baseline_approach_comparison.csv"
    comp_df.to_csv(out_csv, index=False)
    logger.info("Baseline approach comparison saved → %s", out_csv)

    # Append to model_evaluation_report.txt
    lines = [
        "\n" + "=" * 70,
        "SECTION 11: BASELINE APPROACH COMPARISON",
        "=" * 70,
        comp_df.to_string(index=False),
        "\nKey Observation:",
    ]
    f1_a = comp_df.loc[comp_df["approach"].str.startswith("A"), "f1_score"].values[0]
    f1_b = comp_df.loc[comp_df["approach"].str.startswith("B"), "f1_score"].values[0]
    f1_c = comp_df.loc[comp_df["approach"].str.startswith("C"), "f1_score"].values[0]
    f1_d = comp_df.loc[comp_df["approach"].str.startswith("D"), "f1_score"].values[0]

    lines.append(f"  * Rule-Based F1: {f1_a:.4f}")
    lines.append(f"  * ML (No Graph) F1: {f1_b:.4f}")
    lines.append(f"  * ML (With Graph) F1: {f1_c:.4f} (Graph lift: {f1_c - f1_b:+.4f})")
    lines.append(f"  * Full Fusion F1: {f1_d:.4f} (Fusion lift vs No-Graph: {f1_d - f1_b:+.4f})")

    report_append = "\n".join(lines)
    with open(MODEL_EVALUATION_REPORT, "a", encoding="utf-8") as f:
        f.write("\n" + report_append + "\n")
    print(report_append)

    if HAS_PLOTS:
        try:
            fig, ax = plt.subplots(figsize=(10, 5))
            plot_df = comp_df.set_index("approach")[["precision", "recall", "f1_score", "pr_auc"]]
            plot_df.plot(kind="bar", ax=ax, rot=15)
            ax.set_title("Section 11: Baseline Approaches Comparison")
            ax.set_ylabel("Metric Score")
            ax.set_ylim(0, 1.05)
            ax.grid(axis="y", linestyle="--", alpha=0.7)
            _save_fig("baseline_comparison.png")
        except Exception as e:
            logger.warning("Baseline comparison plot failed: %s", e)

    return comp_df

