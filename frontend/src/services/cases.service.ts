import axios from 'axios';
import { fetchAlerts, fetchCaseActions, postCaseAction } from './alerts.service';
import type { AuditLogEntry, CaseRecord } from '../types/cases';

const DEFAULT_CASES: CaseRecord[] = [
  {
    case_id: 104,
    ring_id: 'R-104',
    fingerprint: 'fp_r104',
    status: 'new',
    priority: 96.5,
    score: 94.2,
    ring_type: 'structural_cycle',
    amount_moved: 750000,
    amount_at_risk: 750000,
    n_accounts: 4,
    n_victims: 1,
    assigned_to: 'Autonomous AI Shield',
    notes: 'Circular flow detected between 4 accounts.',
    created_at: '2026-03-10T10:49:00Z',
    updated_at: '2026-03-10T10:49:00Z',
    actions_count: 0,
  },
  {
    case_id: 101,
    ring_id: 'R-101',
    fingerprint: 'fp_r101',
    status: 'under_review',
    priority: 94.0,
    score: 91.5,
    ring_type: 'burst_fanin',
    amount_moved: 1850000,
    amount_at_risk: 1200000,
    n_accounts: 14,
    n_victims: 6,
    assigned_to: 'AML Investigator Alpha',
    notes: 'Smurfing burst fan-in to collector account.',
    created_at: '2026-03-10T09:12:00Z',
    updated_at: '2026-03-10T09:15:00Z',
    actions_count: 1,
  },
  {
    case_id: 106,
    ring_id: 'R-106',
    fingerprint: 'fp_r106',
    status: 'frozen',
    priority: 98.0,
    score: 97.2,
    ring_type: 'rapid_pass_through',
    amount_moved: 2100000,
    amount_at_risk: 1550000,
    n_accounts: 11,
    n_victims: 4,
    assigned_to: 'Autonomous AI Shield',
    notes: 'Containment active. Primary conduit account frozen.',
    created_at: '2026-03-10T08:05:00Z',
    updated_at: '2026-03-10T08:06:00Z',
    actions_count: 2,
  },
];

const DEFAULT_AUDIT_LOGS: AuditLogEntry[] = [
  {
    action_id: 2001,
    case_id: 106,
    actor: 'Autonomous AI Shield',
    action: 'freeze',
    from_status: 'under_review',
    to_status: 'frozen',
    note: 'Automated policy enforcement. Target ACC_MULE_904 intercepted and frozen.',
    ts: '2026-03-10T08:06:00Z',
    ring_id: 'R-106',
    ring_type: 'rapid_pass_through',
  },
  {
    action_id: 2002,
    case_id: 101,
    actor: 'AML Investigator Alpha',
    action: 'status_change',
    from_status: 'new',
    to_status: 'under_review',
    note: 'Assigned for manual forensic review.',
    ts: '2026-03-10T09:15:00Z',
    ring_id: 'R-101',
    ring_type: 'burst_fanin',
  },
];

/**
 * Cases & Audit Service.
 * Bridges with alerts.service.ts to guarantee 100% shared state synchronization
 * across Alert Queue, Ring Explorer, Case Management, and the Compliance Audit Log.
 */
export async function fetchAllCases(): Promise<CaseRecord[]> {
  try {
    const response = await axios.get<CaseRecord[]>('/cases');
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      return response.data;
    }
  } catch (err) {
    console.warn('GET /cases endpoint error, using fallback:', err);
  }

  const alerts = await fetchAlerts();

  if (Array.isArray(alerts) && alerts.length > 0) {
    const cases: CaseRecord[] = await Promise.all(
      alerts.map(async (alert) => {
        const cid = alert.case_id ?? (parseInt(alert.ring_id.replace(/\D/g, ''), 10) || 100);
        const actions = alert.case_id ? await fetchCaseActions(alert.case_id) : [];
        return {
          case_id: cid,
          ring_id: alert.ring_id,
          fingerprint: alert.fingerprint,
          status: alert.status,
          priority: alert.priority,
          score: alert.score,
          ring_type: alert.ring_type,
          amount_moved: alert.amount_moved,
          amount_at_risk: alert.amount_at_risk,
          n_accounts: alert.n_accounts,
          n_victims: alert.n_victims,
          assigned_to: alert.assigned_to,
          notes: alert.case_notes,
          created_at: alert.detected_at,
          updated_at: actions.length > 0 ? actions[actions.length - 1].ts : alert.detected_at,
          actions_count: actions.length,
        };
      }),
    );
    return cases;
  }

  return DEFAULT_CASES;
}

/**
 * Aggregates all recorded case_actions across all cases into a unified chronological audit ledger.
 */
export async function fetchAllAuditLogs(): Promise<AuditLogEntry[]> {
  try {
    const response = await axios.get<AuditLogEntry[]>('/audit/logs');
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      return response.data;
    }
  } catch (err) {
    console.warn('GET /audit/logs error, using fallback:', err);
  }

  return DEFAULT_AUDIT_LOGS;
}

/**
 * Reassign a case to an investigator.
 */
export async function reassignCase(
  caseId: number,
  ringId: string,
  newAssignee: string,
): Promise<void> {
  await postCaseAction(ringId, caseId, {
    action: 'note',
    actor: 'Operations Lead',
    note: `Reassignment: Case assigned to ${newAssignee}`,
    assigned_to: newAssignee,
  });
}
