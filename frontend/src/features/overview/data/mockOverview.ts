import type { ActivityEvent, OverviewData, OverviewRing } from '../types';
import { MOCK_ALERT_VOLUME } from './mockAlertVolume';

/**
 * MOCK DATA for the Executive Overview. Not real detections and not an API shape.
 * Delete this file when the overview service is wired to the backend.
 */

const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

const MOCK_RINGS: readonly OverviewRing[] = [
  { id: 'R-104', typology: 'burst_fanin', riskScore: 96, totalMoved: 1_420_000, amountAtRisk: 985_000, accountCount: 24, status: 'new' },
  { id: 'R-097', typology: 'rapid_pass_through', riskScore: 92, totalMoved: 2_760_000, amountAtRisk: 1_640_000, accountCount: 11, status: 'escalated' },
  { id: 'R-089', typology: 'structural_cycle', riskScore: 88, totalMoved: 1_985_000, amountAtRisk: 1_120_000, accountCount: 6, status: 'under_review' },
  { id: 'R-101', typology: 'layering_chain', riskScore: 84, totalMoved: 960_000, amountAtRisk: 540_000, accountCount: 9, status: 'frozen' },
  { id: 'R-092', typology: 'rapid_pass_through', riskScore: 79, totalMoved: 1_310_000, amountAtRisk: 725_000, accountCount: 8, status: 'under_review' },
  { id: 'R-103', typology: 'dormant_activation', riskScore: 73, totalMoved: 640_000, amountAtRisk: 410_000, accountCount: 5, status: 'new' },
  { id: 'R-085', typology: 'burst_fanin', riskScore: 68, totalMoved: 870_000, amountAtRisk: 390_000, accountCount: 17, status: 'frozen' },
  { id: 'R-099', typology: 'structural_cycle', riskScore: 61, totalMoved: 520_000, amountAtRisk: 230_000, accountCount: 4, status: 'under_review' },
  { id: 'R-091', typology: 'rapid_pass_through', riskScore: 57, totalMoved: 430_000, amountAtRisk: 175_000, accountCount: 7, status: 'escalated' },
];

const MOCK_ACTIVITY: readonly ActivityEvent[] = [
  { id: 'a1', kind: 'detected', ringId: 'R-104', detail: 'Burst Fan-in · 24 accounts', actor: 'System', occurredAt: minutesAgo(2) },
  { id: 'a2', kind: 'escalated', ringId: 'R-097', detail: 'Escalated to Senior AML', actor: 'Analyst', occurredAt: minutesAgo(14) },
  { id: 'a3', kind: 'note', ringId: 'R-089', detail: 'Hypothesis logged: circular flow via shell merchants', actor: 'Analyst', occurredAt: minutesAgo(27) },
  { id: 'a4', kind: 'frozen', ringId: 'R-101', detail: '9 accounts frozen, victims spared', actor: 'Analyst', occurredAt: minutesAgo(48) },
  { id: 'a5', kind: 'detected', ringId: 'R-103', detail: 'Dormant Activation · 5 accounts', actor: 'System', occurredAt: minutesAgo(65) },
  { id: 'a6', kind: 'under_review', ringId: 'R-092', detail: 'Investigation opened', actor: 'Analyst', occurredAt: minutesAgo(92) },
];

export const MOCK_OVERVIEW: OverviewData = {
  rings: MOCK_RINGS,
  alertVolume: MOCK_ALERT_VOLUME,
  activity: MOCK_ACTIVITY,
  detectionRate: 94.2,
  previousPeriod: {
    activeRings: 7,
    amountAtRisk: 4_980_000,
    accountsUnderInvestigation: 51,
    detectionRate: 92.4,
  },
};
