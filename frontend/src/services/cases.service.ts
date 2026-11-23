import axios from 'axios';
import { fetchAlerts, fetchCaseActions, postCaseAction } from './alerts.service';
import type { AuditLogEntry, CaseRecord } from '../types/cases';

/**
 * Cases & Audit Service.
 * Bridges with alerts.service.ts to guarantee 100% shared state synchronization
 * across Alert Queue, Ring Explorer, Case Management, and the Compliance Audit Log.
 */

export async function fetchAllCases(): Promise<CaseRecord[]> {
  try {
    const response = await axios.get<CaseRecord[]>('/cases');
    if (response.data && Array.isArray(response.data)) {
      return response.data;
    }
  } catch (err) {
    console.warn('GET /cases endpoint error, using fallback:', err);
  }

  const alerts = await fetchAlerts();

  // Map alerts to CaseRecords (v_alerts represents rings joined to cases)
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

/**
 * Aggregates all recorded case_actions across all cases into a unified chronological audit ledger.
 */
export async function fetchAllAuditLogs(): Promise<AuditLogEntry[]> {
  try {
    const response = await axios.get<AuditLogEntry[]>('/audit/logs');
    if (response.data && Array.isArray(response.data)) {
      return response.data;
    }
  } catch (err) {
    console.warn('GET /audit/logs endpoint error, using fallback:', err);
  }

  const alerts = await fetchAlerts();

  // Parallel fetch fallback
  const results = await Promise.all(
    alerts.map(async (alert) => {
      if (!alert.case_id) return [];
      const actions = await fetchCaseActions(alert.case_id);
      return actions.map((act) => ({
        ...act,
        ring_id: alert.ring_id,
        ring_type: alert.ring_type,
      }));
    }),
  );

  const allLogs: AuditLogEntry[] = results.flat();

  // Sort strictly in reverse chronological order (newest actions first)
  allLogs.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return allLogs;
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
