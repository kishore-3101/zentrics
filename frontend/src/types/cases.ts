import type { CaseAction } from './alerts';
import type { RingStatus, RingTypology } from './ring';

/**
 * Case Record representing a case entity from `cases` joined with latest ring detection details.
 */
export interface CaseRecord {
  case_id: number;
  ring_id: string;
  fingerprint: string;
  status: RingStatus;
  priority: number;
  score: number;
  ring_type: RingTypology;
  amount_moved: number;
  amount_at_risk: number;
  n_accounts: number;
  n_victims: number;
  assigned_to: string | null;
  notes: string | null;
  created_at: string; // ISO 8601 UTC
  updated_at: string; // ISO 8601 UTC
  actions_count: number;
}

/**
 * Audit Log Entry enriched with associated ring metadata for cross-case compliance review.
 */
export interface AuditLogEntry extends CaseAction {
  ring_id: string;
  ring_type: RingTypology;
}

export interface CaseFilterState {
  searchQuery: string;
  statuses: RingStatus[];
  assignee: string; // 'all' | specific analyst name | 'unassigned'
}

export type CaseSortField = 'priority' | 'score' | 'case_id' | 'created_at' | 'updated_at';

export interface CaseSortState {
  field: CaseSortField;
  direction: 'asc' | 'desc';
}

export interface AuditFilterState {
  searchQuery: string;
  actions: CaseAction['action'][];
  actor: string; // 'all' | specific actor
  datePreset: 'all' | 'today' | 'last_7_days';
}
