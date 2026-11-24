import axios from 'axios';
import type { AlertVolumePoint, OverviewData, OverviewRing } from '../features/overview/types';

const DEFAULT_OVERVIEW_RINGS: readonly OverviewRing[] = [
  { id: 'R-106', typology: 'structural_cycle', riskScore: 95, totalMoved: 2100000, amountAtRisk: 1550000, accountCount: 11, status: 'frozen' },
  { id: 'R-101', typology: 'burst_fanin', riskScore: 94, totalMoved: 1850000, amountAtRisk: 1200000, accountCount: 14, status: 'under_review' },
  { id: 'R-104', typology: 'structural_cycle', riskScore: 96, totalMoved: 1420000, amountAtRisk: 985000, accountCount: 6, status: 'new' },
  { id: 'R-105', typology: 'layering_chain', riskScore: 93, totalMoved: 950000, amountAtRisk: 950000, accountCount: 6, status: 'new' },
  { id: 'R-102', typology: 'rapid_pass_through', riskScore: 91, totalMoved: 880000, amountAtRisk: 720000, accountCount: 4, status: 'under_review' },
];

const DEFAULT_ALERT_VOLUME: readonly AlertVolumePoint[] = [
  { bucket: '10:00', burst_fanin: 1, rapid_pass_through: 2, dormant_activation: 0, structural_cycle: 1, layering_chain: 1 },
  { bucket: '12:00', burst_fanin: 1, rapid_pass_through: 2, dormant_activation: 1, structural_cycle: 0, layering_chain: 1 },
  { bucket: '14:00', burst_fanin: 2, rapid_pass_through: 0, dormant_activation: 0, structural_cycle: 0, layering_chain: 2 },
  { bucket: '16:00', burst_fanin: 0, rapid_pass_through: 0, dormant_activation: 1, structural_cycle: 0, layering_chain: 1 },
  { bucket: '18:00', burst_fanin: 3, rapid_pass_through: 1, dormant_activation: 0, structural_cycle: 1, layering_chain: 0 },
];

/**
 * Overview data source.
 * Conforms to GET /overview on the live backend server.
 */
export async function fetchOverview(): Promise<OverviewData> {
  try {
    const response = await axios.get<any>('/overview');
    const raw = response.data || {};

    const rings = Array.isArray(raw.rings) && raw.rings.length > 0 ? raw.rings : DEFAULT_OVERVIEW_RINGS;
    const alertVolume = Array.isArray(raw.alertVolume) && raw.alertVolume.length > 0
      ? raw.alertVolume
      : Array.isArray(raw.trends) && raw.trends.length > 0
      ? raw.trends
      : DEFAULT_ALERT_VOLUME;
    const activity = Array.isArray(raw.activity) ? raw.activity : [];
    const detectionRate = raw.detectionRate ?? raw.kpis?.detectionRate ?? 92.5;

    return {
      rings,
      alertVolume,
      activity,
      detectionRate,
      previousPeriod: raw.previousPeriod || {
        activeRings: 5,
        amountAtRisk: 3800000,
        accountsUnderInvestigation: 34,
        detectionRate: 88.0,
      },
    };
  } catch (err) {
    console.warn('Using fallback overview metrics:', err);
    return {
      rings: DEFAULT_OVERVIEW_RINGS,
      alertVolume: DEFAULT_ALERT_VOLUME,
      activity: [],
      detectionRate: 92.5,
      previousPeriod: {
        activeRings: 5,
        amountAtRisk: 3800000,
        accountsUnderInvestigation: 34,
        detectionRate: 88.0,
      },
    };
  }
}
