import axios from 'axios';
import type { AlertVolumePoint, OverviewData, OverviewRing } from '../features/overview/types';
import { getCachedSimulatedRings } from './ring-graph.service';

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
 * Conforms to GET /overview on the live backend server and merges locally cached simulations.
 */
export async function fetchOverview(): Promise<OverviewData> {
  let raw: any = {};
  try {
    const response = await axios.get<any>('/overview');
    raw = response.data || {};
  } catch (err) {
    console.warn('Using fallback overview metrics:', err);
  }

  const baseRings: OverviewRing[] = Array.isArray(raw.rings) && raw.rings.length > 0
    ? raw.rings
    : [...DEFAULT_OVERVIEW_RINGS];

  const simRings = getCachedSimulatedRings();
  const seenIds = new Set(baseRings.map((r) => r.id));
  const simOverviewRings: OverviewRing[] = simRings
    .filter((r) => !seenIds.has(r.ring_id))
    .map((r) => ({
      id: r.ring_id,
      typology: r.ring_type,
      riskScore: Math.round(r.score || 94),
      totalMoved: r.amount_moved || 500000,
      amountAtRisk: r.amount_at_risk ?? 0,
      accountCount: r.nodes.length,
      status: r.status,
    }));

  const rings = [...simOverviewRings, ...baseRings];

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
}
