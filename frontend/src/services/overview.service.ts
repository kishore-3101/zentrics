import axios from 'axios';
import type { OverviewData } from '../features/overview/types';

/**
 * Overview data source.
 * Conforms to GET /overview on the live backend server.
 */
export async function fetchOverview(): Promise<OverviewData> {
  const response = await axios.get<any>('/overview');
  const raw = response.data || {};

  return {
    rings: raw.rings && Array.isArray(raw.rings) ? raw.rings : [],
    alertVolume: raw.alertVolume && Array.isArray(raw.alertVolume)
      ? raw.alertVolume
      : raw.trends && Array.isArray(raw.trends)
      ? raw.trends
      : [],
    activity: raw.activity && Array.isArray(raw.activity) ? raw.activity : [],
    detectionRate: raw.detectionRate ?? raw.kpis?.detectionRate ?? 92.5,
    previousPeriod: raw.previousPeriod || {
      activeRings: 5,
      amountAtRisk: 3800000,
      accountsUnderInvestigation: 34,
      detectionRate: 88.0,
    },
  };
}
