/**
 * Metric models strictly conforming to Module 10 / 16 evaluation specifications
 * and the `metrics` / `metric_artifacts` database schemas.
 */

export interface MetricSummary {
  precision: number; // 0 - 100
  recall: number; // 0 - 100
  f1: number; // 0 - 100
  pr_auc: number; // 0.0 - 1.0
  ring_recall: number; // 0 - 100 (at 70% threshold)
  fpr: number; // 0 - 100
}

export interface FourWayComparison {
  metric: string;
  baseline_rules: number;
  graph_rules: number;
  ml_only: number;
  full_fusion: number;
}

export interface CurvePoint {
  threshold: number;
  recall: number;
  precision: number;
  fpr: number;
  tpr: number;
}

export interface TypologyDifficultyMetric {
  typology: string;
  difficulty: 'easy' | 'medium' | 'hard';
  recall: number;
  f1: number;
  sample_size: number;
}

export interface FairnessRecord {
  dimension: 'city_cluster' | 'declared_income_band';
  group: string;
  normal_fpr: number;
  hard_negative_fpr: number;
  parity_gap: number;
}

export interface MetricsDataset {
  overall: MetricSummary;
  comparison: FourWayComparison[];
  curves: {
    pr_curve: CurvePoint[];
    roc_curve: CurvePoint[];
  };
  typologyBreakdown: TypologyDifficultyMetric[];
  fairness: FairnessRecord[];
  operationalImpact: {
    totalAccountAlerts: number;
    consolidatedRings: number;
    reductionPercentage: number;
    simulatedMoneySaved: number;
  };
}
