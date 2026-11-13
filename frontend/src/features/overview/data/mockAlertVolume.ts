import type { AlertVolumePoint } from '../types';

/**
 * MOCK DATA: illustrative alert volume in 2-hour buckets.
 * Counts are account-level alerts segmented by ring typology and total 412,
 * matching the "412 alerts grouped into 9 rings" example in Module 13.
 * Replace with the real series once the API contract is available.
 */
export const MOCK_ALERT_VOLUME: readonly AlertVolumePoint[] = [
  { bucket: '00:00', rapid_pass_through: 4, structural_cycle: 2, burst_fanin: 1, layering_chain: 2, dormant_activation: 5 },
  { bucket: '02:00', rapid_pass_through: 3, structural_cycle: 3, burst_fanin: 1, layering_chain: 2, dormant_activation: 3 },
  { bucket: '04:00', rapid_pass_through: 4, structural_cycle: 2, burst_fanin: 3, layering_chain: 3, dormant_activation: 2 },
  { bucket: '06:00', rapid_pass_through: 6, structural_cycle: 3, burst_fanin: 4, layering_chain: 3, dormant_activation: 3 },
  { bucket: '08:00', rapid_pass_through: 8, structural_cycle: 4, burst_fanin: 6, layering_chain: 4, dormant_activation: 3 },
  { bucket: '10:00', rapid_pass_through: 13, structural_cycle: 7, burst_fanin: 9, layering_chain: 6, dormant_activation: 4 },
  { bucket: '12:00', rapid_pass_through: 17, structural_cycle: 9, burst_fanin: 12, layering_chain: 7, dormant_activation: 6 },
  { bucket: '14:00', rapid_pass_through: 21, structural_cycle: 10, burst_fanin: 17, layering_chain: 8, dormant_activation: 6 },
  { bucket: '16:00', rapid_pass_through: 18, structural_cycle: 12, burst_fanin: 21, layering_chain: 7, dormant_activation: 4 },
  { bucket: '18:00', rapid_pass_through: 16, structural_cycle: 11, burst_fanin: 18, layering_chain: 5, dormant_activation: 3 },
  { bucket: '20:00', rapid_pass_through: 11, structural_cycle: 7, burst_fanin: 12, layering_chain: 4, dormant_activation: 3 },
  { bucket: '22:00', rapid_pass_through: 7, structural_cycle: 4, burst_fanin: 8, layering_chain: 3, dormant_activation: 2 },
];
