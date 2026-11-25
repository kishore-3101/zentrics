import axios from 'axios';
import type { AlertRecord, CaseAction } from '../types/alerts';
import type { RingStatus } from '../types/ring';
import { cacheSimulatedRing, getCachedRing, getCachedSimulatedRings } from './ring-graph.service';

export interface CaseActionPayload {
  action: 'freeze' | 'escalate' | 'false_positive' | 'note' | 'status_change';
  actor?: string;
  note?: string;
  to_status?: RingStatus;
  assigned_to?: string;
}

/**
 * Fetch alerts from `v_alerts` database endpoint, merging any client-cached simulated rings.
 */
export async function fetchAlerts(): Promise<AlertRecord[]> {
  let apiAlerts: AlertRecord[] = [];
  try {
    const response = await axios.get<any>('/alerts');
    const data = response.data;
    if (Array.isArray(data)) {
      apiAlerts = data;
    } else if (data && Array.isArray(data.events)) {
      apiAlerts = data.events.filter((e: any) => e.payload).map((e: any) => e.payload);
    } else if (data && Array.isArray(data.alerts)) {
      apiAlerts = data.alerts;
    }
  } catch (err) {
    console.warn('Failed to fetch alerts from API:', err);
  }

  // Merge any locally cached simulated rings not yet returned by a cold serverless lambda
  const simRings = getCachedSimulatedRings();
  if (simRings.length === 0) return apiAlerts;

  const existingIds = new Set(apiAlerts.map((a) => a.ring_id));
  const simAlerts: AlertRecord[] = simRings
    .filter((r) => !existingIds.has(r.ring_id))
    .map((r) => ({
      run_id: 1,
      ring_id: r.ring_id,
      fingerprint: r.fingerprint,
      ring_type: r.ring_type,
      score: r.score,
      priority: r.priority,
      amount_moved: r.amount_moved,
      amount_cashed: r.amount_cashed,
      amount_at_risk: r.amount_at_risk,
      duration_min: r.duration_min,
      n_accounts: r.nodes.length,
      n_victims: r.nodes.filter((n) => n.role === 'victim').length || 1,
      pattern_tags: r.pattern_tags,
      recommended: r.recommended || 'Autonomous containment active.',
      detected_at: r.detected_at,
      case_id: (r as any).case_id || 8000,
      status: r.status,
      assigned_to: 'TraceMesh AI Shield / Autonomous Detection Engine',
      case_notes: r.explanation,
      explanation: r.explanation,
      key_evidence: [],
    }));

  return [...simAlerts, ...apiAlerts];
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
 * Synchronizes local ring cache immediately when freezing or changing status.
 */
export async function postCaseAction(
  ringId: string,
  caseId: number,
  payload: CaseActionPayload,
): Promise<{ success: boolean; alert: AlertRecord; action: CaseAction }> {
  const response = await axios.post<{ alert: AlertRecord; action: CaseAction; ring?: any }>(
    `/rings/${encodeURIComponent(ringId)}/action`,
    { ...payload, case_id: caseId },
  );

  // Sync ring graph cache if ring exists locally or backend returned updated ring
  if (response.data?.ring && Array.isArray(response.data.ring.nodes)) {
    cacheSimulatedRing(response.data.ring);
  } else {
    const cached = getCachedRing(ringId);
    if (cached && payload.action === 'freeze') {
      const updated = {
        ...cached,
        status: 'frozen' as const,
        amount_at_risk: 0,
        amount_cashed: 0,
        nodes: cached.nodes.map((n) =>
          n.role !== 'victim'
            ? {
                ...n,
                is_frozen: true,
                is_blocked: true,
                blocked_reason: payload.note || 'Frozen via analyst decision cockpit.',
                blocked_by: payload.actor || 'Senior AML Operations',
              }
            : n,
        ),
        edges: cached.edges.map((e, idx) =>
          idx === cached.edges.length - 1 ? { ...e, is_blocked: true, status: 'blocked' } : e,
        ),
      };
      cacheSimulatedRing(updated);
    }
  }

  return { success: true, ...response.data };
}
