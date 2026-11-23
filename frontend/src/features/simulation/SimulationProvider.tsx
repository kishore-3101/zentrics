import axios from 'axios';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SimulationSpeed, SimulationStatus } from './constants';
import { SimulationContext, type SimulationContextValue } from './simulationContext';

const TICK_MS = 500;

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SimulationStatus>('stopped');
  const [speed, setSpeedState] = useState<SimulationSpeed>(1);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Sync with backend simulation state
  const syncStateFromBackend = useCallback(async () => {
    try {
      const resp = await axios.get('/simulation/state');
      if (resp.data) {
        if (resp.data.status) setStatus(resp.data.status);
        if (resp.data.speed) setSpeedState(resp.data.speed as SimulationSpeed);
      }
    } catch {
      // Graceful offline fallback
    }
  }, []);

  useEffect(() => {
    syncStateFromBackend();
  }, [syncStateFromBackend]);

  // Local clock progression
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

  const play = useCallback(async () => {
    setStatus('running');
    try {
      await axios.post('/simulation/start');
    } catch {
      // Resilient local fallback
    }
  }, []);

  const pause = useCallback(async () => {
    setStatus('paused');
    try {
      await axios.post('/simulation/pause');
    } catch {
      // Resilient local fallback
    }
  }, []);

  const reset = useCallback(async () => {
    setStatus('stopped');
    setElapsedSeconds(0);
    try {
      await axios.post('/simulation/reset');
    } catch {
      // Resilient local fallback
    }
  }, []);

  const setSpeed = useCallback(async (next: SimulationSpeed) => {
    setSpeedState(next);
    try {
      await axios.post('/simulation/speed', { speed: next });
    } catch {
      // Resilient local fallback
    }
  }, []);

  const injectRing = useCallback(
    async (
      typology: string = 'circular_flow',
      difficulty: string = 'medium',
      amount: number = 250000.0,
    ) => {
      try {
        const resp = await axios.post('/simulation/inject_ring', {
          typology,
          difficulty,
          amount,
        });
        return resp.data;
      } catch (err) {
        console.error('Failed to inject ring via backend API:', err);
        return null;
      }
    },
    [],
  );

  const value = useMemo<SimulationContextValue>(
    () => ({ status, speed, elapsedSeconds, play, pause, reset, setSpeed, injectRing }),
    [status, speed, elapsedSeconds, play, pause, reset, setSpeed, injectRing],
  );

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export default SimulationProvider;
