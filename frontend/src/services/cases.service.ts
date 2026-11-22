import { fetchAlerts, fetchCaseActions, postCaseAction } from './alerts.service';
import type { AuditLogEntry, CaseRecord } from '../types/cases';

/**
 * Cases & Audit Service.
 * Bridges with alerts.service.ts to guarantee 100% shared state synchronization
 * across Alert Queue, Ring Explorer, Case Management, and the Compliance Audit Log.
 */

export async function fetchAllCases(): Promise<CaseRecord[]> {
  const alerts = await fetchAlerts();

  // Map alerts to CaseRecords (v_alerts represents rings joined to cases)
  const cases: CaseRecord[] = await Promise.all(
    alerts.map(async (alert) => {
      const actions = await fetchCaseActions(alert.case_id);
      return {
        case_id: alert.case_id,
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
        updated_at: actions.length > 0 ? actions[0].ts : alert.detected_at,
        actions_count: actions.length,
      };
    }),
  );

  return cases;
}

/**
 * Aggregates all recorded case_actions across all cases into a unified chronological audit ledger.
 */
export async function fetchAllAuditLogs(): Promise<AuditLogEntry[]> {
  const alerts = await fetchAlerts();
  const allLogs: AuditLogEntry[] = [];

  for (const alert of alerts) {
    const actions = await fetchCaseActions(alert.case_id);
    for (const act of actions) {
      allLogs.push({
        ...act,
        ring_id: alert.ring_id,
        ring_type: alert.ring_type,
      });
    }
  }

  // Sort strictly in reverse chronological order (newest actions first)
  allLogs.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return allLogs;
}

/**
 * Reassign a case to an investigator.
 * Clarification Note: The schema `cases` supports `assigned_to`, while `case_actions` has
 * CHECK (action IN ('freeze', 'escalate', 'false_positive', 'note', 'status_change')).
 * To avoid inventing an unapproved action enum, we log the reassignment via 'note'
 * and update the case's assigned_to property.
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
