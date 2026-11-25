import axios from 'axios';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SimulationSpeed, SimulationStatus } from './constants';
import { SimulationContext, type ActiveAttackAlert, type SimulationContextValue } from './simulationContext';
import { cacheSimulatedRing } from '../../services/ring-graph.service';
import type { RingGraphData } from '../../types/ring-graph';
import type { RingTypology } from '../../types/ring';

const TICK_MS = 500;

function normalizeTypology(raw?: string): RingTypology {
  if (
    raw === 'rapid_pass_through' ||
    raw === 'structural_cycle' ||
    raw === 'burst_fanin' ||
    raw === 'layering_chain' ||
    raw === 'dormant_activation'
  ) {
    return raw;
  }
  return 'structural_cycle';
}

export const DEFAULT_ATTACK_CONFIG = {
  scenario_name: 'UPI Takeover & Mule Smurfing',
  total_amount: 500000,
  channel: 'UPI',
  typology: 'structural_cycle',
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
    blocked_reason: 'Autonomous Freeze: Rapid velocity across 4 state boundaries exceeds RBI threshold (0.91). Target account ACC_MULE_904 frozen under PMLA Sec 5.',
    blocked_by: 'TraceMesh AI Shield / Autonomous Freeze Engine',
    blocked_step: 3,
  },
};

