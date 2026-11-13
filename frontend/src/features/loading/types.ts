export type AccountCategory = 'victim' | 'collector' | 'mule' | 'cashout';

export interface LoadingAccountNode {
  id: string;
  name: string;
  bank: string;
  category: AccountCategory;
  col: number; // 0: victim, 1: collector, 2: mule, 3: cashout
  x: number; // percentage in SVG coordinate space (0 - 1000)
  y: number; // percentage in SVG coordinate space (0 - 600)
  amount?: string;
  role: string;
  riskScore: number;
  highlighted?: boolean;
}

export interface LoadingTransactionPath {
  id: string;
  from: string;
  to: string;
  curvature?: number; // 0 = straight, positive = curve down, negative = curve up
  amountToken?: string; // '₹' symbol token
  isCycle?: boolean;
}

export interface GlobeHubPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  color?: string;
}
