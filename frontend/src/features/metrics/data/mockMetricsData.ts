import type { MetricsDataset } from '../../../types/metrics';

/**
 * Standardized Benchmark Artifacts matching Module 10 / 16 specifications
 * and the `metrics` / `metric_artifacts` database schemas.
 * Clearly labelled as DEMO DATA.
 */
export const MOCK_METRICS_DATA: MetricsDataset = {
  overall: {
    precision: 96.4,
    recall: 92.8,
    f1: 94.6,
    pr_auc: 0.971,
    ring_recall: 94.2,
    fpr: 1.8,
  },
  comparison: [
    {
      metric: 'Precision (%)',
      baseline_rules: 54.2,
      graph_rules: 68.5,
      ml_only: 76.1,
      full_fusion: 96.4,
    },
    {
      metric: 'Recall (%)',
      baseline_rules: 48.0,
      graph_rules: 71.4,
      ml_only: 69.8,
      full_fusion: 92.8,
    },
    {
      metric: 'F1-Score (%)',
      baseline_rules: 50.9,
      graph_rules: 69.9,
      ml_only: 72.8,
      full_fusion: 94.6,
    },
    {
      metric: 'Ring Recall @ 70% (%)',
      baseline_rules: 41.5,
      graph_rules: 65.0,
      ml_only: 62.8,
      full_fusion: 94.2,
    },
    {
      metric: 'PR-AUC (x100)',
      baseline_rules: 49.2,
      graph_rules: 72.5,
      ml_only: 76.4,
      full_fusion: 97.1,
    },
  ],
  curves: {
    pr_curve: [
      { threshold: 0.1, recall: 98.5, precision: 74.2, fpr: 8.5, tpr: 98.5 },
      { threshold: 0.2, recall: 97.2, precision: 82.0, fpr: 5.4, tpr: 97.2 },
      { threshold: 0.3, recall: 96.0, precision: 88.5, fpr: 3.8, tpr: 96.0 },
      { threshold: 0.4, recall: 95.1, precision: 92.4, fpr: 2.6, tpr: 95.1 },
      { threshold: 0.5, recall: 94.2, precision: 95.0, fpr: 2.1, tpr: 94.2 },
      { threshold: 0.6, recall: 92.8, precision: 96.4, fpr: 1.8, tpr: 92.8 },
      { threshold: 0.7, recall: 89.5, precision: 97.2, fpr: 1.2, tpr: 89.5 },
      { threshold: 0.8, recall: 84.0, precision: 98.1, fpr: 0.8, tpr: 84.0 },
      { threshold: 0.9, recall: 74.5, precision: 99.2, fpr: 0.4, tpr: 74.5 },
    ],
    roc_curve: [
      { threshold: 0.9, fpr: 0.4, tpr: 74.5, recall: 74.5, precision: 99.2 },
      { threshold: 0.8, fpr: 0.8, tpr: 84.0, recall: 84.0, precision: 98.1 },
      { threshold: 0.7, fpr: 1.2, tpr: 89.5, recall: 89.5, precision: 97.2 },
      { threshold: 0.6, fpr: 1.8, tpr: 92.8, recall: 92.8, precision: 96.4 },
      { threshold: 0.5, fpr: 2.1, tpr: 94.2, recall: 94.2, precision: 95.0 },
      { threshold: 0.4, fpr: 2.6, tpr: 95.1, recall: 95.1, precision: 92.4 },
      { threshold: 0.3, fpr: 3.8, tpr: 96.0, recall: 96.0, precision: 88.5 },
      { threshold: 0.2, fpr: 5.4, tpr: 97.2, recall: 97.2, precision: 82.0 },
      { threshold: 0.1, fpr: 8.5, tpr: 98.5, recall: 98.5, precision: 74.2 },
    ],
  },
  typologyBreakdown: [
    { typology: 'burst_fanin', difficulty: 'easy', recall: 98.2, f1: 97.5, sample_size: 45 },
    { typology: 'burst_fanin', difficulty: 'medium', recall: 95.4, f1: 96.1, sample_size: 38 },
    { typology: 'burst_fanin', difficulty: 'hard', recall: 91.0, f1: 92.4, sample_size: 24 },
    { typology: 'rapid_pass_through', difficulty: 'easy', recall: 97.5, f1: 96.8, sample_size: 42 },
    { typology: 'rapid_pass_through', difficulty: 'medium', recall: 94.1, f1: 95.2, sample_size: 35 },
    { typology: 'rapid_pass_through', difficulty: 'hard', recall: 89.5, f1: 91.3, sample_size: 28 },
    { typology: 'structural_cycle', difficulty: 'easy', recall: 96.8, f1: 96.0, sample_size: 32 },
    { typology: 'structural_cycle', difficulty: 'medium', recall: 93.4, f1: 94.1, sample_size: 26 },
    { typology: 'structural_cycle', difficulty: 'hard', recall: 88.2, f1: 90.5, sample_size: 19 },
    { typology: 'layering_chain', difficulty: 'easy', recall: 95.5, f1: 95.2, sample_size: 36 },
    { typology: 'layering_chain', difficulty: 'medium', recall: 92.0, f1: 93.4, sample_size: 30 },
    { typology: 'layering_chain', difficulty: 'hard', recall: 86.8, f1: 89.2, sample_size: 22 },
    { typology: 'dormant_activation', difficulty: 'easy', recall: 94.0, f1: 94.5, sample_size: 28 },
    { typology: 'dormant_activation', difficulty: 'medium', recall: 90.8, f1: 92.1, sample_size: 24 },
    { typology: 'dormant_activation', difficulty: 'hard', recall: 85.0, f1: 88.0, sample_size: 18 },
  ],
  fairness: [
    { dimension: 'city_cluster', group: 'Tier 1 - NCR', normal_fpr: 1.6, hard_negative_fpr: 3.2, parity_gap: 0.2 },
    { dimension: 'city_cluster', group: 'Tier 1 - Mumbai', normal_fpr: 1.7, hard_negative_fpr: 3.4, parity_gap: 0.1 },
    { dimension: 'city_cluster', group: 'Tier 2 - Jaipur/Surat', normal_fpr: 1.8, hard_negative_fpr: 3.1, parity_gap: 0.0 },
    { dimension: 'city_cluster', group: 'Tier 3 / Semi-Urban', normal_fpr: 1.9, hard_negative_fpr: 3.5, parity_gap: 0.1 },
    { dimension: 'declared_income_band', group: 'Low (< ₹2.5L)', normal_fpr: 1.8, hard_negative_fpr: 3.6, parity_gap: 0.1 },
    { dimension: 'declared_income_band', group: 'Lower Mid (₹2.5L-₹5L)', normal_fpr: 1.7, hard_negative_fpr: 3.2, parity_gap: 0.1 },
    { dimension: 'declared_income_band', group: 'Mid (₹5L-₹10L)', normal_fpr: 1.8, hard_negative_fpr: 3.0, parity_gap: 0.0 },
    { dimension: 'declared_income_band', group: 'Upper Mid (₹10L-₹25L)', normal_fpr: 1.6, hard_negative_fpr: 2.8, parity_gap: 0.2 },
    { dimension: 'declared_income_band', group: 'High (> ₹25L)', normal_fpr: 1.5, hard_negative_fpr: 2.5, parity_gap: 0.3 },
  ],
  operationalImpact: {
    totalAccountAlerts: 412,
    consolidatedRings: 18,
    reductionPercentage: 95.6,
    simulatedMoneySaved: 38400000, // ₹3.84 Cr
  },
};
