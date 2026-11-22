import { AlertTriangle, Users } from 'lucide-react';
import { memo, useEffect, useRef, useState, type MouseEvent, type TouchEvent } from 'react';
import type { LoadingAccountNode, LoadingTransactionPath } from '../types';

interface TransactionNetworkFlowProps {
  onNodeClick?: (node: LoadingAccountNode) => void;
  reducedMotion?: boolean;
}

// 11 Key Accounts matching the exact reference image layout:
// 3 Victims (left), 1 Collector (mid-left), 5 Mules (center/layering), 2 Cash-out (right)
const NODES: LoadingAccountNode[] = [
  // Column 1: Victims (x: 140)
  {
    id: 'v1',
    name: 'Victim #4821',
    bank: 'HDFC Bank',
    category: 'victim',
    col: 0,
    x: 140,
    y: 190,
    amount: '₹1,50,000',
    role: 'Deceived Retail Victim (Phishing Scheme)',
    riskScore: 24,
  },
  {
    id: 'v2',
    name: 'Victim #9104',
    bank: 'SBI Retail',
    category: 'victim',
    col: 0,
    x: 140,
    y: 300,
    amount: '₹1,85,000',
    role: 'Deceived Pensioner Account (SIM Swap Fraud)',
    riskScore: 18,
  },
  {
    id: 'v3',
    name: 'Victim #3312',
    bank: 'ICICI Personal',
    category: 'victim',
    col: 0,
    x: 140,
    y: 410,
    amount: '₹1,50,000',
    role: 'Deceived Business Current Account',
    riskScore: 22,
  },

  // Column 2: Collector (x: 350, y: 300)
  {
    id: 'collector',
    name: 'Collector #09',
    bank: 'Kotak Commercial',
    category: 'collector',
    col: 1,
    x: 350,
    y: 300,
    amount: '₹4,85,000',
    role: 'Burst Pooling Node (Fan-In Aggregator)',
    riskScore: 94,
  },

  // Column 3: Mules (Layer 1: x: 500, Layer 2: x: 630, Layer 3: x: 760)
  {
    id: 'm1',
    name: 'Mule Layer-1A',
    bank: 'Axis Corporate',
    category: 'mule',
    col: 2,
    x: 500,
    y: 220,
    amount: '₹2,40,000',
    role: 'Rapid Pass-Through Conduit',
    riskScore: 88,
  },
  {
    id: 'm2',
    name: 'Mule Layer-1B',
    bank: 'Federal Bank',
    category: 'mule',
    col: 2,
    x: 500,
    y: 380,
    amount: '₹2,45,000',
    role: 'Layering Split Account',
    riskScore: 86,
  },
  {
    id: 'm3',
    name: 'Mule Layer-2A',
    bank: 'Yes Bank',
    category: 'mule',
    col: 2,
    x: 630,
    y: 150,
    amount: '₹1,60,000',
    role: 'Structuring Intermediary',
    riskScore: 89,
  },
  {
    id: 'm4',
    name: 'Mule Layer-2B',
    bank: 'IndusInd Bank',
    category: 'mule',
    col: 2,
    x: 630,
    y: 300,
    amount: '₹2,10,000',
    role: 'Cyclic Layering Hub',
    riskScore: 92,
  },
  {
    id: 'm5',
    name: 'Mule Layer-2C',
    bank: 'IDFC First',
    category: 'mule',
    col: 2,
    x: 760,
    y: 220,
    amount: '₹1,95,000',
    role: 'Pre-Exit Consolidator',
    riskScore: 91,
  },
  {
    id: 'm6',
    name: 'Mule Layer-2D',
    bank: 'Canara Digital',
    category: 'mule',
    col: 2,
    x: 760,
    y: 380,
    amount: '₹1,80,000',
    role: 'Pre-Exit Buffer Node',
    riskScore: 87,
  },

  // Column 4: Cash-Out Accounts (x: 960)
  {
    id: 'c1',
    name: 'Cash-out #01',
    bank: 'Crypto Exchange Gateway',
    category: 'cashout',
    col: 3,
    x: 960,
    y: 210,
    amount: '₹2,65,000',
    role: 'Immediate Crypto P2P Off-Ramp',
    riskScore: 99,
  },
  {
    id: 'c2',
    name: 'Cash-out #02',
    bank: 'ATM Fast-Withdrawal Cluster',
    category: 'cashout',
    col: 3,
    x: 960,
    y: 390,
    amount: '₹2,20,000',
    role: 'Smurfed Cash Dispersion Hub',
    riskScore: 98,
  },
];

