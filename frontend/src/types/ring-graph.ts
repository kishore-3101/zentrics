import type { RingStatus, RingTypology } from './ring';

export type AccountRole = 'victim' | 'collector' | 'mule' | 'cash_out';

export type TransactionChannel = 'UPI' | 'IMPS' | 'NEFT' | 'ATM_WITHDRAWAL';

export interface ShapReasonCode {
  code: string;
  label: string;
  weight: number; // e.g. +24.5
  direction: 'increases_risk' | 'decreases_risk';
}

/**
 * Account node data model representing an account entity within the 3D graph canvas.
 * Derived from `accounts`, `ring_members`, and `account_scores`.
 */
export interface AccountNodeData {
  account_id: string;
  role: AccountRole;
  risk_score: number; // 0 - 100
  ml_prob?: number; // 0.0 - 1.0
  rule_score?: number; // 0.0 - 1.0
  neighbor_risk?: number; // 0.0 - 1.0
  open_date?: string;
  kyc_level?: 'minimal' | 'full';
  account_type?: 'savings' | 'current' | 'wallet' | 'sink';
  city_cluster?: string;
  declared_income_band?: 'low' | 'lower_mid' | 'mid' | 'upper_mid' | 'high';
  bank_id?: string;
  total_incoming: number;
  total_outgoing: number;
  transaction_count: number;
  reason_codes: ShapReasonCode[];
  is_frozen?: boolean;
  position: [number, number, number]; // 3D spatial coordinate [x, y, z]
}

/**
 * Transaction edge data model representing a payment connection between accounts.
 * Derived from `transactions` and `ring_transactions`.
 */
export interface TransactionEdgeData {
  txn_id: string;
  src_account: string;
  dst_account: string;
  amount: number; // INR
  channel: TransactionChannel;
  ts: string; // ISO 8601 UTC
  hop_index: number;
  is_suspicious: boolean;
  delay_seconds?: number;
}

/**
 * Complete ring graph structure consumed by the 3D canvas and inspector panels.
 * Conforms to `GET /rings/{id}`.
 */
export interface RingGraphData {
  ring_id: string;
  fingerprint: string;
  ring_type: RingTypology;
  score: number;
  priority: number;
  amount_moved: number;
  amount_cashed: number;
  amount_at_risk: number;
  duration_min: number;
  status: RingStatus;
  detected_at: string;
  pattern_tags: string[];
  explanation: string;
  nodes: AccountNodeData[];
  edges: TransactionEdgeData[];
}

/**
 * Ordered timeline transaction item for replay animation.
 * Conforms to `GET /rings/{id}/timeline`.
 */
export interface TimelineEvent {
  txn_id: string;
  ts: string;
  timestampMs: number;
  src_account: string;
  dst_account: string;
  amount: number;
  channel: TransactionChannel;
  hop_index: number;
  is_suspicious: boolean;
  progress: number; // 0.0 to 1.0 across the ring's time span
}

/**
 * Dynamic running totals calculated at the current timeline scrubber position.
 */
export interface TimelineRunningTotals {
  inflow: number;
  cashed_out: number;
  at_risk: number;
  completed_txns: number;
}
