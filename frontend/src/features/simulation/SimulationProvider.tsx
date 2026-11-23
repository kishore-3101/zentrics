import axios from 'axios';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SimulationSpeed, SimulationStatus } from './constants';
import { SimulationContext, type ActiveAttackAlert, type SimulationContextValue } from './simulationContext';

const TICK_MS = 500;

export const DEFAULT_ATTACK_CONFIG = {
  scenario_name: 'UPI Takeover & Mule Smurfing',
  total_amount: 500000,
  channel: 'UPI',
  typology: 'circular_flow',
  victim: {
    account_id: 'ACC_VIC_901',
    name: 'Rohan Sharma (Victim)',
    city: 'Mumbai',
    latitude: 19.076,
    longitude: 72.8777,
    device_id: 'DEV_ANDR_VIC',
    device_type: 'Samsung Galaxy S23 (Android 14)',
    ip_address: '103.21.124.45',
  },
  hacker: {
    account_id: 'ACC_HACK_902',
    name: 'DarkNet Operator X',
    city: 'Delhi',
    latitude: 28.6139,
    longitude: 77.209,
    device_id: 'DEV_TOR_09',
    device_type: 'Kali Linux / Tor Proxy Node',
    ip_address: '185.220.101.5',
  },
  distributor: {
    account_id: 'ACC_DIST_903',
    name: 'Karan Malhotra (Distributor)',
    city: 'Pune',
    latitude: 18.5204,
    longitude: 73.8567,
    device_id: 'DEV_WEB_DIST',
    device_type: 'Chrome Windows 11 Desktop',
    ip_address: '49.204.110.15',
  },
  intermediator: {
    account_id: 'ACC_MULE_904',
    name: 'Pooja Verma (Mule Conduit)',
    city: 'Kanpur',
    latitude: 26.4499,
    longitude: 80.3319,
    device_id: 'DEV_MOB_MULE',
    device_type: 'OnePlus 11 (Android 13)',
    ip_address: '106.51.24.99',
  },
  cash_out: {
    account_id: 'ACC_SINK_905',
    name: 'NCR SelfServ ATM Terminal',
    city: 'Bengaluru',
    latitude: 12.9716,
    longitude: 77.5946,
    device_id: 'DEV_ATM_SINK',
    device_type: 'NCR SelfServ 84 ATM Terminal',
    ip_address: '172.16.88.201',
  },
  block_policy: {
    enabled: true,
    blocked_account_id: 'ACC_MULE_904',
    blocked_reason: 'Autonomous Freeze: Rapid velocity across 4 state boundaries within 12 seconds exceeds RBI threshold (0.91). Target account ACC_MULE_904 frozen under PMLA Sec 5.',
    blocked_by: 'TraceMesh AI Shield / Autonomous Freeze Engine',
    blocked_step: 3,
  },
};

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SimulationStatus>('stopped');
  const [speed, setSpeedState] = useState<SimulationSpeed>(1);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [savedConfig, setSavedConfig] = useState<any>(() => {
    try {
      const raw = localStorage.getItem('tm_simulation_config');
      return raw ? JSON.parse(raw) : DEFAULT_ATTACK_CONFIG;
    } catch {
      return DEFAULT_ATTACK_CONFIG;
    }
  });

  const [hasSavedConfig, setHasSavedConfig] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tm_has_saved_config') === 'true';
    } catch {
      return false;
    }
  });

  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [activeAlert, setActiveAlert] = useState<ActiveAttackAlert | null>(null);

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

  const saveConfig = useCallback((config: any) => {
    setSavedConfig(config);
    setHasSavedConfig(true);
    try {
      localStorage.setItem('tm_simulation_config', JSON.stringify(config));
      localStorage.setItem('tm_has_saved_config', 'true');
    } catch {
      // ignore storage errors
    }
  }, []);

  const dismissAlert = useCallback(() => {
    setActiveAlert(null);
  }, []);

  const runSimulation = useCallback(
    async (customPayload?: any) => {
      const payload = customPayload || savedConfig || DEFAULT_ATTACK_CONFIG;
      setIsSimulating(true);
      try {
        const resp = await axios.post('/simulation/run', payload);
        const data = resp.data;
        if (data && data.success) {
          setActiveAlert({
            ring_id: data.ring_id,
            scenario_name: data.scenario_name || payload.scenario_name || 'Syndicate Cyber Attack',
            amount: data.total_amount || payload.total_amount || 500000,
            blocked_info: data.blocked_info,
            detected_at: new Date().toISOString(),
          });
        }
        return data;
      } catch (err) {
        console.error('Failed to run simulation via backend API:', err);
        throw err;
      } finally {
        setIsSimulating(false);
      }
    },
    [savedConfig],
  );

  const injectRing = useCallback(
    async (
      typology: string = 'circular_flow',
      difficulty: string = 'medium',
      amount: number = 250000.0,
    ) => {
      return runSimulation({ typology, difficulty, amount });
    },
    [runSimulation],
  );

  const value = useMemo<SimulationContextValue>(
    () => ({
      status,
      speed,
      elapsedSeconds,
      play,
      pause,
      reset,
      setSpeed,
      injectRing,
      runSimulation,
      savedConfig,
      saveConfig,
      hasSavedConfig,
      isSimulating,
      activeAlert,
      dismissAlert,
    }),
    [
      status,
      speed,
      elapsedSeconds,
      play,
      pause,
      reset,
      setSpeed,
      injectRing,
      runSimulation,
      savedConfig,
      saveConfig,
      hasSavedConfig,
      isSimulating,
      activeAlert,
      dismissAlert,
    ],
  );

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export default SimulationProvider;
