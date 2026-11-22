import type { AccountNodeData, AccountRole, TransactionEdgeData } from '../../../types/ring-graph';
import type { RingTypology } from '../../../types/ring';

/**
 * Deterministic 3D Graph Layout Engine.
 * Arranges nodes along a clean isometric forensic perspective plane matching the
 * TraceMesh command center design:
 * Inflow Victims (Left) -> Collectors (Mid-Left) -> Layering Mules (Mid-Right) -> Cash-Out Sinks (Right)
 */

export function computeGraphLayout(
  rawNodes: Omit<AccountNodeData, 'position'>[],
  _edges: TransactionEdgeData[],
  ringType: RingTypology,
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
  const cycleRadius = 6.0;
  const cycleCount = Math.max(cycleNodes.length, 1);

  // Position cyclic nodes in an X-Z circular loop near Y = 0
  cycleNodes.forEach((node, i) => {
    const angle = (i / cycleCount) * Math.PI * 2;
    const x = Math.cos(angle) * cycleRadius + 2.0;
    const z = Math.sin(angle) * cycleRadius;
    const y = 0.5 + Math.sin(angle * 2) * 0.8;
    positionedNodes.push({ ...node, position: [x, y, z] });
  });

  // Position victim feeder nodes to the left
  victimNodes.forEach((node, i) => {
    const count = victimNodes.length;
    const offset = i - (count - 1) / 2;
    const x = -10.0 + (i % 2 === 0 ? -1.0 : 1.0);
    const y = 0.5 + offset * 1.5;
    const z = ((i % 4) - 1.5) * 2.5;
    positionedNodes.push({ ...node, position: [x, y, z] });
  });

  // Position cash-out sinks to the right
  cashOutNodes.forEach((node, i) => {
    const count = cashOutNodes.length;
    const offset = i - (count - 1) / 2;
    const x = 11.5;
    const y = 0.5 + offset * 2.0;
    const z = ((i % 3) - 1) * 2.0;
    positionedNodes.push({ ...node, position: [x, y, z] });
  });

  return positionedNodes;
}

/**
 * Hierarchical tiered layout matching the reference screenshot:
 * Victims clustered in columns on the left, collectors in diamond focal points,
 * mules in orbital planetary rings, and cash-out in a solid red terminal box on the right.
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

  // 1. Victims: Clustered on Left in columns (X: -10 to -7)
  const victims = byRole.victim;
  const victimCount = victims.length;
  victims.forEach((node, idx) => {
    // 3 subtle staggered sub-columns
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const rowsTotal = Math.ceil(victimCount / 3);
    const rowOffset = row - (rowsTotal - 1) / 2;

    const x = -11.0 + col * 2.2 + (Math.sin(idx * 1.7) * 0.4);
    const y = 0.6 + rowOffset * 1.6;
    const z = (col - 1) * 2.2 + (Math.cos(idx * 1.2) * 0.8);

    positionedNodes.push({ ...node, position: [x, y, z] });
  });

  // 2. Collectors: Aggregation focal hub (X: -2.5)
  const collectors = byRole.collector;
  const colCount = collectors.length;
  collectors.forEach((node, idx) => {
    const offset = idx - (colCount - 1) / 2;
    const x = -2.5;
    const y = 0.6 + offset * 2.6;
    const z = Math.sin(offset * 1.5) * 1.8;
    positionedNodes.push({ ...node, position: [x, y, z] });
  });

  // 3. Mules: Layering intermediaries (X: 3.8 to 4.5)
  const mules = byRole.mule;
  const muleCount = mules.length;
  mules.forEach((node, idx) => {
    const offset = idx - (muleCount - 1) / 2;
    const x = 3.8 + (idx % 2 === 0 ? 0.8 : -0.5);
    const y = 0.6 + offset * 2.4;
    const z = (idx % 2 === 0 ? 1.5 : -1.5);
    positionedNodes.push({ ...node, position: [x, y, z] });
  });

  // 4. Cash-out sinks: Terminal right boundary (X: 9.8)
  const cashOuts = byRole.cash_out;
  const cashCount = cashOuts.length;
  cashOuts.forEach((node, idx) => {
    const offset = idx - (cashCount - 1) / 2;
    const x = 9.8;
    const y = 0.6 + offset * 2.8;
    const z = 0;
    positionedNodes.push({ ...node, position: [x, y, z] });
  });

  return positionedNodes;
}
