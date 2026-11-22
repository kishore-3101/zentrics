import type { RingStatus, RingTypology } from './ring';

/**
 * Representation of a single alert record from the `v_alerts` database view.
 * Each alert record corresponds to a detected candidate ring cluster in the latest
 * pipeline run, joined with case management tracker data.
 */
export interface AlertRecord {
  run_id: number;
  ring_id: string;
  fingerprint: string;
  ring_type: RingTypology;
  score: number; // 0 - 100
  priority: number; // score * amount_at_risk (used for indexed triage sort)
  amount_moved: number; // INR
  amount_cashed: number; // INR cashed out
  amount_at_risk: number; // INR exposed
  duration_min: number;
  n_accounts: number;
  n_victims: number;
  pattern_tags: string[];
  recommended?: string;
  detected_at: string; // ISO 8601 UTC
  case_id: number;
  status: RingStatus; // 'new' | 'under_review' | 'frozen' | 'escalated' | 'false_positive'
  assigned_to: string | null;
  case_notes: string | null;

  // Rich metadata for the Alert Details Drawer
  explanation?: string;
  key_evidence?: string[];
  key_accounts?: {
    account_id: string;
    role: 'victim' | 'collector' | 'mule' | 'cash_out';
    amount: number;
  }[];
}

/**
 * Audit log entry matching the append-only `case_actions` table.
 */
export interface CaseAction {
  action_id: number;
  case_id: number;
  actor: string;
  action: 'freeze' | 'escalate' | 'false_positive' | 'note' | 'status_change';
  from_status: RingStatus | null;
  to_status: RingStatus | null;
  note: string | null;
  ts: string; // ISO 8601 UTC
}

/**
 * Filter state for the high-density alert table.
 */
export interface AlertFilterState {
  searchQuery: string;
  typologies: RingTypology[];
  statuses: RingStatus[];
  minRiskScore: number;
  amountPreset: 'all' | 'above_500k' | 'above_1m' | 'above_2m';
  datePreset: 'all' | 'today' | 'last_7_days';
}

/**
 * Sort options for the alert table.
 */
export type AlertSortField = 'priority' | 'score' | 'detected_at' | 'amount_at_risk' | 'amount_moved';
export type SortDirection = 'asc' | 'desc';

export interface AlertSortState {
  field: AlertSortField;
  direction: SortDirection;
}

/**
 * KPI Summary for the Alert Queue view.
 */
export interface AlertKpiMetrics {
  totalAlerts: number;
  criticalAlerts: number;
  underInvestigation: number;
  resolvedAlerts: number;
}
