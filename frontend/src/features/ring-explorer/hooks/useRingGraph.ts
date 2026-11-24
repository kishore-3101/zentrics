import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchRingGraph, fetchRingTimeline } from '../../../services/ring-graph.service';
import type {
  AccountNodeData,
  AccountRole,
  RingGraphData,
  TimelineEvent,
  TransactionEdgeData,
} from '../../../types/ring-graph';

export function useRingGraph(ringId: string) {
  const [graph, setGraph] = useState<RingGraphData | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedNode, setSelectedNode] = useState<AccountNodeData | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<TransactionEdgeData | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<Set<AccountRole>>(
    () => new Set(['victim', 'collector', 'mule', 'cash_out']),
  );

  const loadGraph = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const [graphData, timelineData] = await Promise.all([
        fetchRingGraph(id),
        fetchRingTimeline(id),
      ]);

      // Ensure every node has valid 3D coordinates, risk score, and required attributes
      if (graphData && Array.isArray(graphData.nodes)) {
        const roleDefaultPositions: Record<string, [number, number, number]> = {
          victim: [-8.0, 0.5, 0.0],
          collector: [-4.0, 2.5, 1.2],
          mule: [0.0, 0.0, -1.0],
          cash_out: [8.0, -1.5, 0.0],
        };

        graphData.nodes.forEach((node, idx) => {
          if (
            !Array.isArray(node.position) ||
            node.position.length !== 3 ||
            node.position.some((coord) => typeof coord !== 'number' || isNaN(coord))
          ) {
            const fallbackPos = roleDefaultPositions[node.role] || [
              (idx - (graphData.nodes.length - 1) / 2) * 3.5,
              (idx % 2 === 0 ? 1 : -1) * 1.5,
              0,
            ];
            node.position = fallbackPos;
          }
          if (typeof node.risk_score !== 'number' || isNaN(node.risk_score)) {
            node.risk_score = node.role === 'victim' ? 15 : 88;
          }
          if (!Array.isArray(node.reason_codes)) {
            node.reason_codes = [];
          }
        });
      }

      setGraph(graphData);
      setTimeline(timelineData);
      setSelectedNode(null);
      setSelectedEdge(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load ring graph.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGraph(ringId);
  }, [ringId, loadGraph]);

  const handleToggleRole = useCallback((role: AccountRole) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        if (next.size > 1) next.delete(role); // keep at least one role
      } else {
        next.add(role);
      }
      return next;
    });
  }, []);

  // Filtered nodes based on role selections and search
  const visibleNodes = useMemo(() => {
    if (!graph || !Array.isArray(graph.nodes)) return [];
    return graph.nodes.filter((node) => {
      if (!node) return false;
      if (!selectedRoles.has(node.role)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (node.account_id || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [graph, selectedRoles, searchQuery]);

  // Edges connecting visible nodes
  const visibleEdges = useMemo(() => {
    if (!graph || !Array.isArray(graph.edges)) return [];
    const visibleAccountIds = new Set(visibleNodes.map((n) => n.account_id));
    return graph.edges.filter(
      (e) => e && visibleAccountIds.has(e.src_account) && visibleAccountIds.has(e.dst_account),
    );
  }, [graph, visibleNodes]);

  return {
    graph,
    timeline,
    loading,
    error,
    nodes: visibleNodes,
    edges: visibleEdges,
    selectedNode,
    setSelectedNode,
    selectedEdge,
    setSelectedEdge,
    showLabels,
    setShowLabels,
    selectedRoles,
    handleToggleRole,
    searchQuery,
    setSearchQuery,
    reload: () => loadGraph(ringId),
  };
}
