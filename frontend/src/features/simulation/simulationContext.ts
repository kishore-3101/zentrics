import { createContext } from 'react';
import type { SimulationSpeed, SimulationStatus } from './constants';

export interface ActiveAttackAlert {
  ring_id: string;
  scenario_name: string;
  amount: number;
  blocked_info?: {
    is_blocked: boolean;
    blocked_account?: string;
    blocked_city?: string;
    blocked_reason?: string;
    amount_saved?: number;
  };
  detected_at: string;
}

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
  runSimulation: (customPayload?: any) => Promise<any>;
  savedConfig: any | null;
  saveConfig: (config: any) => void;
  hasSavedConfig: boolean;
  isSimulating: boolean;
  activeAlert: ActiveAttackAlert | null;
  dismissAlert: () => void;
}

export const SimulationContext = createContext<SimulationContextValue | null>(null);