// Transaction paths connecting the accounts with curvature and flow tokens
const PATHS: LoadingTransactionPath[] = [
  // 1. Victims -> Collector (converging flows)
  { id: 'p-v1-coll', from: 'v1', to: 'collector', curvature: 15, amountToken: '₹' },
  { id: 'p-v2-coll', from: 'v2', to: 'collector', curvature: 0, amountToken: '₹' },
  { id: 'p-v3-coll', from: 'v3', to: 'collector', curvature: -15, amountToken: '₹' },

  // 2. Collector -> Mule Layer 1
  { id: 'p-coll-m1', from: 'collector', to: 'm1', curvature: -25 },
  { id: 'p-coll-m2', from: 'collector', to: 'm2', curvature: 25 },

  // 3. Mule Layer 1 -> Layer 2 (splitting and merging)
  { id: 'p-m1-m3', from: 'm1', to: 'm3', curvature: -20 },
  { id: 'p-m1-m4', from: 'm1', to: 'm4', curvature: 18 },
  { id: 'p-m2-m4', from: 'm2', to: 'm4', curvature: -18 },
  { id: 'p-m2-m6', from: 'm2', to: 'm6', curvature: 20 },

  // 4. Layer 2 -> Layer 3 (cyclical structuring)
  { id: 'p-m3-m5', from: 'm3', to: 'm5', curvature: 15 },
  { id: 'p-m4-m5', from: 'm4', to: 'm5', curvature: -15 },
  { id: 'p-m4-m6', from: 'm4', to: 'm6', curvature: 15, isCycle: true },

  // 5. Layer 3 -> Cash-out accounts
  { id: 'p-m5-c1', from: 'm5', to: 'c1', curvature: -10 },
  { id: 'p-m6-c2', from: 'm6', to: 'c2', curvature: 10 },
];

// Helper to compute cubic Bézier path string between two nodes
function computePathD(src: LoadingAccountNode, dst: LoadingAccountNode, curvature: number = 0): string {
  const dx = dst.x - src.x;
  const dy = dst.y - src.y;

  // Horizontal cubic spline with curvature offset
  const cx1 = src.x + dx * 0.45;
  const cy1 = src.y + dy * 0.15 + curvature;
  const cx2 = src.x + dx * 0.55;
  const cy2 = dst.y - dy * 0.15 + curvature;

  return `M ${src.x} ${src.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${dst.x} ${dst.y}`;
}

