import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Sliders,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { useSimulation } from './useSimulation';
import { cn } from '../../lib/cn';
import { formatInrCompact } from '../../lib/formatters';

export const CITY_GEO_LOOKUP: Record<string, { lat: number; lon: number }> = {
  Mumbai: { lat: 19.0760, lon: 72.8777 },
  Delhi: { lat: 28.6139, lon: 77.2090 },
  Kolkata: { lat: 22.5726, lon: 88.3639 },
  Bengaluru: { lat: 12.9716, lon: 77.5946 },
  Hyderabad: { lat: 17.3850, lon: 78.4867 },
  Chennai: { lat: 13.0827, lon: 80.2707 },
  Pune: { lat: 18.5204, lon: 73.8567 },
  Kanpur: { lat: 26.4499, lon: 80.3319 },
  Jaipur: { lat: 26.9124, lon: 75.7873 },
  Ahmedabad: { lat: 23.0225, lon: 72.5714 },
  Dubai: { lat: 25.2048, lon: 55.2708 },
  Singapore: { lat: 1.3521, lon: 103.8198 },
};

export interface SimulationEntity {
  account_id: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  device_id: string;
  device_type: string;
  ip_address: string;
}

export interface SimulationPreset {
  id: string;
  label: string;
  badge: string;
  description: string;
  amount: number;
  channel: string;
  typology: string;
  victim: SimulationEntity;
  hacker: SimulationEntity;
  distributor: SimulationEntity;
  intermediator: SimulationEntity;
  cash_out: SimulationEntity;
  blocked_target: 'auto' | 'intermediator' | 'cash_out';
  blocked_reason: string;
}

