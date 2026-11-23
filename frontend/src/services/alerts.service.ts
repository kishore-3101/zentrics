import axios from 'axios';
import type { AlertRecord, CaseAction } from '../types/alerts';
import type { RingStatus } from '../types/ring';

export interface CaseActionPayload {
  action: 'freeze' | 'escalate' | 'false_positive' | 'note' | 'status_change';
  actor?: string;
  note?: string;
  to_status?: RingStatus;
  assigned_to?: string;
}

/**
 * Fetch alerts from `v_alerts` database endpoint.
 */
export async function fetchAlerts(): Promise<AlertRecord[]> {
  const response = await axios.get<AlertRecord[]>('/alerts');
  return response.data;
}

/**
 * Fetch append-only audit trail for a case from `case_actions` endpoint.
 */
export async function fetchCaseActions(caseId: number): Promise<CaseAction[]> {
  if (!caseId || isNaN(Number(caseId))) {
    return [];
  }

  try {
    const response = await axios.get<CaseAction[]>(`/cases/${caseId}/actions`);
    return response.data || [];
  } catch (err) {
    console.warn(`Failed to fetch actions for case ${caseId}:`, err);
    return [];
  }
}

/**
 * Perform an analyst action on a ring/case.
 * Follows API contract: POST /rings/{ring_id}/action
 * Persists action to case_actions audit table and updates ring/case in database.
 */
export async function postCaseAction(
  ringId: string,
  caseId: number,
  payload: CaseActionPayload,
): Promise<{ success: boolean; alert: AlertRecord; action: CaseAction }> {
  const response = await axios.post<{ alert: AlertRecord; action: CaseAction }>(
    `/rings/${encodeURIComponent(ringId)}/action`,
    { ...payload, case_id: caseId },
  );
  return { success: true, ...response.data };
}
