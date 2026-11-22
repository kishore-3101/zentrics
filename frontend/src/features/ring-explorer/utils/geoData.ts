import * as THREE from 'three';
import type { AccountNodeData, RingGraphData } from '../../../types/ring-graph';
import type { GeoCityCoordinate, GeoGraphData, GeoLocationNode, GeoTransactionArc } from '../types/geo';

export const SYNTHETIC_GEO_DISCLAIMER =
  'DEMO / SYNTHETIC GEOGRAPHIC COORDINATES: City mappings are synthetic spatial projections generated from account cluster metadata (e.g. tier1_delhi, tier2_jaipur) for investigative visualization purposes.';

// Standard financial intelligence coordinate registry
const CITY_COORDINATES: Record<string, GeoCityCoordinate> = {
  tier1_delhi: { id: 'tier1_delhi', city: 'Delhi', state: 'National Capital Territory', country: 'India', lat: 28.6139, lon: 77.2090 },
  tier1_ncr: { id: 'tier1_ncr', city: 'Gurugram / NCR', state: 'Haryana', country: 'India', lat: 28.4595, lon: 77.0266 },
  tier2_jaipur: { id: 'tier2_jaipur', city: 'Jaipur', state: 'Rajasthan', country: 'India', lat: 26.9124, lon: 75.7873 },
  tier3_alwar: { id: 'tier3_alwar', city: 'Alwar', state: 'Rajasthan', country: 'India', lat: 27.5530, lon: 76.6346 },
  tier2_lucknow: { id: 'tier2_lucknow', city: 'Lucknow', state: 'Uttar Pradesh', country: 'India', lat: 26.8467, lon: 80.9462 },
  tier2_kanpur: { id: 'tier2_kanpur', city: 'Kanpur', state: 'Uttar Pradesh', country: 'India', lat: 26.4499, lon: 80.3319 },
  tier1_mumbai: { id: 'tier1_mumbai', city: 'Mumbai', state: 'Maharashtra', country: 'India', lat: 19.0760, lon: 72.8777 },
  tier1_pune: { id: 'tier1_pune', city: 'Pune', state: 'Maharashtra', country: 'India', lat: 18.5204, lon: 73.8567 },
  tier1_kolkata: { id: 'tier1_kolkata', city: 'Kolkata', state: 'West Bengal', country: 'India', lat: 22.5726, lon: 88.3639 },
  tier1_bengaluru: { id: 'tier1_bengaluru', city: 'Bengaluru', state: 'Karnataka', country: 'India', lat: 12.9716, lon: 77.5946 },
  tier2_hubli: { id: 'tier2_hubli', city: 'Hubballi', state: 'Karnataka', country: 'India', lat: 15.3647, lon: 75.1240 },
  tier1_hyderabad: { id: 'tier1_hyderabad', city: 'Hyderabad', state: 'Telangana', country: 'India', lat: 17.3850, lon: 78.4867 },
  tier1_chennai: { id: 'tier1_chennai', city: 'Chennai', state: 'Tamil Nadu', country: 'India', lat: 13.0827, lon: 80.2707 },
  offshore_dubai: { id: 'offshore_dubai', city: 'Dubai', state: 'Emirate of Dubai', country: 'United Arab Emirates', lat: 25.2048, lon: 55.2708 },
  offshore_singapore: { id: 'offshore_singapore', city: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198 },
};

/** Convert spherical latitude/longitude into 3D Cartesian coordinates */
export function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

/** Resolve canonical city coordinate from account cluster string */
export function resolveCityCoord(cluster?: string, accountId?: string): GeoCityCoordinate {
  if (cluster && CITY_COORDINATES[cluster]) {
    return CITY_COORDINATES[cluster];
  }

  // Fallback deterministic assignment based on account ID string
  const knownKeys = Object.keys(CITY_COORDINATES);
  const hash = (accountId || 'default')
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const selectedKey = knownKeys[hash % knownKeys.length];
  return CITY_COORDINATES[selectedKey];
}