export const TransactionNetworkFlow = memo(function TransactionNetworkFlow({
  onNodeClick,
  reducedMotion = false,
}: TransactionNetworkFlowProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredPathId, setHoveredPathId] = useState<string | null>(null);
  const [cashoutFlashes, setCashoutFlashes] = useState<Record<string, boolean>>({});
  const [burstParticles, setBurstParticles] = useState<{ x: number; y: number; id: number }[]>([]);

  const nodeMap = useRef<Map<string, LoadingAccountNode>>(new Map());
  useEffect(() => {
    nodeMap.current.clear();
    NODES.forEach((n) => nodeMap.current.set(n.id, n));
  }, []);

  const activeNodeId = hoveredNodeId || selectedNodeId;

  // Identify connected paths and neighbors of active node
  const { connectedPathIds, connectedNodeIds } = useRef<{
    connectedPathIds: Set<string>;
    connectedNodeIds: Set<string>;
  }>({
    connectedPathIds: new Set(),
    connectedNodeIds: new Set(),
  }).current;

  connectedPathIds.clear();
  connectedNodeIds.clear();

  if (activeNodeId) {
    connectedNodeIds.add(activeNodeId);
    PATHS.forEach((p) => {
      if (p.from === activeNodeId || p.to === activeNodeId) {
        connectedPathIds.add(p.id);
        connectedNodeIds.add(p.from);
        connectedNodeIds.add(p.to);
      }
    });
  }

  // Periodic cash-out flashing animation simulating funds reaching destination
  useEffect(() => {
    if (reducedMotion) return;
    const interval = setInterval(() => {
      setCashoutFlashes({ c1: true, c2: true });
      setTimeout(() => {
        setCashoutFlashes({ c1: false, c2: false });
      }, 700);
    }, 2400);

    return () => clearInterval(interval);
  }, [reducedMotion]);

  // Click / Tap handler
  const handleNodeSelect = (node: LoadingAccountNode, e?: MouseEvent | TouchEvent) => {
    e?.stopPropagation();
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));

    // Spawn micro gold particle burst
    const newBurst = Array.from({ length: 8 }).map((_, i) => ({
      x: node.x + (Math.random() - 0.5) * 40,
      y: node.y + (Math.random() - 0.5) * 40,
      id: Date.now() + i,
    }));
    setBurstParticles(newBurst);
    setTimeout(() => setBurstParticles([]), 600);

    onNodeClick?.(node);
  };

  const activeNodeData = NODES.find((n) => n.id === activeNodeId);

  return (
    <div
      onClick={() => setSelectedNodeId(null)}
      className="relative z-20 flex h-full w-full items-center justify-center p-2 sm:p-4 select-none"
    >
      <div className="relative w-full max-w-5xl aspect-[1100/580] flex items-center justify-center">
        {/* Floating Tooltip */}
        {activeNodeData && (
          <div
            style={{
              left: `${(activeNodeData.x / 1100) * 100}%`,
              top: `${Math.max(8, (activeNodeData.y / 580) * 100 - 18)}%`,
            }}
            className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-full min-w-56 rounded-xl border border-gold/30 bg-card/95 p-3 shadow-2xl backdrop-blur-md text-xs space-y-1 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-gold/15 pb-1">
              <span className="font-mono font-bold text-ink">{activeNodeData.name}</span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                  activeNodeData.category === 'victim'
                    ? 'border border-emerald/40 bg-emerald/10 text-emerald'
                    : activeNodeData.category === 'collector'
                    ? 'border border-gold/40 bg-gold/10 text-gold-light'
                    : activeNodeData.category === 'cashout'
                    ? 'border border-danger/40 bg-danger/10 text-danger'
                    : 'border border-warning/40 bg-warning/10 text-warning'
                }`}
              >
                {activeNodeData.category}
              </span>
            </div>
            <div className="text-[11px] text-muted space-y-0.5">
              <p className="text-ink font-medium">{activeNodeData.bank}</p>
              <p>{activeNodeData.role}</p>
              <div className="flex justify-between pt-1 border-t border-gold/10 text-[10px]">
                <span>Vol: <strong className="text-gold-light font-mono">{activeNodeData.amount}</strong></span>
                <span>Risk: <strong className={activeNodeData.riskScore > 75 ? 'text-danger font-mono' : 'text-emerald font-mono'}>{activeNodeData.riskScore}/100</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* Category Header Pills (Matching exact layout from reference image) */}
        {/* Victim Accounts Label (Top-Left) */}
        <div className="absolute top-[8%] left-[7%] sm:left-[9%] pointer-events-none">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald/50 bg-emerald/15 px-3 py-1 text-xs font-semibold text-emerald shadow-glow-emerald backdrop-blur-xs">
            <Users className="size-3.5" />
            <span>Victim Accounts</span>
          </div>
        </div>

        {/* Collector Label (Below Collector Node) */}
        <div className="absolute top-[67%] left-[29%] sm:left-[31%] pointer-events-none -translate-x-1/2">
          <div className="inline-flex items-center rounded-full border border-gold/50 bg-gold/15 px-3 py-1 text-xs font-semibold text-gold-light shadow-glow-gold backdrop-blur-xs">
            <span>Collector</span>
          </div>
        </div>

        {/* Mule Accounts Label (Below Mules) */}
        <div className="absolute top-[75%] left-[57%] pointer-events-none -translate-x-1/2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-gold/45 bg-gold/15 px-3.5 py-1 text-xs font-semibold text-gold-light shadow-glow-gold backdrop-blur-xs">
            <Users className="size-3.5" />
            <span>Mule Accounts</span>
          </div>
        </div>

        {/* Cash-Out Accounts Label (Below Cash-Out) */}
        <div className="absolute top-[75%] right-[4%] sm:right-[6%] pointer-events-none">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-danger/50 bg-danger/15 px-3 py-1 text-xs font-semibold text-danger shadow-glow-danger backdrop-blur-xs">
            <AlertTriangle className="size-3.5" />
            <span>Cash-out Accounts</span>
          </div>
        </div>

        {/* Interactive SVG Network */}
        <svg
          viewBox="0 0 1100 580"
          className="h-full w-full overflow-visible drop-shadow-[0_0_24px_rgba(0,0,0,0.85)]"
        >
          <defs>
            {/* Glowing Drop Shadows */}
            <filter id="emeraldGlow" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#00C878" floodOpacity="0.8" />
            </filter>
            <filter id="goldGlow" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="#C9A85B" floodOpacity="0.85" />
            </filter>
            <filter id="dangerGlow" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#EF4444" floodOpacity="0.9" />
            </filter>

            {/* Particle Glow Filter */}
            <filter id="particleGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Gold Gradient for Paths */}
            <linearGradient id="goldPathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00C878" stopOpacity="0.6" />
              <stop offset="40%" stopColor="#C9A85B" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#E5C778" stopOpacity="0.95" />
            </linearGradient>

            {/* Gold Marker Arrowhead */}
            <marker
              id="goldArrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#C9A85B" />
            </marker>

            {/* Red Marker Arrowhead for Cash-Out */}
            <marker
              id="redArrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#EF4444" />
            </marker>
          </defs>

          {/* 1. TRANSACTION PATHS */}
          <g className="paths">
            {PATHS.map((path) => {
              const srcNode = nodeMap.current.get(path.from);
              const dstNode = nodeMap.current.get(path.to);
              if (!srcNode || !dstNode) return null;

              const d = computePathD(srcNode, dstNode, path.curvature);
              const isHighlighted =
                hoveredPathId === path.id ||
                connectedPathIds.has(path.id);
              const isDimmed = activeNodeId !== null && !isHighlighted;
              const isCashout = dstNode.category === 'cashout';

              return (
                <g
                  key={path.id}
                  onMouseEnter={() => setHoveredPathId(path.id)}
                  onMouseLeave={() => setHoveredPathId(null)}
                  className="cursor-pointer transition-opacity duration-300"
                  style={{ opacity: isDimmed ? 0.15 : isHighlighted ? 1 : 0.75 }}
                >
                  {/* Outer Glow Path */}
                  <path
                    d={d}
                    fill="none"
                    stroke={isCashout ? '#EF4444' : isHighlighted ? '#FFE6A3' : '#C9A85B'}
                    strokeWidth={isHighlighted ? 4 : 2.5}
                    strokeLinecap="round"
                    strokeDasharray={isCashout ? '6 4' : 'none'}
                    className="transition-all duration-200"
                  />

                  {/* Directional Center Guide */}
                  <path
                    d={d}
                    fill="none"
                    stroke={isCashout ? '#EF4444' : '#FFE6A3'}
                    strokeWidth={1.2}
                    markerEnd={isCashout ? 'url(#redArrow)' : 'url(#goldArrow)'}
                    className="opacity-70"
                  />

                  {/* Flowing Gold Light Particles */}
                  {!reducedMotion && (
                    <>
                      <circle r={isHighlighted ? 4.5 : 3.5} fill="#FFF3D4" filter="url(#particleGlow)">
                        <animateMotion
                          path={d}
                          dur={isHighlighted ? '1.2s' : '2.0s'}
                          repeatCount="indefinite"
                        />
                      </circle>
                      <circle r={isHighlighted ? 3.5 : 2.5} fill="#C9A85B" filter="url(#particleGlow)">
                        <animateMotion
                          path={d}
                          dur={isHighlighted ? '1.2s' : '2.0s'}
                          begin="0.6s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    </>
                  )}

                  {/* Flowing Indian Rupee (₹) Currency Coin Token on Victim -> Collector Paths */}
                  {path.amountToken && !reducedMotion && (
                    <g filter="url(#goldGlow)">
                      <circle r="12" fill="#10251B" stroke="#E5C778" strokeWidth="2" />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#FFE6A3"
                        fontSize="11"
                        fontWeight="bold"
                        fontFamily="system-ui, sans-serif"
                      >
                        ₹
                      </text>
                      <animateMotion
                        path={d}
                        dur="2.4s"
                        repeatCount="indefinite"
                      />
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* 2. ACCOUNT NODES */}
          <g className="nodes">
            {NODES.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isHovered = hoveredNodeId === node.id;
              const isDimmed = activeNodeId !== null && !connectedNodeIds.has(node.id);
              const isCollector = node.category === 'collector';
              const isCashout = node.category === 'cashout';
              const isVictim = node.category === 'victim';

              const size = isCollector ? 72 : 56;
              const halfSize = size / 2;

              // Node theme colors
              const strokeColor = isVictim
                ? '#00C878'
                : isCollector
                ? '#E5C778'
                : isCashout
                ? '#EF4444'
                : '#F59E0B';

              const filterId = isVictim
                ? 'url(#emeraldGlow)'
                : isCashout
                ? 'url(#dangerGlow)'
                : 'url(#goldGlow)';

              const isFlashingRed = isCashout && cashoutFlashes[node.id];

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y}) scale(${isSelected || isHovered ? 1.14 : 1})`}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onClick={(e) => handleNodeSelect(node, e)}
                  className="cursor-pointer transition-all duration-200"
                  style={{
                    opacity: isDimmed ? 0.2 : 1,
                    transformOrigin: `${node.x}px ${node.y}px`,
                  }}
                >
                  {/* Ambient Pulsing Radar Ring on Collector and Cashout */}
                  {(isCollector || isFlashingRed) && (
                    <circle
                      r={size * 0.75}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="1.5"
                      className="animate-ping opacity-35"
                    />
                  )}

                  {/* Node Outer Halo Container */}
                  <rect
                    x={-halfSize}
                    y={-halfSize}
                    width={size}
                    height={size}
                    rx="16"
                    fill={isCashout ? '#1F0A0A' : isCollector ? '#1D1A0D' : '#071A12'}
                    stroke={strokeColor}
                    strokeWidth={isSelected || isHovered ? 3.5 : 2.5}
                    filter={filterId}
                    className="transition-colors duration-200"
                  />

                  {/* Inner Bank Pillars Architecture Icon (Precise match with reference image) */}
                  <g transform={`scale(${isCollector ? 1.25 : 1})`} fill={strokeColor}>
                    {/* Roof Triangle (Pediment) */}
                    <path
                      d="M -15 -5 L 0 -15 L 15 -5 Z"
                      fill={strokeColor}
                    />
                    {/* Horizontal Frieze Bar */}
                    <rect x="-16" y="-5" width="32" height="2.5" rx="0.5" fill={strokeColor} />
                    {/* 4 Architectural Columns */}
                    <rect x="-13" y="-1" width="4" height="12" rx="1" fill={strokeColor} />
                    <rect x="-5" y="-1" width="4" height="12" rx="1" fill={strokeColor} />
                    <rect x="3" y="-1" width="4" height="12" rx="1" fill={strokeColor} />
                    <rect x="11" y="-1" width="4" height="12" rx="1" fill={strokeColor} />
                    {/* Base Pedestal Steps */}
                    <rect x="-17" y="11.5" width="34" height="3" rx="1" fill={strokeColor} />
                  </g>

                  {/* Status Indicator LED Dot (Top-Left of node) */}
                  <circle
                    cx={-halfSize + 9}
                    cy={-halfSize + 9}
                    r="2.5"
                    fill={strokeColor}
                    className="animate-pulse"
                  />

                  {/* Cash-Out Alert Triangle Hazard Badge (Top-Right of cash-out nodes) */}
                  {isCashout && (
                    <g transform={`translate(${halfSize - 6}, ${-halfSize + 6})`}>
                      <circle r="10" fill="#2E0A0A" stroke="#EF4444" strokeWidth="1.8" filter="url(#dangerGlow)" />
                      <path
                        d="M -4 4 L 0 -4 L 4 4 Z"
                        fill="none"
                        stroke="#FFF"
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                      />
                      <circle cx="0" cy="2" r="0.6" fill="#FFF" />
                      <line x1="0" y1="-1.5" x2="0" y2="0.5" stroke="#FFF" strokeWidth="1.2" />
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* Micro Particle Bursts on Node Interaction */}
          {burstParticles.map((bp) => (
            <circle
              key={bp.id}
              cx={bp.x}
              cy={bp.y}
              r="2.5"
              fill="#FFE6A3"
              filter="url(#particleGlow)"
              className="animate-ping opacity-90"
            />
          ))}
        </svg>
      </div>
    </div>
  );
});
