import { useCallback, useEffect, useState } from 'react';
import { fetchMetrics } from '../../../services/metrics.service';
import type { MetricsDataset } from '../../../types/metrics';

export function useMetricsData() {
  const [data, setData] = useState<MetricsDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const metrics = await fetchMetrics();
      setData(metrics);
    } catch (err) {
      console.error('Failed to load metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load model evaluation metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    error,
    refreshMetrics: loadData,
  };
}
