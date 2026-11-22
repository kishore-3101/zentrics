import type { RingStatus, RingTypology } from '../../types/ring';

/**
 * Overview VIEW MODELS. These describe what the dashboard renders; they are not
 * backend response shapes. When the API contract is available, the overview
 * service should map the real responses into these types.
 */

export interface OverviewRing {
  /** e.g. "R-104" (format follows the Module 12 toast example). */
  id: string;
  typology: RingTypology;
  /** 0-100 */
  riskScore: number;
  /** Total Moved, in rupees. */
  totalMoved: number;
  /** Amount at Risk, in rupees. */
  amountAtRisk: number;
  accountCount: number;
  status: RingStatus;
}

/** One time bucket; counts are segmented by ring typology (Module 13 trend chart). */
export type AlertVolumePoint = { bucket: string } & Record<RingTypology, number>;

export type ActivityKind = 'detected' | 'under_review' | 'frozen' | 'escalated' | 'note';

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  ringId: string;
  detail: string;
  actor: string;
  /** ISO timestamp */
  occurredAt: string;
}

export interface KpiSummary {
  activeRings: number;
  amountAtRisk: number;
  accountsUnderInvestigation: number;
  /** Percentage, 0-100 */
  detectionRate: number;
}

export interface OverviewData {
  rings: readonly OverviewRing[];
  alertVolume: readonly AlertVolumePoint[];
  activity: readonly ActivityEvent[];
  /** Detection rate cannot be derived from the ring list, so it is supplied. */
  detectionRate: number;
  /** Previous-period KPI values used only for trend indicators. */
  previousPeriod: KpiSummary;
}

export interface TypologySlice {
  typology: RingTypology;
  label: string;
  color: string;
  count: number;
  /** 0-100 */
  percent: number;
}
