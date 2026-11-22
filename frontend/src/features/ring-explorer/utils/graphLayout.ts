import type { AccountNodeData, TransactionEdgeData } from '../../../types/ring-graph';
import type { RingTypology } from '../../../types/ring';
import { resolveCityCoord } from './geoData';
import { geoTo3D } from './geo3DData';

/**
 * 3D Geographic Network Layout Engine.
 * Positions each account node directly above its real-world geographical
 * city coordinates (latitude & longitude) on the 3D map surface, applying
 * subtle orbital cluster dispersion so co-located accounts are individually
 * visible, clickable, and inspectable in 3D space.
 */
export function computeGraphLayout(
  rawNodes: Omit<AccountNodeData, 'position'>[],
  _edges: TransactionEdgeData[],
  _ringType?: RingTypology,
): AccountNodeData[] {
  // 1. Group nodes by their canonical city coordinate ID
  const cityGroups = new Map<string, Omit<AccountNodeData, 'position'>[]>();

  rawNodes.forEach((node) => {
    const coord = resolveCityCoord(node.city_cluster, node.account_id);
    let group = cityGroups.get(coord.id);
    if (!group) {
      group = [];
      cityGroups.set(coord.id, group);
    }
    group.push(node);
  });

  const positionedNodes: AccountNodeData[] = [];

  // 2. Position nodes above their respective city
  cityGroups.forEach((group, cityId) => {
    const coord = resolveCityCoord(cityId);
    const [baseX, , baseZ] = geoTo3D(coord.lon, coord.lat, 0);
    const count = group.length;

    group.forEach((node, i) => {
      let x = baseX;
      let z = baseZ;
      let y = 1.8; // Baseline altitude hovering above map surface

      if (count === 1) {
        // Single account in this hub (e.g. Kolkata terminal sink or Dubai offshore)
        y = node.role === 'cash_out' ? 2.15 : node.role === 'collector' ? 1.95 : 1.75;
      } else {
        // Multiple accounts in this city: radial orbital dispersal around city anchor
        const radius = Math.min(1.5, 0.45 + (count - 1) * 0.08);
        const angle = (i / count) * Math.PI * 2 + (i % 2 === 0 ? 0 : Math.PI / count);

        x = baseX + Math.cos(angle) * radius;
        z = baseZ + Math.sin(angle) * radius;

        // Role-based vertical tiering
        const roleElevation =
          node.role === 'cash_out'
            ? 0.45
            : node.role === 'collector'
              ? 0.3
              : node.role === 'mule'
                ? 0.15
                : 0.0;
        y = 1.6 + roleElevation + ((i % 3) - 1) * 0.2;
      }

      positionedNodes.push({
        ...node,
        position: [x, y, z],
      });
    });
  });

  return positionedNodes;
}
