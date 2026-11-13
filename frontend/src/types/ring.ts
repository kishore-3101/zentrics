/**
 * UI vocabulary taken from the Module 12/13/14 docs.
 * These are front-end keys, NOT confirmed API enum values. Reconcile them with
 * the OpenAPI contract once it is available.
 */
export type RingStatus = 'new' | 'under_review' | 'frozen' | 'escalated' | 'false_positive';

export type RingTypology =
  | 'rapid_pass_through'
  | 'structural_cycle'
  | 'burst_fanin'
  | 'layering_chain'
  | 'dormant_activation';
