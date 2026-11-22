import { Activity, Radio, Shield, Terminal } from 'lucide-react';

export function HudCornerOverlays() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-6 select-none text-[11px] font-mono text-muted/70">
      {/* Top Row */}
      <div className="flex items-start justify-between">
        {/* Top-Left Tactical Readout */}
        <div className="hidden sm:flex flex-col gap-1 rounded-xl border border-gold/15 bg-canvas/40 p-3 backdrop-blur-xs">
          <div className="flex items-center gap-1.5 text-gold-light font-semibold">
            <Radio className="size-3 text-emerald animate-pulse" />
            <span>MULE-NET // CORE v4.18</span>
          </div>
          <div className="text-[10px] space-y-0.5 text-muted">
            <p>GEO: IN-SOUTH-MUMBAI-01</p>
            <p>STREAM: 18,420 TX/MIN</p>
            <p className="text-emerald">SURVEILLANCE: ACTIVE</p>
          </div>
        </div>

        {/* Top-Right Telemetry */}
        <div className="hidden sm:flex flex-col gap-1 rounded-xl border border-gold/15 bg-canvas/40 p-3 backdrop-blur-xs text-right">
          <div className="flex items-center justify-end gap-1.5 text-gold-light font-semibold">
            <span>RING_TOPOLOGY_RADAR</span>
            <Activity className="size-3 text-gold-light" />
          </div>
          <div className="text-[10px] space-y-0.5 text-muted">
            <p>VELOCITY: 48.2 TX/SEC</p>
            <p>ANOMALIES: BURST_DETECTED</p>
            <p className="text-gold-light">MULTI-HOP DEPTH: 4 HOPS</p>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="flex items-end justify-between">
        {/* Bottom-Left Engine State */}
        <div className="hidden md:flex items-center gap-2 rounded-xl border border-emerald/20 bg-canvas/40 px-3 py-1.5 backdrop-blur-xs">
          <Terminal className="size-3.5 text-emerald" />
          <span className="text-[10px] text-muted">
            CORE ENGINE: <strong className="text-emerald font-semibold">ONLINE</strong> &bull; SYNAPSE GRAPH PIPELINE
          </span>
        </div>

        {/* Bottom-Right Compliance Status */}
        <div className="hidden md:flex items-center gap-2 rounded-xl border border-gold/20 bg-canvas/40 px-3 py-1.5 backdrop-blur-xs">
          <Shield className="size-3.5 text-gold-light" />
          <span className="text-[10px] text-muted">
            COMPLIANCE: <strong className="text-gold-light font-semibold">PMLA / RBI CFT COMPLIANT</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
