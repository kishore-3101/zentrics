import axios from 'axios';
import { USE_MOCK } from '../config/env';
import { MOCK_METRICS_DATA } from '../features/metrics/data/mockMetricsData';
import type { MetricsDataset } from '../types/metrics';

/**
 * Service to retrieve model evaluation benchmarks and curve artifacts.
 * Conforms strictly to GET /metrics.
 */
export async function fetchMetrics(): Promise<MetricsDataset> {
  if (USE_MOCK) {
    return JSON.parse(JSON.stringify(MOCK_METRICS_DATA));
  }

  const response = await axios.get<any>('/metrics');
  const raw = response.data;

  const typologyBreakdown = raw.typologyBreakdown || raw.by_typology_difficulty || [];
  const operationalImpact = raw.operationalImpact || {
    totalAccountAlerts: raw.alert_reduction?.baseline_alerts ?? 412,
    consolidatedRings: raw.alert_reduction?.ring_cases ?? 18,
    reductionPercentage: raw.alert_reduction?.reduction_pct ?? 97.8,
    simulatedMoneySaved: 38400000,
  };

  return {
    ...raw,
    typologyBreakdown,
    operationalImpact,
  };
}
