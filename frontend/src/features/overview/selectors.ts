import { TYPOLOGY_META, TYPOLOGY_ORDER } from '../../lib/typology';
import type { KpiSummary, OverviewData, OverviewRing, TypologySlice } from './types';

/** Rings still needing attention (false positives are excluded). */
export function selectActiveRings(rings: readonly OverviewRing[]): OverviewRing[] {
  if (!rings || !Array.isArray(rings)) return [];
  return rings.filter((ring) => ring.status !== 'false_positive');
}

export function selectKpiSummary(data: OverviewData): KpiSummary {
  const rings = data?.rings || [];
  const active = selectActiveRings(rings);
  const investigated = (active || []).filter((ring) => ring?.status !== 'new');

  return {
    activeRings: active?.length || 0,
    amountAtRisk: (active || []).reduce((sum, ring) => sum + (ring?.amountAtRisk || 0), 0),
    accountsUnderInvestigation: (investigated || []).reduce((sum, ring) => sum + (ring?.accountCount || 0), 0),
    detectionRate: data?.detectionRate ?? 92.5,
  };
}

export function selectTypologyBreakdown(rings: readonly OverviewRing[]): TypologySlice[] {
  const active = selectActiveRings(rings || []);
  const total = active.length;

  return TYPOLOGY_ORDER.map((typology) => {
    const count = active.filter((ring) => ring.typology === typology).length;
    return {
      typology,
      label: TYPOLOGY_META[typology]?.label || typology,
      color: TYPOLOGY_META[typology]?.color || '#ffffff',
      count,
      percent: total === 0 ? 0 : (count / total) * 100,
    };
  }).filter((slice) => slice.count > 0);
}

/** Highest risk first; amount at risk breaks ties. */
export function selectTopCriticalRings(rings: readonly OverviewRing[], limit = 5): OverviewRing[] {
  return selectActiveRings(rings || [])
    .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0) || (b.amountAtRisk || 0) - (a.amountAtRisk || 0))
    .slice(0, limit);
}

export function selectTotalAlerts(data: OverviewData): number {
  if (!data?.alertVolume || !Array.isArray(data.alertVolume)) {
    return 0;
  }
  return data.alertVolume.reduce(
    (sum, point) =>
      sum +
      TYPOLOGY_ORDER.reduce((inner, typology) => inner + (point?.[typology] || 0), 0),
    0,
  );
}
