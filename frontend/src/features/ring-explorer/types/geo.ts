import type * as THREE from 'three';
import type { AccountNodeData, AccountRole, TransactionChannel } from '../../../types/ring-graph';

/**
 * Metadata for a geographical city coordinate.
 * Clearly identified as synthetic demo data for mule network mapping.
 */
export interface GeoCityCoordinate {
  id: string;
  city: string;
  state?: string;
  country: string;
  lat: number;
  lon: number;
}

/**
 * Consolidated geographical location node aggregating accounts in a single city.
 */
export interface GeoLocationNode {
  id: string; // city cluster ID e.g. 'delhi', 'jaipur'
  city: string;
  state?: string;
  country: string;
  lat: number;
  lon: number;
  position: [number, number, number]; // 3D Vector coordinate on the globe sphere
  accounts: AccountNodeData[];
  roles: Set<AccountRole>;
  transactionCount: number;
  totalIncoming: number;
  totalOutgoing: number;
  totalAmount: number;
  avgRiskScore: number;
  maxRiskScore: number;
  isVictimHub: boolean;
  isCollectorHub: boolean;
  isMuleHub: boolean;
  isCashoutHub: boolean;
  synthetic: boolean;
}

/**
 * 3D Curved Arc representing money movement between two geographic cities.
 */
export interface GeoTransactionArc {
  txn_id: string;
  src_city_id: string;
  dst_city_id: string;
  src_city: string;
  dst_city: string;
  src_account: string;
  dst_account: string;
  amount: number;
  channel: TransactionChannel;
  ts: string;
  hop_index: number;
  is_suspicious: boolean;
  arcType: 'victim' | 'mule' | 'cash_out';
  color: string;
  srcPos: THREE.Vector3;
  dstPos: THREE.Vector3;
  curve: THREE.QuadraticBezierCurve3;
  elevation: number;
}

/**
 * Summary of geographic distribution for the current ring.
 */
export interface GeoGraphData {
  ring_id: string;
  locations: GeoLocationNode[];
  arcs: GeoTransactionArc[];
  totalCities: number;
  totalCrossBorderTxns: number;
  primaryCorridor: string;
  syntheticNotice: string;
}