const PRESETS: SimulationPreset[] = [
  {
    id: 'upi_takeover',
    label: 'UPI Takeover & Mule Smurfing',
    badge: '₹5L · Mumbai ➔ Kanpur',
    description: 'Phishing credential replay draining ₹5L from Mumbai across 4 states into a Kanpur mule conduit.',
    amount: 500000,
    channel: 'UPI',
    typology: 'circular_flow',
    victim: {
      account_id: 'ACC_VIC_901',
      name: 'Rohan Sharma (Victim)',
      city: 'Mumbai',
      latitude: 19.0760,
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
      longitude: 77.2090,
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
    blocked_target: 'intermediator',
    blocked_reason: 'Autonomous Freeze: Rapid velocity across 4 state boundaries within 12 seconds exceeds RBI threshold (0.91). Target account ACC_MULE_904 frozen under PMLA Sec 5.',
  },
  {
    id: 'layering_chain',
    label: 'High-Value Corporate Wire Layering',
    badge: '₹12L · Kolkata ➔ Hyderabad',
    description: 'Compromised corporate credentials fan-out across multiple commercial hubs before attempting offshore OTC conversion.',
    amount: 1200000,
    channel: 'NEFT',
    typology: 'layering_chain',
    victim: {
      account_id: 'ACC_CORP_VIC',
      name: 'Apex Infratech Pvt Ltd',
      city: 'Kolkata',
      latitude: 22.5726,
      longitude: 88.3639,
      device_id: 'DEV_CORP_MAC',
      device_type: 'macOS Sonoma Enterprise Portal',
      ip_address: '122.160.8.20',
    },
    hacker: {
      account_id: 'ACC_ADV_LAYER',
      name: 'APT Syndicate Vector',
      city: 'Jaipur',
      latitude: 26.9124,
      longitude: 75.7873,
      device_id: 'DEV_VPN_NODE',
      device_type: 'NordVPN Gateway Endpoint',
      ip_address: '194.26.29.11',
    },
    distributor: {
      account_id: 'ACC_HUB_CHEN',
      name: 'Suresh Iyer (Aggregator)',
      city: 'Chennai',
      latitude: 13.0827,
      longitude: 80.2707,
      device_id: 'DEV_CHEN_DESK',
      device_type: 'Ubuntu Linux Workstation',
      ip_address: '59.92.144.18',
    },
    intermediator: {
      account_id: 'ACC_MULE_HYD',
      name: 'Vikram Reddy (Intermediator)',
      city: 'Hyderabad',
      latitude: 17.3850,
      longitude: 78.4867,
      device_id: 'DEV_VIVO_HYD',
      device_type: 'Vivo V29 5G (Android 14)',
      ip_address: '115.112.44.8',
    },
    cash_out: {
      account_id: 'ACC_CRYPTO_SINK',
      name: 'P2P Crypto OTC Desk',
      city: 'Dubai',
      latitude: 25.2048,
      longitude: 55.2708,
      device_id: 'DEV_OTC_NODE',
      device_type: 'Offshore OTC Trading Gateway',
      ip_address: '185.193.64.2',
    },
    blocked_target: 'intermediator',
    blocked_reason: 'Autonomous Freeze: Cross-border structuring pattern. Rapid hop from Kolkata to Hyderabad with immediate OTC offshore conversion intent.',
  },
  {
    id: 'circular_syndicate',
    label: 'Circular Flow Syndicate Loop',
    badge: '₹8L · Delhi ➔ Mumbai Loop',
    description: 'High-velocity circular loop designed to spoof synthetic credit ratings and bypass legacy AML filters.',
    amount: 800000,
    channel: 'IMPS',
    typology: 'circular_flow',
    victim: {
      account_id: 'ACC_VIC_DLH',
      name: 'Meera Kapoor (Victim)',
      city: 'Delhi',
      latitude: 28.6139,
      longitude: 77.2090,
      device_id: 'DEV_IOS_DLH',
      device_type: 'Apple iPhone 15 Pro (iOS 17)',
      ip_address: '117.205.88.12',
    },
    hacker: {
      account_id: 'ACC_HACK_MUM',
      name: 'ShadowLoop Operator',
      city: 'Mumbai',
      latitude: 19.0760,
      longitude: 72.8777,
      device_id: 'DEV_VM_SHADOW',
      device_type: 'Arch Linux Cloud VM',
      ip_address: '104.244.72.115',
    },
    distributor: {
      account_id: 'ACC_DIST_PN',
      name: 'Ajay Kulkarni (Distributor)',
      city: 'Pune',
      latitude: 18.5204,
      longitude: 73.8567,
      device_id: 'DEV_PUNE_DESK',
      device_type: 'Windows 11 Workstation',
      ip_address: '49.204.110.15',
    },
    intermediator: {
      account_id: 'ACC_MULE_KN',
      name: 'Rahul Mishra (Cycle Mule)',
      city: 'Kanpur',
      latitude: 26.4499,
      longitude: 80.3319,
      device_id: 'DEV_KN_MULE',
      device_type: 'Xiaomi Redmi Note 13',
      ip_address: '106.51.24.99',
    },
    cash_out: {
      account_id: 'ACC_SINK_BLR',
      name: 'Digital Wallet Gateway Sink',
      city: 'Bengaluru',
      latitude: 12.9716,
      longitude: 77.5946,
      device_id: 'DEV_WALLET_SINK',
      device_type: 'Prepaid Wallet Server',
      ip_address: '172.16.4.10',
    },
    blocked_target: 'intermediator',
    blocked_reason: 'Autonomous Freeze: Graph cycle detected with high clustering coefficient (0.94). Account ACC_MULE_KN frozen before loop closure.',
  },
];

interface SimulationStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SimulationStudioModal({ isOpen, onClose }: SimulationStudioModalProps) {
  const navigate = useNavigate();
  const { saveConfig, savedConfig, runSimulation } = useSimulation();

  const [preset, setPreset] = useState<SimulationPreset>(PRESETS[0]);
  const [amount, setAmount] = useState<number>(savedConfig?.total_amount || PRESETS[0].amount);
  const [channel, setChannel] = useState<string>(savedConfig?.channel || PRESETS[0].channel);
  const [typology, setTypology] = useState<string>(savedConfig?.typology || PRESETS[0].typology);
  const [blockEnabled, setBlockEnabled] = useState<boolean>(savedConfig?.block_policy?.enabled ?? true);
  const [activeTab, setActiveTab] = useState<'config' | 'entities' | 'policy'>('config');

  // Entities
  const [victim, setVictim] = useState<SimulationEntity>(savedConfig?.victim || PRESETS[0].victim);
  const [hacker, setHacker] = useState<SimulationEntity>(savedConfig?.hacker || PRESETS[0].hacker);
  const [distributor, setDistributor] = useState<SimulationEntity>(savedConfig?.distributor || PRESETS[0].distributor);
  const [intermediator, setIntermediator] = useState<SimulationEntity>(savedConfig?.intermediator || PRESETS[0].intermediator);
  const [cashOut, setCashOut] = useState<SimulationEntity>(savedConfig?.cash_out || PRESETS[0].cash_out);
  const [blockedTarget, setBlockedTarget] = useState<'auto' | 'intermediator' | 'cash_out'>(
    savedConfig?.block_policy?.blocked_account_id === savedConfig?.cash_out?.account_id
      ? 'cash_out'
      : savedConfig?.block_policy?.blocked_account_id === savedConfig?.intermediator?.account_id
      ? 'intermediator'
      : 'auto'
  );
  const [blockedReason, setBlockedReason] = useState<string>(savedConfig?.block_policy?.blocked_reason || PRESETS[0].blocked_reason);
  const [isSavedNotice, setIsSavedNotice] = useState(false);
  const [isExecutingNow, setIsExecutingNow] = useState(false);

  // Lock body scroll and listen for Escape key while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const applyPreset = (p: SimulationPreset) => {
    setPreset(p);
    setAmount(p.amount);
    setChannel(p.channel);
    setTypology(p.typology);
    setVictim(p.victim);
    setHacker(p.hacker);
    setDistributor(p.distributor);
    setIntermediator(p.intermediator);
    setCashOut(p.cash_out);
    setBlockedTarget(p.blocked_target);
    setBlockedReason(p.blocked_reason);
  };

  const buildPayload = () => {
    const blockedAccount =
      blockedTarget === 'auto'
        ? undefined
        : blockedTarget === 'intermediator'
        ? intermediator.account_id
        : cashOut.account_id;

    return {
      scenario_name: preset.label,
      total_amount: amount,
      channel,
      typology,
      victim,
      hacker,
      distributor,
      intermediator,
      cash_out: cashOut,
      block_policy: {
        enabled: blockEnabled,
        blocked_target: blockedTarget,
        blocked_account_id: blockedAccount,
        blocked_reason: blockedReason,
        blocked_by: 'TraceMesh AI Shield / Autonomous Detection Engine',
        blocked_step: blockedTarget === 'intermediator' ? 3 : blockedTarget === 'cash_out' ? 4 : undefined,
      },
    };
  };

  const handleSaveSettings = () => {
    const payload = buildPayload();
    saveConfig(payload);
    setIsSavedNotice(true);
    setTimeout(() => {
      setIsSavedNotice(false);
      onClose();
    }, 450);
  };

  const handleExecuteNow = async () => {
    setIsExecutingNow(true);
    try {
      const payload = buildPayload();
      saveConfig(payload);
      const res = await runSimulation(payload);
      onClose();
      if (res && res.ring_id) {
        navigate(`/rings/${res.ring_id}?live=1`);
      }
    } catch (err) {
      console.error('Failed to execute simulation:', err);
    } finally {
      setIsExecutingNow(false);
    }
  };

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="simulation-studio-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-4xl max-h-[82vh] h-auto rounded-2xl border border-gold/30 bg-[#0B1812] shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================================================================= */}
        {/* FIXED HEADER: ALWAYS VISIBLE AT TOP                              */}
        {/* ================================================================= */}
        <div className="shrink-0 border-b border-gold/15 bg-sidebar/95 px-5 py-3.5 space-y-3">
          {/* Title Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-gold/40 bg-gold/15 text-gold-light shadow-xs">
                <Sliders className="size-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="simulation-studio-title" className="font-display text-base font-bold text-ink leading-none">
                    Attack Simulation Settings
                  </h2>
                  <span className="rounded bg-gold/15 px-2 py-0.5 font-mono text-[10px] font-bold text-gold-light border border-gold/30">
                    LIVE DB SYNC
                  </span>
                </div>
                <p className="text-xs text-muted mt-1">
                  Configure attack parameters, multi-city entities & AI Shield defense. Click Save to enable Live Simulation.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="grid size-8 place-items-center rounded-lg border border-white/10 text-muted transition-colors hover:border-gold/30 hover:bg-white/5 hover:text-ink cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Preset Selector Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Presets:</span>
            {PRESETS.map((p) => {
              const isSelected = preset.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border',
                    isSelected
                      ? 'border-gold bg-gold/25 text-gold-light shadow-xs'
                      : 'border-gold/15 bg-canvas/60 text-muted hover:border-gold/30 hover:text-ink',
                  )}
                >
                  <span>{p.label}</span>
                  <span className="font-mono text-[10px] opacity-75">({p.badge})</span>
                </button>
              );
            })}
          </div>

          {/* Navigation Tabs Bar */}
          <div className="flex items-center gap-2 border-t border-gold/10 pt-2.5">
            <button
              type="button"
              onClick={() => setActiveTab('config')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border',
                activeTab === 'config'
                  ? 'border-gold/50 bg-gold/20 text-gold-light shadow-xs'
                  : 'border-transparent text-muted hover:text-ink hover:bg-white/5',
              )}
            >
              1. Attack Parameters
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('entities')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border',
                activeTab === 'entities'
                  ? 'border-gold/50 bg-gold/20 text-gold-light shadow-xs'
                  : 'border-transparent text-muted hover:text-ink hover:bg-white/5',
              )}
            >
              2. Attack Chain & Entities (5 Nodes)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('policy')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border',
                activeTab === 'policy'
                  ? 'border-gold/50 bg-gold/20 text-gold-light shadow-xs'
                  : 'border-transparent text-muted hover:text-ink hover:bg-white/5',
              )}
            >
              3. AI Shield Containment Policy
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* SCROLLABLE BODY AREA: PROTECTED WITH flex-1 min-h-0               */}
        {/* ================================================================= */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* TAB 1: ATTACK PARAMETERS */}
          {activeTab === 'config' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">
                    Stolen Funds Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full rounded-xl border border-gold/25 bg-[#07110D] px-3.5 py-2.5 text-sm font-mono font-semibold text-ink focus:border-gold focus:outline-none"
                  />
                  <div className="flex gap-1.5 mt-2">
                    {[250000, 500000, 1000000, 2500000].map((quickAmt) => (
                      <button
                        key={quickAmt}
                        type="button"
                        onClick={() => setAmount(quickAmt)}
                        className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-mono font-medium border cursor-pointer',
                          amount === quickAmt
                            ? 'border-gold bg-gold/20 text-gold-light font-bold'
                            : 'border-gold/15 bg-canvas/40 text-muted hover:text-ink',
                        )}
                      >
                        {formatInrCompact(quickAmt)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">
                    Initial Transfer Channel
                  </label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full rounded-xl border border-gold/25 bg-[#07110D] px-3.5 py-2.5 text-sm text-ink focus:border-gold focus:outline-none"
                  >
                    <option value="UPI">UPI (Instant Real-Time)</option>
                    <option value="IMPS">IMPS (Immediate Payment)</option>
                    <option value="NEFT">NEFT (National Electronic Funds)</option>
                    <option value="ATM_WITHDRAWAL">ATM Cash Outflow</option>
                  </select>
                  <span className="block text-[10px] text-muted mt-2">
                    Real-time low-latency payment rails.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">
                    Syndicate Typology Pattern
                  </label>
                  <select
                    value={typology}
                    onChange={(e) => setTypology(e.target.value)}
                    className="w-full rounded-xl border border-gold/25 bg-[#07110D] px-3.5 py-2.5 text-sm text-ink focus:border-gold focus:outline-none"
                  >
                    <option value="circular_flow">Circular Flow (Reinvestment Loop)</option>
                    <option value="rapid_pass_through">Rapid Pass-Through Hub</option>
                    <option value="burst_fanin">Burst Fan-In (Multi-Feeder)</option>
                    <option value="layering_chain">Multi-Hop Layering Chain</option>
                    <option value="dormant_activation">Dormant Activation Conduit</option>
                  </select>
                  <span className="block text-[10px] text-muted mt-2">
                    Synthesizes graph edges and cycle paths.
                  </span>
                </div>
              </div>

              {/* Summary Callout */}
              <div className="rounded-xl border border-gold/15 bg-card/40 p-4">
                <span className="text-xs font-bold text-gold-light uppercase tracking-wider block mb-1">
                  Active Scenario: {preset.label}
                </span>
                <p className="text-xs text-muted leading-relaxed">
                  {preset.description}
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: ATTACK CHAIN & ENTITIES (5 NODES) IN COMPACT RESPONSIVE 2-COLUMN GRID */}
          {activeTab === 'entities' && (
            <div className="space-y-4">
              {/* Visual Pipeline Flow Strip */}
              <div className="rounded-xl border border-gold/15 bg-canvas/70 p-3 overflow-x-auto">
                <div className="flex items-center justify-between min-w-[620px] text-xs">
                  <div className="flex items-center gap-1.5 text-emerald font-semibold">
                    <span className="size-2 rounded-full bg-emerald" />
                    <span>1. Victim ({victim.city})</span>
                  </div>
                  <ArrowRight className="size-3.5 text-muted shrink-0" />
                  <div className="flex items-center gap-1.5 text-danger font-semibold">
                    <span className="size-2 rounded-full bg-danger" />
                    <span>2. Adversary ({hacker.city})</span>
                  </div>
                  <ArrowRight className="size-3.5 text-muted shrink-0" />
                  <div className="flex items-center gap-1.5 text-gold-light font-semibold">
                    <span className="size-2 rounded-full bg-gold-light" />
                    <span>3. Distributor ({distributor.city})</span>
                  </div>
                  <ArrowRight className="size-3.5 text-muted shrink-0" />
                  <div className="flex items-center gap-1.5 text-warning font-semibold">
                    <span className="size-2 rounded-full bg-warning" />
                    <span>4. Mule ({intermediator.city})</span>
                    {blockedTarget === 'intermediator' && (
                      <span className="rounded bg-danger/25 text-danger text-[9px] px-1 font-bold border border-danger/40">FROZEN</span>
                    )}
                  </div>
                  <ArrowRight className="size-3.5 text-muted shrink-0" />
                  <div className="flex items-center gap-1.5 text-muted font-semibold">
                    <span className="size-2 rounded-full bg-muted" />
                    <span>5. Sink ({cashOut.city})</span>
                    {blockedTarget === 'cash_out' && (
                      <span className="rounded bg-danger/25 text-danger text-[9px] px-1 font-bold border border-danger/40">FROZEN</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 2-Column Responsive Grid: Nodes 1 & 2, Nodes 3 & 4, Node 5 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Node 1: Victim */}
                <div className="rounded-xl border border-emerald/25 bg-emerald/5 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald uppercase tracking-wider flex items-center gap-1.5">
                      <span className="grid size-4 place-items-center rounded-full bg-emerald text-[#0B1812] text-[10px] font-mono font-bold">1</span>
                      Victim Account (Compromised)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase text-muted font-bold">City:</span>
                      <select
                        value={victim.city}
                        onChange={(e) => {
                          const c = e.target.value;
                          const geo = CITY_GEO_LOOKUP[c] || { lat: 19.0760, lon: 72.8777 };
                          setVictim({ ...victim, city: c, latitude: geo.lat, longitude: geo.lon });
                        }}
                        className="rounded-md border border-gold/25 bg-[#07110D] px-2 py-0.5 text-xs text-gold-light font-mono focus:border-gold focus:outline-none"
                      >
                        {Object.keys(CITY_GEO_LOOKUP).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] font-semibold uppercase text-muted block mb-1">Holder Name</label>
                      <input
                        value={victim.name}
                        onChange={(e) => setVictim({ ...victim, name: e.target.value })}
                        className="w-full bg-[#07110D] border border-gold/20 rounded-lg px-2.5 py-1.5 text-xs text-ink font-medium focus:border-gold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase text-muted block mb-1">Account ID</label>
                      <input
                        value={victim.account_id}
                        onChange={(e) => setVictim({ ...victim, account_id: e.target.value })}
                        className="w-full bg-[#07110D] border border-gold/20 rounded-lg px-2.5 py-1.5 text-xs text-ink font-mono font-medium focus:border-gold focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-muted/80 pt-1 border-t border-emerald/10 truncate">
                    {victim.device_type} · {victim.ip_address}
                  </div>
                </div>

                {/* Node 2: Hacker */}
                <div className="rounded-xl border border-danger/25 bg-danger/5 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-danger uppercase tracking-wider flex items-center gap-1.5">
                      <span className="grid size-4 place-items-center rounded-full bg-danger text-ink text-[10px] font-mono font-bold">2</span>
                      Adversary / Hacker Account
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase text-muted font-bold">City:</span>
                      <select
                        value={hacker.city}
                        onChange={(e) => {
                          const c = e.target.value;
                          const geo = CITY_GEO_LOOKUP[c] || { lat: 28.6139, lon: 77.2090 };
                          setHacker({ ...hacker, city: c, latitude: geo.lat, longitude: geo.lon });
                        }}
                        className="rounded-md border border-gold/25 bg-[#07110D] px-2 py-0.5 text-xs text-gold-light font-mono focus:border-gold focus:outline-none"
                      >
                        {Object.keys(CITY_GEO_LOOKUP).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] font-semibold uppercase text-muted block mb-1">Handle</label>
                      <input
                        value={hacker.name}
                        onChange={(e) => setHacker({ ...hacker, name: e.target.value })}
                        className="w-full bg-[#07110D] border border-gold/20 rounded-lg px-2.5 py-1.5 text-xs text-ink font-medium focus:border-gold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase text-muted block mb-1">Account ID</label>
                      <input
                        value={hacker.account_id}
                        onChange={(e) => setHacker({ ...hacker, account_id: e.target.value })}
                        className="w-full bg-[#07110D] border border-gold/20 rounded-lg px-2.5 py-1.5 text-xs text-ink font-mono font-medium focus:border-gold focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-muted/80 pt-1 border-t border-danger/10 truncate">
                    {hacker.device_type} · {hacker.ip_address}
                  </div>
                </div>

                {/* Node 3: Distributor */}
                <div className="rounded-xl border border-gold/25 bg-gold/5 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gold-light uppercase tracking-wider flex items-center gap-1.5">
                      <span className="grid size-4 place-items-center rounded-full bg-gold-light text-[#0B1812] text-[10px] font-mono font-bold">3</span>
                      Distributor Account (Layering Hub)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase text-muted font-bold">City:</span>
                      <select
                        value={distributor.city}
                        onChange={(e) => {
                          const c = e.target.value;
                          const geo = CITY_GEO_LOOKUP[c] || { lat: 18.5204, lon: 73.8567 };
                          setDistributor({ ...distributor, city: c, latitude: geo.lat, longitude: geo.lon });
                        }}
                        className="rounded-md border border-gold/25 bg-[#07110D] px-2 py-0.5 text-xs text-gold-light font-mono focus:border-gold focus:outline-none"
                      >
                        {Object.keys(CITY_GEO_LOOKUP).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] font-semibold uppercase text-muted block mb-1">Distributor</label>
                      <input
                        value={distributor.name}
                        onChange={(e) => setDistributor({ ...distributor, name: e.target.value })}
                        className="w-full bg-[#07110D] border border-gold/20 rounded-lg px-2.5 py-1.5 text-xs text-ink font-medium focus:border-gold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase text-muted block mb-1">Account ID</label>
                      <input
                        value={distributor.account_id}
                        onChange={(e) => setDistributor({ ...distributor, account_id: e.target.value })}
                        className="w-full bg-[#07110D] border border-gold/20 rounded-lg px-2.5 py-1.5 text-xs text-ink font-mono font-medium focus:border-gold focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-muted/80 pt-1 border-t border-gold/10 truncate">
                    {distributor.device_type} · {distributor.ip_address}
                  </div>
                </div>

                {/* Node 4: Mule Intermediator */}
                <div className={cn(
                  'rounded-xl border p-3.5 space-y-2.5 transition-all',
                  blockedTarget === 'intermediator'
                    ? 'border-danger/40 bg-danger/10 shadow-xs'
                    : 'border-warning/25 bg-warning/5',
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-warning uppercase tracking-wider flex items-center gap-1.5">
                        <span className="grid size-4 place-items-center rounded-full bg-warning text-[#0B1812] text-[10px] font-mono font-bold">4</span>
                        Intermediator Mule
                      </span>
                      {blockedTarget === 'intermediator' && (
                        <span className="rounded bg-danger/25 text-danger text-[9px] px-1.5 py-0.2 font-bold border border-danger/40">
                          AI SHIELD TARGET
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase text-muted font-bold">City:</span>
                      <select
                        value={intermediator.city}
                        onChange={(e) => {
                          const c = e.target.value;
                          const geo = CITY_GEO_LOOKUP[c] || { lat: 26.4499, lon: 80.3319 };
                          setIntermediator({ ...intermediator, city: c, latitude: geo.lat, longitude: geo.lon });
                        }}
                        className="rounded-md border border-gold/25 bg-[#07110D] px-2 py-0.5 text-xs text-gold-light font-mono focus:border-gold focus:outline-none"
                      >
                        {Object.keys(CITY_GEO_LOOKUP).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] font-semibold uppercase text-muted block mb-1">Mule Name</label>
                      <input
                        value={intermediator.name}
                        onChange={(e) => setIntermediator({ ...intermediator, name: e.target.value })}
                        className="w-full bg-[#07110D] border border-gold/20 rounded-lg px-2.5 py-1.5 text-xs text-ink font-medium focus:border-gold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase text-muted block mb-1">Account ID</label>
                      <input
                        value={intermediator.account_id}
                        onChange={(e) => setIntermediator({ ...intermediator, account_id: e.target.value })}
                        className="w-full bg-[#07110D] border border-gold/20 rounded-lg px-2.5 py-1.5 text-xs text-ink font-mono font-medium focus:border-gold focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-muted/80 pt-1 border-t border-warning/10 truncate">
                    {intermediator.device_type} · {intermediator.ip_address}
                  </div>
                </div>

                {/* Node 5: Cash-Out Sink (Span both columns on md+) */}
                <div className={cn(
                  'md:col-span-2 rounded-xl border p-3.5 space-y-2.5 transition-all',
                  blockedTarget === 'cash_out'
                    ? 'border-danger/40 bg-danger/10 shadow-xs'
                    : 'border-muted/20 bg-canvas/40',
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                        <span className="grid size-4 place-items-center rounded-full bg-muted text-[#0B1812] text-[10px] font-mono font-bold">5</span>
                        Terminal Cash-Out Sink / POS Terminal
                      </span>
                      {blockedTarget === 'cash_out' && (
                        <span className="rounded bg-danger/25 text-danger text-[9px] px-1.5 py-0.2 font-bold border border-danger/40">
                          AI SHIELD TARGET
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase text-muted font-bold">City:</span>
                      <select
                        value={cashOut.city}
                        onChange={(e) => {
                          const c = e.target.value;
                          const geo = CITY_GEO_LOOKUP[c] || { lat: 12.9716, lon: 77.5946 };
                          setCashOut({ ...cashOut, city: c, latitude: geo.lat, longitude: geo.lon });
                        }}
                        className="rounded-md border border-gold/25 bg-[#07110D] px-2 py-0.5 text-xs text-gold-light font-mono focus:border-gold focus:outline-none"
                      >
                        {Object.keys(CITY_GEO_LOOKUP).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] font-semibold uppercase text-muted block mb-1">Terminal / Sink Name</label>
                      <input
                        value={cashOut.name}
                        onChange={(e) => setCashOut({ ...cashOut, name: e.target.value })}
                        className="w-full bg-[#07110D] border border-gold/20 rounded-lg px-2.5 py-1.5 text-xs text-ink font-medium focus:border-gold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase text-muted block mb-1">Terminal ID</label>
                      <input
                        value={cashOut.account_id}
                        onChange={(e) => setCashOut({ ...cashOut, account_id: e.target.value })}
                        className="w-full bg-[#07110D] border border-gold/20 rounded-lg px-2.5 py-1.5 text-xs text-ink font-mono font-medium focus:border-gold focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-muted/80 pt-1 border-t border-gold/10 truncate">
                    {cashOut.device_type} · {cashOut.ip_address}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AUTONOMOUS AI SHIELD POLICY */}
          {activeTab === 'policy' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-gold/20 bg-card/40 p-4">
                <div>
                  <h4 className="text-sm font-bold text-ink">Autonomous AI Shield Threat Containment</h4>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    Trigger automated real-time account freeze when multi-city velocity and ML risk threshold exceed defense boundaries.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                  <input
                    type="checkbox"
                    checked={blockEnabled}
                    onChange={(e) => setBlockEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-canvas/80 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald"></div>
                </label>
              </div>

              {blockEnabled && (
                <div className="space-y-3 rounded-xl border border-gold/15 bg-canvas/40 p-4">
                  <div className="rounded-lg border border-gold/15 bg-canvas/60 p-3 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-gold-light">
                      <Sparkles className="size-3.5 text-gold" />
                      Dynamic Detection Engine & ML Inference Gateway
                    </div>
                    <p className="text-[11px] text-muted leading-relaxed">
                      Extracts 63 behavioral features, evaluates the trained XGBoost model (models/mule_detection_xgboost.pkl), and calculates 1-hop neighborhood contagion. Whichever account breaches the 85.0% risk threshold is quarantined dynamically in real time.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">
                      Quarantine Policy Mode
                    </label>
                    <select
                      value={blockedTarget}
                      onChange={(e) => setBlockedTarget(e.target.value as any)}
                      className="w-full rounded-xl border border-gold/25 bg-[#07110D] px-3.5 py-2 text-xs text-ink focus:border-gold focus:outline-none font-medium"
                    >
                      <option value="auto">⚡ Autonomous ML Engine (Evaluates All Accounts Dynamically)</option>
                      <option value="intermediator">Focus Candidate: Intermediator Mule ({intermediator.account_id} - {intermediator.city})</option>
                      <option value="cash_out">Focus Candidate: Cash-Out Sink ({cashOut.account_id} - {cashOut.city})</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">
                      Reason for Block & Regulatory Rationale
                    </label>
                    <textarea
                      rows={2}
                      value={blockedReason}
                      onChange={(e) => setBlockedReason(e.target.value)}
                      className="w-full rounded-xl border border-gold/25 bg-[#07110D] px-3.5 py-2 text-xs text-ink focus:border-gold focus:outline-none resize-none leading-relaxed"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-xs text-muted pt-2 border-t border-gold/10">
                    <span>Enforcing Actor: <strong className="text-gold-light">TraceMesh AI Shield / Autonomous Detection Engine</strong></span>
                    <span className="text-emerald font-semibold">Protected Funds: ~50% ({formatInrCompact(amount * 0.5)})</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* FIXED FOOTER: ACTIONS                                           */}
        {/* ================================================================= */}
        <div className="shrink-0 flex items-center justify-between border-t border-gold/15 px-5 py-3.5 bg-sidebar/95">
          <div className="flex items-center gap-2 text-xs">
            <span className="size-2 rounded-full bg-emerald animate-pulse" />
            <span className="text-muted font-medium">Attack Scenario Parameters</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-3.5 py-2 text-xs font-semibold text-muted hover:text-ink hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/15 px-4 py-2 text-xs font-bold text-gold-light hover:bg-gold/25 transition-all cursor-pointer shadow-sm"
            >
              {isSavedNotice ? (
                <>
                  <CheckCircle2 className="size-4 text-emerald" />
                  Settings Saved!
                </>
              ) : (
                <>
                  <Check className="size-4 text-emerald" />
                  Save Settings
                </>
              )}
            </button>
            <button
              type="button"
              disabled={isExecutingNow}
              onClick={handleExecuteNow}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald/50 bg-emerald/20 px-4 py-2 text-xs font-bold text-emerald hover:border-emerald hover:bg-emerald/30 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              {isExecutingNow ? (
                <>
                  <span className="size-3.5 border-2 border-emerald border-t-transparent rounded-full animate-spin" />
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <Zap className="size-3.5 fill-current text-emerald" />
                  Save & Simulate Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default SimulationStudioModal;
