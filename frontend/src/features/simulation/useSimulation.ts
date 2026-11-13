import { useContext } from 'react';
import { SimulationContext, type SimulationContextValue } from './simulationContext';

export function useSimulation(): SimulationContextValue {
  const value = useContext(SimulationContext);
  if (!value) {
    throw new Error('useSimulation must be used inside <SimulationProvider>');
  }
  return value;
}
