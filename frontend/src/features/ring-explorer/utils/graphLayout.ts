import type { AccountNodeData, AccountRole, TransactionEdgeData } from '../../../types/ring-graph';
import type { RingTypology } from '../../../types/ring';

/**
 * Deterministic 3D Graph Layout Engine (Original commit from feat/frontend-dashboard).
 * Computes 3D coordinates [x, y, z] for accounts while strictly preserving
 * all underlying transaction topology and cycle paths.
 */

export function computeGraphLayout(
  rawNodes: Omit<AccountNodeData, 'position'>[],
  _edges: TransactionEdgeData[],
  ringType?: RingTypology,
): AccountNodeData[] {
  // If Structural Cycle, arrange cycle nodes in a distinct ring orbit
  if (ringType === 'structural_cycle') {
    return computeCyclicLayout(rawNodes);
  }

  // Tiered Flow Layout (Inflow -> Aggregation -> Layering -> Outflow)
  return computeTieredFlowLayout(rawNodes);
}

/**
 * Arranges cyclic graph nodes in an open 3D circle/cylinder so cyclic edges
 * loop visibly back around without edge crossing.
 */
function computeCyclicLayout(rawNodes: Omit<AccountNodeData, 'position'>[]): AccountNodeData[] {
  const cycleNodes = rawNodes.filter((n) => n.role === 'mule' || n.role === 'collector');
  const victimNodes = rawNodes.filter((n) => n.role === 'victim');
  const cashOutNodes = rawNodes.filter((n) => n.role === 'cash_out');

  const positionedNodes: AccountNodeData[] = [];
  const cycleRadius = 6.5;
  const cycleCount = Math.max(cycleNodes.length, 1);

  // Position cyclic nodes in an X-Z circular loop
  cycleNodes.forEach((node, i) => {
    const angle = (i / cycleCount) * Math.PI * 2;
    const x = Math.cos(angle) * cycleRadius;
    const z = Math.sin(angle) * cycleRadius;
    const y = Math.sin(angle * 2) * 1.2; // subtle wave for depth
    positionedNodes.push({ ...node, position: [x, y, z] });
  });

  // Position victim feeder nodes to the left/exterior
  victimNodes.forEach((node, i) => {
    const angle = Math.PI + (i - (victimNodes.length - 1) / 2) * 0.5;
    const radius = 10.5;
    const x = Math.cos(angle) * radius - 2;
    const z = Math.sin(angle) * radius;
    const y = ((i % 3) - 1) * 2;
    positionedNodes.push({ ...node, position: [x, y, z] });
  });

  // Position cash-out sinks to the right/exterior
  cashOutNodes.forEach((node, i) => {
    const angle = (i - (cashOutNodes.length - 1) / 2) * 0.5;
    const radius = 10.5;
    const x = Math.cos(angle) * radius + 2;
    const z = Math.sin(angle) * radius;
    const y = ((i % 3) - 1) * 2;
    positionedNodes.push({ ...node, position: [x, y, z] });
  });

  return positionedNodes;
}

/**
 * Hierarchical tiered layout for Fan-in, Layering Chain, Rapid Pass-Through, and Dormant Activation.
 */
function computeTieredFlowLayout(rawNodes: Omit<AccountNodeData, 'position'>[]): AccountNodeData[] {
  const byRole: Record<AccountRole, Omit<AccountNodeData, 'position'>[]> = {
    victim: [],
    collector: [],
    mule: [],
    cash_out: [],
  };

  rawNodes.forEach((node) => {
    byRole[node.role].push(node);
  });

  const positionedNodes: AccountNodeData[] = [];

  // Helper to space nodes evenly in a vertical/depth fan
  const layoutTier = (
    nodes: Omit<AccountNodeData, 'position'>[],
    baseX: number,
    spreadY: number,
    spreadZ: number,
  ) => {
    const count = nodes.length;
    nodes.forEach((node, idx) => {
      // Centered index around 0
      const offset = idx - (count - 1) / 2;
      const x = baseX + Math.sin(idx) * 0.8;
      const y = offset * spreadY;
      const z = Math.sin(offset * 1.1) * spreadZ;
      positionedNodes.push({ ...node, position: [x, y, z] });
    });
  };

  // 1. Victims: Left boundary (X: -9.5)
  const victimSpreadY = Math.min(2.2, 12 / Math.max(byRole.victim.length, 1));
  layoutTier(byRole.victim, -9.5, victimSpreadY, 4.5);

  // 2. Collectors: Aggregation focal hub (X: -2.5)
  const collectorSpreadY = Math.min(3.5, 8 / Math.max(byRole.collector.length, 1));
  layoutTier(byRole.collector, -2.5, collectorSpreadY, 3.0);

  // 3. Mules: Layering intermediaries (X: 4.0)
  const muleSpreadY = Math.min(3.0, 10 / Math.max(byRole.mule.length, 1));
  layoutTier(byRole.mule, 4.0, muleSpreadY, 3.8);

  // 4. Cash-out sinks: Terminal right boundary (X: 10.0)
  const cashOutSpreadY = Math.min(3.5, 8 / Math.max(byRole.cash_out.length, 1));
  layoutTier(byRole.cash_out, 10.0, cashOutSpreadY, 3.0);

  return positionedNodes;
}

export default computeGraphLayout;
