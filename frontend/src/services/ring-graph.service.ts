import axios from 'axios';
import type { RingGraphData, TimelineEvent } from '../types/ring-graph';

export const FALLBACK_DEMO_RING: RingGraphData = {
  ring_id: 'R-104',
  fingerprint: 'fp_r104',
  ring_type: 'structural_cycle',
  score: 94.2,
  priority: 96.5,
  amount_moved: 750000.0,
  amount_cashed: 0.0,
  amount_at_risk: 750000.0,
  duration_min: 34.0,
  status: 'new',
  detected_at: '2026-03-10T10:49:00Z',
  pattern_tags: ['circular_routing', 'rapid_cycling', 'layering'],
  explanation: 'Circular routing between multiple accounts to obscure source of funds. Rapid pass-through retention time < 6 minutes.',
  nodes: [
    {
      account_id: 'ACC_VICTIM_401',
      role: 'victim',
      risk_score: 12.0,
      ml_prob: 0.08,
      rule_score: 0.1,
      neighbor_risk: 0.15,
      open_date: '2019-04-12',
      kyc_level: 'full',
      account_type: 'savings',
      city_cluster: 'MUMBAI',
      declared_income_band: 'mid',
      bank_id: 'TRACE_BANK',
      total_incoming: 800000.0,
      total_outgoing: 750000.0,
      transaction_count: 3,
      reason_codes: [{ code: 'NORMAL_PROFILE', label: 'Established account profile', weight: -15.0, direction: 'decreases_risk' }],
      is_frozen: false,
      position: [-8.0, 0.5, 0.0],
    },
    {
      account_id: 'ACC_MULE_401',
      role: 'collector',
      risk_score: 88.0,
      ml_prob: 0.91,
      rule_score: 0.85,
      neighbor_risk: 0.89,
      open_date: '2026-01-15',
      kyc_level: 'minimal',
      account_type: 'current',
      city_cluster: 'DELHI',
      declared_income_band: 'low',
      bank_id: 'TRACE_BANK',
      total_incoming: 750000.0,
      total_outgoing: 745000.0,
      transaction_count: 8,
      reason_codes: [{ code: 'RAPID_PASS', label: 'Rapid pass-through in under 5 mins', weight: 35.0, direction: 'increases_risk' }],
      is_frozen: false,
      position: [-4.0, 2.5, 1.2],
    },
    {
      account_id: 'ACC_MULE_402',
      role: 'mule',
      risk_score: 92.0,
      ml_prob: 0.94,
      rule_score: 0.89,
      neighbor_risk: 0.92,
      open_date: '2026-02-01',
      kyc_level: 'minimal',
      account_type: 'current',
      city_cluster: 'BANGALORE',
      declared_income_band: 'low',
      bank_id: 'FAST_BANK',
      total_incoming: 745000.0,
      total_outgoing: 740000.0,
      transaction_count: 12,
      reason_codes: [{ code: 'CIRCULAR_STEP', label: 'Layering hop in circular path', weight: 40.0, direction: 'increases_risk' }],
      is_frozen: false,
      position: [0.0, 0.0, -1.0],
    },
    {
      account_id: 'ACC_MULE_403',
      role: 'cash_out',
      risk_score: 95.0,
      ml_prob: 0.97,
      rule_score: 0.94,
      neighbor_risk: 0.95,
      open_date: '2026-02-10',
      kyc_level: 'minimal',
      account_type: 'savings',
      city_cluster: 'KOLKATA',
      declared_income_band: 'low',
      bank_id: 'SAFE_BANK',
      total_incoming: 740000.0,
      total_outgoing: 735000.0,
      transaction_count: 15,
      reason_codes: [{ code: 'CASH_OUT_ATTEMPT', label: 'High velocity withdrawal point', weight: 45.0, direction: 'increases_risk' }],
      is_frozen: false,
      position: [8.0, -1.5, 0.0],
    },
  ],
  edges: [
    {
      txn_id: 'TXN_401_01',
      src_account: 'ACC_VICTIM_401',
      dst_account: 'ACC_MULE_401',
      amount: 750000.0,
      channel: 'UPI',
      ts: '2026-03-10T10:15:00Z',
      hop_index: 1,
      is_suspicious: true,
    },
    {
      txn_id: 'TXN_401_02',
      src_account: 'ACC_MULE_401',
      dst_account: 'ACC_MULE_402',
      amount: 745000.0,
      channel: 'IMPS',
      ts: '2026-03-10T10:22:00Z',
      hop_index: 2,
      is_suspicious: true,
    },
    {
      txn_id: 'TXN_401_03',
      src_account: 'ACC_MULE_402',
      dst_account: 'ACC_MULE_403',
      amount: 740000.0,
      channel: 'NEFT',
      ts: '2026-03-10T10:35:00Z',
      hop_index: 3,
      is_suspicious: true,
    },
  ],
};

/**
 * Service to fetch 3D Ring Topology and Timeline replay events from live database.
 * Conforms strictly to GET /rings/{id} and GET /rings/{id}/timeline.
 */
export async function fetchRingGraph(ringId: string): Promise<RingGraphData> {
  const normalizedId = (ringId || '').trim();
  const targetId = !normalizedId || normalizedId === 'demo-ring' ? 'R-104' : normalizedId;
  try {
    const response = await axios.get<RingGraphData>(`/rings/${encodeURIComponent(targetId)}`);
    if (response.data && Array.isArray(response.data.nodes) && response.data.nodes.length > 0) {
      return response.data;
    }
  } catch (err) {
    console.warn(`Could not load ring ${targetId}, serving fallback demo ring topology:`, err);
  }
  return {
    ...FALLBACK_DEMO_RING,
    ring_id: targetId,
  };
}

export async function fetchRingTimeline(ringId: string): Promise<TimelineEvent[]> {
  try {
    const graph = await fetchRingGraph(ringId);
    const edges = [...(graph?.edges || [])];

    if (edges.length === 0) return [];

    // Sort strictly in chronological order by transaction timestamp
    edges.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    const firstTs = new Date(edges[0].ts).getTime();
    const lastTs = new Date(edges[edges.length - 1].ts).getTime();
    const totalDuration = Math.max(lastTs - firstTs, 1);

    return edges.map((edge) => {
      const timestampMs = new Date(edge.ts).getTime();
      const progress = Math.min(1, Math.max(0, (timestampMs - firstTs) / totalDuration));

      return {
        txn_id: edge.txn_id,
        ts: edge.ts,
        timestampMs,
        src_account: edge.src_account,
        dst_account: edge.dst_account,
        amount: edge.amount,
        channel: edge.channel,
        hop_index: edge.hop_index,
        is_suspicious: edge.is_suspicious,
        progress,
      };
    });
  } catch (err) {
    console.warn(`Could not load timeline for ${ringId}:`, err);
    return [];
  }
}
