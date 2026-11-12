import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SimulationSpeed, SimulationStatus } from './constants';
import { SimulationContext, type SimulationContextValue } from './simulationContext';

const TICK_MS = 250;

/**
 * Local-only simulation state that drives the header toolbar.
 * It advances a virtual clock while "running". It does not talk to any backend;
 * Module 12d will swap this for the real simulation endpoints.
 */
export function SimulationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SimulationStatus>('stopped');
  const [speed, setSpeedState] = useState<SimulationSpeed>(1);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (status !== 'running') return;

    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const deltaSeconds = (now - last) / 1000;
      last = now;
      setElapsedSeconds((current) => current + deltaSeconds * speed);
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [status, speed]);

  const play = useCallback(() => setStatus('running'), []);
  const pause = useCallback(() => setStatus((s) => (s === 'running' ? 'paused' : s)), []);
  const reset = useCallback(() => {
    setStatus('stopped');
    setElapsedSeconds(0);
  }, []);
  const setSpeed = useCallback((next: SimulationSpeed) => setSpeedState(next), []);

  const value = useMemo<SimulationContextValue>(
    () => ({ status, speed, elapsedSeconds, play, pause, reset, setSpeed }),
    [status, speed, elapsedSeconds, play, pause, reset, setSpeed],
  );

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}
