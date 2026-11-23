import { createContext } from 'react';
import type { SimulationSpeed, SimulationStatus } from './constants';

export interface SimulationContextValue {
  status: SimulationStatus;
  speed: SimulationSpeed;
  /** Virtual seconds elapsed since the last reset. */
  elapsedSeconds: number;
  play: () => void;
  pause: () => void;
  reset: () => void;
  setSpeed: (speed: SimulationSpeed) => void;
  injectRing: (typology?: string, difficulty?: string, amount?: number) => Promise<any>;
}

export const SimulationContext = createContext<SimulationContextValue | null>(null);