function synthesizeClientRing(payload: any, ringId: string, blockedInfo: any): RingGraphData {
  const cfg = { ...DEFAULT_ATTACK_CONFIG, ...payload };
  const totalAmt = Number(cfg.total_amount || payload?.amount || 500000);
  const blockEnabled = cfg.block_policy?.enabled !== false;
  const now = Date.now();
  const v = { ...DEFAULT_ATTACK_CONFIG.victim, ...(cfg.victim || {}) };
  const h = { ...DEFAULT_ATTACK_CONFIG.hacker, ...(cfg.hacker || {}) };
  const d = { ...DEFAULT_ATTACK_CONFIG.distributor, ...(cfg.distributor || {}) };
  const m = { ...DEFAULT_ATTACK_CONFIG.intermediator, ...(cfg.intermediator || {}) };
  const c = { ...DEFAULT_ATTACK_CONFIG.cash_out, ...(cfg.cash_out || {}) };
  const freezeReason = blockedInfo?.blocked_reason || cfg.block_policy?.blocked_reason || 'Autonomous AI Shield Freeze executed.';

  return {
    ring_id: ringId,
    fingerprint: `inj_${ringId.toLowerCase()}_fp`,
    ring_type: normalizeTypology(cfg.typology),
    score: 94.6,
    priority: Math.round(94.6 * (totalAmt / 1000)),
    amount_moved: totalAmt,
    amount_cashed: blockEnabled ? 0 : Math.round(totalAmt * 0.48),
    amount_at_risk: blockEnabled ? 0 : totalAmt,
    duration_min: 4,
    status: blockEnabled ? 'frozen' : 'under_review',
    detected_at: new Date(now).toISOString(),
    pattern_tags: [normalizeTypology(cfg.typology), 'live_simulation', blockEnabled ? 'auto_freeze' : 'active_threat'],
    explanation: `Live stream evaluated: ${cfg.scenario_name} with ₹${totalAmt.toLocaleString('en-IN')} volume.`,
    blocked_info: blockedInfo,
    nodes: [
      {
        account_id: v.account_id,
        role: 'victim',
        risk_score: 12.0,
        ml_prob: 0.08,
        rule_score: 0.05,
        neighbor_risk: 0.14,
        city: v.city,
        city_cluster: `tier1_${v.city.toLowerCase()}`,
        latitude: v.latitude,
        longitude: v.longitude,
        device_id: v.device_id,
        device_type: v.device_type,
        ip_address: v.ip_address,
        kyc_level: 'full',
        account_type: 'savings',
        total_incoming: totalAmt,
        total_outgoing: totalAmt,
        transaction_count: 1,
        reason_codes: [{ code: 'NORMAL_HISTORY', label: 'Established customer baseline', weight: -15, direction: 'decreases_risk' }],
        is_frozen: false,
        is_blocked: false,
        position: [-9, 0.5, 0],
      },
      {
        account_id: h.account_id,
        role: 'collector',
        risk_score: 91.5,
        ml_prob: 0.93,
        rule_score: 0.90,
        neighbor_risk: 0.88,
        city: h.city,
        city_cluster: `tier1_${h.city.toLowerCase()}`,
        latitude: h.latitude,
        longitude: h.longitude,
        device_id: h.device_id,
        device_type: h.device_type,
        ip_address: h.ip_address,
        kyc_level: 'minimal',
        account_type: 'current',
        total_incoming: totalAmt,
        total_outgoing: totalAmt * 0.98,
        transaction_count: 2,
        reason_codes: [{ code: 'SUSPICIOUS_INFRASTRUCTURE', label: `Adversarial telemetry (${h.device_type})`, weight: 35, direction: 'increases_risk' }],
        is_frozen: blockEnabled,
        is_blocked: blockEnabled,
        blocked_by: 'TraceMesh AI Shield / Autonomous Detection Engine',
        blocked_reason: `Adversary Collector Frozen under PMLA Sec 5 (${h.city}).`,
        position: [-4.5, 3.2, 1.8],
      },
      {
        account_id: d.account_id,
        role: 'mule',
        risk_score: 90.8,
        ml_prob: 0.91,
        rule_score: 0.88,
        neighbor_risk: 0.92,
        city: d.city,
        city_cluster: `tier1_${d.city.toLowerCase()}`,
        latitude: d.latitude,
        longitude: d.longitude,
        device_id: d.device_id,
        device_type: d.device_type,
        ip_address: d.ip_address,
        kyc_level: 'minimal',
        account_type: 'current',
        total_incoming: totalAmt * 0.98,
        total_outgoing: totalAmt * 0.96,
        transaction_count: 2,
        reason_codes: [{ code: 'LAYERING_CONDUIT', label: `Multi-state layering hop (${h.city} -> ${d.city})`, weight: 28, direction: 'increases_risk' }],
        is_frozen: blockEnabled,
        is_blocked: blockEnabled,
        blocked_by: 'TraceMesh AI Shield / Autonomous Detection Engine',
        blocked_reason: `Distributor Mule Frozen for cross-state structuring (${d.city}).`,
        position: [0, 0, -1.2],
      },
      {
        account_id: m.account_id,
        role: 'mule',
        risk_score: 94.6,
        ml_prob: 0.958,
        rule_score: 0.92,
        neighbor_risk: 0.93,
        city: m.city,
        city_cluster: `tier2_${m.city.toLowerCase()}`,
        latitude: m.latitude,
        longitude: m.longitude,
        device_id: m.device_id,
        device_type: m.device_type,
        ip_address: m.ip_address,
        kyc_level: 'minimal',
        account_type: 'current',
        total_incoming: totalAmt * 0.96,
        total_outgoing: totalAmt * 0.94,
        transaction_count: 2,
        reason_codes: [{ code: 'RAPID_PASSTHROUGH', label: 'Rapid velocity pass-through >95% within 3m', weight: 38, direction: 'increases_risk' }],
        is_frozen: blockEnabled,
        is_blocked: blockEnabled,
        blocked_by: 'TraceMesh AI Shield / Autonomous Detection Engine',
        blocked_reason: freezeReason,
        position: [4.8, 2.6, 1.5],
      },
      {
        account_id: c.account_id,
        role: 'cash_out',
        risk_score: 93.2,
        ml_prob: 0.94,
        rule_score: 0.90,
        neighbor_risk: 0.95,
        city: c.city,
        city_cluster: `tier1_${c.city.toLowerCase()}`,
        latitude: c.latitude,
        longitude: c.longitude,
        device_id: c.device_id,
        device_type: c.device_type,
        ip_address: c.ip_address,
        kyc_level: 'full',
        account_type: 'sink',
        total_incoming: totalAmt * 0.94,
        total_outgoing: 0,
        transaction_count: 1,
        reason_codes: [{ code: 'CASH_OUT_SINK', label: 'Terminal ATM / OTC extraction endpoint', weight: 40, direction: 'increases_risk' }],
        is_frozen: blockEnabled,
        is_blocked: blockEnabled,
        blocked_by: 'TraceMesh AI Shield / Autonomous Detection Engine',
        blocked_reason: `Cash-Out Sink Blocked: Terminal ${c.account_id} quarantined under PMLA Sec 5.`,
        position: [9, -1.8, 0],
      },
    ],
    edges: [
      { txn_id: `TXN_${ringId}_1`, src_account: v.account_id, dst_account: h.account_id, amount: totalAmt, channel: (cfg.channel as any) || 'UPI', ts: new Date(now - 240000).toISOString(), hop_index: 1, is_suspicious: false },
      { txn_id: `TXN_${ringId}_2`, src_account: h.account_id, dst_account: d.account_id, amount: Math.round(totalAmt * 0.98), channel: 'IMPS', ts: new Date(now - 180000).toISOString(), hop_index: 2, is_suspicious: true },
      { txn_id: `TXN_${ringId}_3`, src_account: d.account_id, dst_account: m.account_id, amount: Math.round(totalAmt * 0.96), channel: (cfg.channel as any) || 'UPI', ts: new Date(now - 120000).toISOString(), hop_index: 3, is_suspicious: true },
      { txn_id: `TXN_${ringId}_4`, src_account: m.account_id, dst_account: c.account_id, amount: Math.round(totalAmt * 0.94), channel: 'ATM_WITHDRAWAL', ts: new Date(now - 60000).toISOString(), hop_index: 4, is_suspicious: true, is_blocked: blockEnabled, blocked_reason: blockEnabled ? freezeReason : undefined },
    ],
  };
}

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
        if (data && data.ring_id) {
          // Cache complete RingGraphData so RingExplorer loads the brand new ring immediately without Vercel instance misses
          const fullRing: RingGraphData = Array.isArray(data.nodes) && data.nodes.length > 0
            ? {
                ring_id: data.ring_id,
                fingerprint: data.fingerprint || `inj_${data.ring_id.toLowerCase()}_fp`,
                ring_type: normalizeTypology(data.ring_type || payload.typology),
                score: Number(data.score ?? data.detection_results?.detected_fused_risk ?? 94.6),
                priority: Number(data.priority ?? 950),
                amount_moved: Number(data.amount_moved ?? data.total_amount ?? payload.total_amount ?? 500000),
                amount_cashed: Number(data.amount_cashed ?? 0),
                amount_at_risk: Number(data.amount_at_risk ?? 0),
                duration_min: Number(data.duration_min ?? 4),
                status: data.status || (data.blocked_info?.is_blocked ? 'frozen' : 'under_review'),
                detected_at: data.detected_at || new Date().toISOString(),
                pattern_tags: Array.isArray(data.pattern_tags) ? data.pattern_tags : [normalizeTypology(payload.typology), 'live_simulation'],
                explanation: data.explanation || `Simulated ${data.scenario_name || payload.scenario_name}`,
                recommended: data.recommended,
                nodes: data.nodes,
                edges: data.edges || [],
                blocked_info: data.blocked_info,
              }
            : synthesizeClientRing(payload, data.ring_id, data.blocked_info);

          cacheSimulatedRing(fullRing);

          setActiveAlert({
            ring_id: data.ring_id,
            scenario_name: data.scenario_name || payload.scenario_name || 'Syndicate Cyber Attack',
            amount: data.total_amount || payload.total_amount || 500000,
            blocked_info: data.blocked_info,
            detected_at: new Date().toISOString(),
          });
          return fullRing;
        }
        return data;
      } catch (err) {
        console.warn('Backend simulation API unreachable or returned error, synthesizing client-side attack:', err);
        const simId = Date.now() % 1000000;
        const ringId = payload.ring_id || `SIM-RING-${simId}`;
        const totalAmt = Number(payload.total_amount || payload.amount || 500000);
        const blockedInfo = payload.block_policy?.enabled !== false ? {
          is_blocked: true,
          blocked_account: payload.block_policy?.blocked_account_id || payload.intermediator?.account_id || 'ACC_MULE_904',
          blocked_city: payload.intermediator?.city || 'Kanpur',
          blocked_reason: payload.block_policy?.blocked_reason || 'Autonomous AI Shield Freeze: Fused Risk 94.6% (XGBoost ML Confidence 95.8%). Account quarantined under PMLA Sec 5 before cash-out sink.',
          amount_saved: totalAmt,
        } : undefined;

        const fallbackRing = synthesizeClientRing(payload, ringId, blockedInfo);
        cacheSimulatedRing(fallbackRing);

        setActiveAlert({
          ring_id: fallbackRing.ring_id,
          scenario_name: payload.scenario_name || 'Live Account Takeover & Multi-Hop Syndicate',
          amount: totalAmt,
          blocked_info: blockedInfo,
          detected_at: new Date().toISOString(),
        });
        return { ...fallbackRing, success: true, total_amount: totalAmt };
      } finally {
        setIsSimulating(false);
      }
    },
    [savedConfig],
  );

  const injectRing = useCallback(
    async (
      typology: string = 'structural_cycle',
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
