export const SIMULATION_SPEEDS = [1, 5, 20, 60] as const;

export type SimulationSpeed = (typeof SIMULATION_SPEEDS)[number];
export type SimulationStatus = 'running' | 'paused' | 'stopped';
