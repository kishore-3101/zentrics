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

  const response = await axios.get<MetricsDataset>('/metrics');
  return response.data;
}
