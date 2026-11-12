import { TYPOLOGY_META, TYPOLOGY_ORDER } from '../../lib/typology';
import type { KpiSummary, OverviewData, OverviewRing, TypologySlice } from './types';

/** Rings still needing attention (false positives are excluded). */
export function selectActiveRings(rings: readonly OverviewRing[]): OverviewRing[] {
  return rings.filter((ring) => ring.status !== 'false_positive');
}

export function selectKpiSummary(data: OverviewData): KpiSummary {
  const active = selectActiveRings(data.rings);
  const investigated = active.filter((ring) => ring.status !== 'new');

  return {
    activeRings: active.length,
    amountAtRisk: active.reduce((sum, ring) => sum + ring.amountAtRisk, 0),
    accountsUnderInvestigation: investigated.reduce((sum, ring) => sum + ring.accountCount, 0),
    detectionRate: data.detectionRate,
  };
}

export function selectTypologyBreakdown(rings: readonly OverviewRing[]): TypologySlice[] {
  const active = selectActiveRings(rings);
  const total = active.length;

  return TYPOLOGY_ORDER.map((typology) => {
    const count = active.filter((ring) => ring.typology === typology).length;
    return {
      typology,
      label: TYPOLOGY_META[typology].label,
      color: TYPOLOGY_META[typology].color,
      count,
      percent: total === 0 ? 0 : (count / total) * 100,
    };
  }).filter((slice) => slice.count > 0);
}

/** Highest risk first; amount at risk breaks ties. */
export function selectTopCriticalRings(rings: readonly OverviewRing[], limit = 5): OverviewRing[] {
  return selectActiveRings(rings)
    .sort((a, b) => b.riskScore - a.riskScore || b.amountAtRisk - a.amountAtRisk)
    .slice(0, limit);
}

export function selectTotalAlerts(data: OverviewData): number {
  return data.alertVolume.reduce(
    (sum, point) =>
      sum +
      TYPOLOGY_ORDER.reduce((inner, typology) => inner + point[typology], 0),
    0,
  );
}
