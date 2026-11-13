import type { RingTypology } from '../types/ring';

export interface TypologyMeta {
  label: string;
  color: string;
  /** Pattern tag style used in Module 14 ring headers. */
  tag: string;
}

/** Display order is also the stacking / slice order in charts. Adjacent colors are kept distinct on purpose. */
export const TYPOLOGY_ORDER: readonly RingTypology[] = [
  'rapid_pass_through',
  'structural_cycle',
  'burst_fanin',
  'layering_chain',
  'dormant_activation',
];

export const TYPOLOGY_META: Record<RingTypology, TypologyMeta> = {
  rapid_pass_through: { label: 'Rapid Pass-Through', color: '#00C878', tag: '#rapid_pass_through' },
  structural_cycle: { label: 'Structural Cycle', color: '#C9A85B', tag: '#structural_cycle' },
  burst_fanin: { label: 'Burst Fan-in', color: '#2FB5A6', tag: '#burst_fanin' },
  layering_chain: { label: 'Layering Chain', color: '#E5C778', tag: '#layering_chain' },
  dormant_activation: { label: 'Dormant Activation', color: '#8B9B8F', tag: '#dormant_activation' },
};
