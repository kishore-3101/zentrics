import axios from 'axios';
import { USE_MOCK } from '../config/env';
import { INITIAL_MOCK_ALERTS, INITIAL_MOCK_CASE_ACTIONS } from '../features/alerts/data/mockAlerts';
import type { AlertRecord, CaseAction } from '../types/alerts';
import type { RingStatus } from '../types/ring';

// Local in-memory state for mock mode so analyst actions persist during session
let inMemoryAlerts: AlertRecord[] = [...INITIAL_MOCK_ALERTS];
const inMemoryCaseActions: Record<number, CaseAction[]> = { ...INITIAL_MOCK_CASE_ACTIONS };
let nextActionId = 1000;

export interface CaseActionPayload {
  action: 'freeze' | 'escalate' | 'false_positive' | 'note' | 'status_change';
  actor?: string;
  note?: string;
  to_status?: RingStatus;
  assigned_to?: string;
}

/**
 * Fetch alerts from `v_alerts` endpoint (or mock store).
 */
export async function fetchAlerts(): Promise<AlertRecord[]> {
  if (USE_MOCK) {
    // Return a cloned copy so local edits are controlled
    return [...inMemoryAlerts];
  }

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

  if (USE_MOCK) {
    return inMemoryCaseActions[caseId] ? [...inMemoryCaseActions[caseId]] : [];
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
 * Follows documented API contract: POST /rings/{ring_id}/action
 * Updates case state and appends to case_actions audit table.
 */
export async function postCaseAction(
  ringId: string,
  caseId: number,
  payload: CaseActionPayload,
): Promise<{ success: boolean; alert: AlertRecord; action: CaseAction }> {
  const actor = payload.actor || 'Lead AML Investigator';
  const timestamp = new Date().toISOString();

  if (USE_MOCK) {
    const alertIndex = inMemoryAlerts.findIndex((a) => a.case_id === caseId || a.ring_id === ringId);
    if (alertIndex === -1) {
      throw new Error(`Alert record with ringId ${ringId} or caseId ${caseId} not found.`);
    }

    const currentAlert = inMemoryAlerts[alertIndex];
    const fromStatus = currentAlert.status;
    const toStatus = payload.to_status ?? (payload.action === 'freeze'
      ? 'frozen'
      : payload.action === 'false_positive'
        ? 'false_positive'
        : payload.action === 'escalate'
          ? 'escalated'
          : fromStatus);

    const newAction: CaseAction = {
      action_id: ++nextActionId,
      case_id: caseId,
      actor,
      action: payload.action,
      from_status: fromStatus,
      to_status: toStatus,
      note: payload.note || null,
      ts: timestamp,
    };

    if (!inMemoryCaseActions[caseId]) {
      inMemoryCaseActions[caseId] = [];
    }
    inMemoryCaseActions[caseId] = [newAction, ...inMemoryCaseActions[caseId]];

    const updatedAlert: AlertRecord = {
      ...currentAlert,
      status: toStatus,
      case_notes: payload.note ? payload.note : currentAlert.case_notes,
      assigned_to: payload.assigned_to !== undefined ? payload.assigned_to : (currentAlert.assigned_to || actor),
    };

    inMemoryAlerts[alertIndex] = updatedAlert;

    return { success: true, alert: updatedAlert, action: newAction };
  }

  // Live API invocation
  const response = await axios.post<{ alert: AlertRecord; action: CaseAction }>(
    `/rings/${encodeURIComponent(ringId)}/action`,
    payload,
  );
  return { success: true, ...response.data };
}

/**
 * Reset mock data to original fixtures (useful for interactive demo restarts).
 */
export function resetMockAlerts(): void {
  inMemoryAlerts = [...INITIAL_MOCK_ALERTS];
}