/** Build comprehensive geographic intelligence representation from standard RingGraphData */
export function buildGeoGraph(graph: RingGraphData, globeRadius: number = 4.8): GeoGraphData {
  const cityMap = new Map<string, GeoLocationNode>();
  const accountCityMap = new Map<string, string>();

  // 1. Group Accounts by City Location
  graph.nodes.forEach((node) => {
    const coord = resolveCityCoord(node.city_cluster, node.account_id);
    accountCityMap.set(node.account_id, coord.id);

    let loc = cityMap.get(coord.id);
    if (!loc) {
      const posVec = latLonToVector3(coord.lat, coord.lon, globeRadius);
      loc = {
        id: coord.id,
        city: coord.city,
        state: coord.state,
        country: coord.country,
        lat: coord.lat,
        lon: coord.lon,
        position: [posVec.x, posVec.y, posVec.z],
        accounts: [],
        roles: new Set(),
        transactionCount: 0,
        totalIncoming: 0,
        totalOutgoing: 0,
        totalAmount: 0,
        avgRiskScore: 0,
        maxRiskScore: 0,
        isVictimHub: false,
        isCollectorHub: false,
        isMuleHub: false,
        isCashoutHub: false,
        synthetic: true,
      };
      cityMap.set(coord.id, loc);
    }

    loc.accounts.push(node);
    loc.roles.add(node.role);
    loc.totalIncoming += node.total_incoming || 0;
    loc.totalOutgoing += node.total_outgoing || 0;
    loc.totalAmount += (node.total_incoming || 0) + (node.total_outgoing || 0);

    if (node.role === 'victim') loc.isVictimHub = true;
    if (node.role === 'collector') loc.isCollectorHub = true;
    if (node.role === 'mule') loc.isMuleHub = true;
    if (node.role === 'cash_out') loc.isCashoutHub = true;
  });

  // Calculate averages per location
  cityMap.forEach((loc) => {
    const totalRisk = loc.accounts.reduce((sum, a) => sum + (a.risk_score || 0), 0);
    loc.avgRiskScore = Math.round(totalRisk / (loc.accounts.length || 1));
    loc.maxRiskScore = Math.max(...loc.accounts.map((a) => a.risk_score || 0));
  });

  // 2. Build 3D Arcs connecting Geographic Locations
  const arcs: GeoTransactionArc[] = [];
  const nodeById = new Map<string, AccountNodeData>(graph.nodes.map((n) => [n.account_id, n]));

  graph.edges.forEach((edge) => {
    const srcCityId = accountCityMap.get(edge.src_account) || 'tier1_delhi';
    const dstCityId = accountCityMap.get(edge.dst_account) || 'tier2_jaipur';

    const srcLoc = cityMap.get(srcCityId);
    const dstLoc = cityMap.get(dstCityId);

    if (!srcLoc || !dstLoc) return;

    // Track transaction counts on locations
    srcLoc.transactionCount += 1;
    dstLoc.transactionCount += 1;

    const p1 = latLonToVector3(srcLoc.lat, srcLoc.lon, globeRadius);
    let p2 = latLonToVector3(dstLoc.lat, dstLoc.lon, globeRadius);

    // If intra-city transfer, offset slightly so curve has visible height
    if (srcCityId === dstCityId) {
      p2 = latLonToVector3(dstLoc.lat + 0.35, dstLoc.lon + 0.35, globeRadius);
    }

    // Great circle midpoint elevated above globe surface
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    const dist = p1.distanceTo(p2);
    const elevation = Math.min(2.2, Math.max(0.4, dist * 0.38));
    mid.normalize().multiplyScalar(globeRadius + elevation);

    const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);

    const srcNode = nodeById.get(edge.src_account);
    const dstNode = nodeById.get(edge.dst_account);

    let arcType: GeoTransactionArc['arcType'] = 'mule';
    let color = '#C9A85B'; // Antique gold for collector/mule transfers

    if (srcNode?.role === 'victim') {
      arcType = 'victim';
      color = '#00C878'; // Emerald for victim inflow
    } else if (dstNode?.role === 'cash_out') {
      arcType = 'cash_out';
      color = '#EF4444'; // Red for cash-out terminal
    }

    arcs.push({
      txn_id: edge.txn_id,
      src_city_id: srcCityId,
      dst_city_id: dstCityId,
      src_city: srcLoc.city,
      dst_city: dstLoc.city,
      src_account: edge.src_account,
      dst_account: edge.dst_account,
      amount: edge.amount,
      channel: edge.channel,
      ts: edge.ts,
      hop_index: edge.hop_index,
      is_suspicious: edge.is_suspicious,
      arcType,
      color,
      srcPos: p1,
      dstPos: p2,
      curve,
      elevation,
    });
  });

  const locations = Array.from(cityMap.values()).sort(
    (a, b) => b.totalAmount - a.totalAmount,
  );

  return {
    ring_id: graph.ring_id,
    locations,
    arcs,
    totalCities: locations.length,
    totalCrossBorderTxns: arcs.filter((a) => a.src_city_id !== a.dst_city_id).length,
    primaryCorridor: `${locations[0]?.city || 'Delhi'} ⇄ ${locations[1]?.city || 'Jaipur'}`,
    syntheticNotice: SYNTHETIC_GEO_DISCLAIMER,
  };
}

/**
 * Generate 2D curved bezier coordinates between two [lon, lat] geographic points.
 * Produces elegant great-circle-like arcs across planar and web mercator maps.
 */
export function createCurvedLineCoordinates(
  src: [number, number], // [lon, lat]
  dst: [number, number], // [lon, lat]
  curvature: number = 0.18,
  numPoints: number = 28,
): [number, number][] {
  const [x1, y1] = src;
  const [x2, y2] = dst;

  // Handle intra-city or identical coordinates
  if (x1 === x2 && y1 === y2) {
    const loopOffset = 0.08;
    return [
      [x1, y1],
      [x1 - loopOffset, y1 + loopOffset],
      [x1 + loopOffset, y1 + loopOffset],
      [x2, y2],
    ];
  }

  // Midpoint
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  // Perpendicular vector
  const dx = x2 - x1;
  const dy = y2 - y1;

  // Offset point
  const px = mx - dy * curvature;
  const py = my + dx * curvature;

  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const invT = 1 - t;
    const x = invT * invT * x1 + 2 * invT * t * px + t * t * x2;
    const y = invT * invT * y1 + 2 * invT * t * py + t * t * y2;
    points.push([x, y]);
  }
  return points;
}

