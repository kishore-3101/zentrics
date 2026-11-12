import axios from 'axios';
import { USE_MOCK } from '../config/env';
import { MOCK_RING_GRAPHS } from '../features/ring-explorer/data/mockRingGraphData';
import type { RingGraphData, TimelineEvent } from '../types/ring-graph';

/**
 * Service to fetch 3D Ring Topology and Timeline replay events.
 * Conforms strictly to GET /rings/{id} and GET /rings/{id}/timeline.
 */

export async function fetchRingGraph(ringId: string): Promise<RingGraphData> {
  const normalizedId = ringId.trim();

  if (USE_MOCK) {
    const found = MOCK_RING_GRAPHS[normalizedId] || MOCK_RING_GRAPHS['R-104'];
    return JSON.parse(JSON.stringify(found));
  }

  const response = await axios.get<RingGraphData>(`/rings/${encodeURIComponent(normalizedId)}`);
  return response.data;
}

export async function fetchRingTimeline(ringId: string): Promise<TimelineEvent[]> {
  const graph = await fetchRingGraph(ringId);
  const edges = [...graph.edges];

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
}
