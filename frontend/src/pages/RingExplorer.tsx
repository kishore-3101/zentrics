import { AlertTriangle, Compass, RotateCw, Search, Tag } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AccountInspector } from '../features/ring-explorer/components/AccountInspector';
import { CityInspector } from '../features/ring-explorer/components/CityInspector';
import { GisWorldMap } from '../features/ring-explorer/components/map/GisWorldMap';
import { RingExplorerHeader } from '../features/ring-explorer/components/RingExplorerHeader';
import { RingExplorerSkeleton } from '../features/ring-explorer/components/RingExplorerSkeleton';
import { RingSummaryBar } from '../features/ring-explorer/components/RingSummaryBar';
import { SceneContainer } from '../features/ring-explorer/components/canvas/SceneContainer';
import { TimelineReplayBar } from '../features/ring-explorer/components/TimelineReplayBar';
import { TransactionInspector } from '../features/ring-explorer/components/TransactionInspector';
import { useRingGraph } from '../features/ring-explorer/hooks/useRingGraph';
import { useTimelineReplay } from '../features/ring-explorer/hooks/useTimelineReplay';
import type { GeoCityCoordinate } from '../features/ring-explorer/types/geo';
import { buildGeoGraph } from '../features/ring-explorer/utils/geoData';
import type { AccountNodeData } from '../types/ring-graph';

export default function RingExplorer() {
  const { id } = useParams<{ id: string }>();
  // Resolve effective ring ID (defaults to R-104 for demo-ring or root entry)
  const effectiveRingId = !id || id === 'demo-ring' ? 'R-104' : id;

  const [viewMode, setViewMode] = useState<'map' | 'canvas'>('map');

  const {
    graph,
    timeline,
    loading,
    error,
    nodes,
    edges,
    selectedNode,
    setSelectedNode,
    selectedEdge,
    setSelectedEdge,
    showLabels,
    setShowLabels,
    searchQuery,
    setSearchQuery,
    reload,
  } = useRingGraph(effectiveRingId);

  const {
    isPlaying,
    speed,
    setSpeed,
    progress,
    play,
    pause,
    restart,
    scrubTo,
    formattedTime,
    runningTotals,
    activeTxnIds,
  } = useTimelineReplay({
    timeline,
    durationMinutes: graph?.duration_min || 34,
  });

  // Filter role state (All, Victims, Mules, Sinks)
  const [filterRole, setFilterRole] = useState<'all' | 'victim' | 'mule' | 'cash_out'>('all');

  // 3D Geographic & Camera Preset State
  const [selectedCity, setSelectedCity] = useState<GeoCityCoordinate | null>(null);
  const [cameraPreset, setCameraPreset] = useState<string | null>(null);

  // Compute GeoGraph summary for City Inspector drawer and Google Earth GIS
  const rawGeoGraph = useMemo(() => {
    if (!graph) return null;
    return buildGeoGraph(graph, 4.8);
  }, [graph]);

  // Selected city location object for CityInspector
  const selectedCityLocation = useMemo(() => {
    if (!selectedCity || !rawGeoGraph) return null;
    return rawGeoGraph.locations.find((l) => l.id === selectedCity.id) || null;
  }, [selectedCity, rawGeoGraph]);

  // Selected Geo Transaction Arc for Google Earth
  const selectedGeoArc = useMemo(() => {
    if (!selectedEdge || !rawGeoGraph) return null;
    return rawGeoGraph.arcs.find((a) => a.txn_id === selectedEdge.txn_id) || null;
  }, [selectedEdge, rawGeoGraph]);

  // Filtered nodes and edges for 3D Cyber Canvas view (from first commit)
  const canvasNodes = useMemo(() => {
    if (filterRole === 'all') return nodes;
    return nodes.filter((n) => n.role === filterRole);
  }, [nodes, filterRole]);

  const canvasEdges = useMemo(() => {
    if (filterRole === 'all') return edges;
    const nodeIds = new Set(canvasNodes.map((n) => n.account_id));
    return edges.filter((e) => nodeIds.has(e.src_account) && nodeIds.has(e.dst_account));
  }, [edges, canvasNodes, filterRole]);

  const handleSelectCameraPreset = useCallback((preset: string) => {
    setSelectedNode(null);
    setCameraPreset(preset);
  }, [setSelectedNode]);

  const handleCloseInspectors = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectedCity(null);
  }, [setSelectedNode, setSelectedEdge]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1440px] space-y-4">
        <RingExplorerSkeleton />
      </div>
    );
  }

  if (error || !graph) {
    return (
      <div className="mx-auto flex h-[500px] w-full max-w-xl flex-col items-center justify-center text-center">
        <AlertTriangle className="size-10 text-danger" />
        <h2 className="mt-3 text-lg font-semibold text-ink">Ring Topology Unavailable</h2>
        <p className="mt-1 text-sm text-muted">{error || 'Could not find the requested ring graph.'}</p>
        <button
          type="button"
          onClick={reload}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-xs font-semibold text-gold-light hover:bg-gold/20"
        >
          <RotateCw className="size-3.5" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4 pb-8 min-w-0">
      {/* 1. Header with Ring ID, Risk Score, Status, Ring Switcher, and Slider (Maps | 3D Canvas) */}
      <RingExplorerHeader
        graph={graph}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* 2. Top Bar: Summary KPIs (Total accounts, Victims, Collectors, Mules, Sinks, Volume, At Risk) */}
      <div className="min-w-0">
        <RingSummaryBar graph={graph} />
      </div>

      {/* 3. Main Network Command Center: Maps or 3D Canvas */}
      <div className="relative h-[700px] w-full rounded-2xl border border-gold/20 bg-[#07110D] shadow-2xl overflow-hidden min-w-0">
        {/* Top Floating Command Bar: Unified, Sleek & Perfectly Aligned */}
        <div className="absolute left-4 right-4 top-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
          {/* Left Cluster: Search & Corridor Quick-Jumps & Role Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative w-56 sm:w-64">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={viewMode === 'map' ? 'Search city or account...' : 'Search account ID...'}
                className="h-8 w-full rounded-xl border border-gold/25 bg-[#0B1812]/95 pl-8 pr-7 text-xs text-ink placeholder:text-muted/60 focus:border-gold/60 focus:outline-none backdrop-blur-md shadow-md"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted hover:text-ink"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Corridor Quick Jumps (Shown in Maps mode) */}
            {viewMode === 'map' && (
              <div className="flex items-center gap-1 rounded-xl border border-gold/20 bg-[#0B1812]/90 p-1 backdrop-blur-md shadow-md">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted px-1.5 flex items-center gap-1">
                  <Compass className="size-3 text-gold-light" /> Corridors:
                </span>
                {[
                  { id: 'overview', label: 'All India' },
                  { id: 'south', label: 'South' },
                  { id: 'mumbai', label: 'Mumbai' },
                  { id: 'kolkata', label: 'Kolkata' },
                  { id: 'north', label: 'Delhi/Jaipur' },
                  { id: 'dubai', label: 'Dubai' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCameraPreset(c.id)}
                    className={`rounded-lg px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                      cameraPreset === c.id
                        ? 'bg-gold/25 text-gold-light font-semibold border border-gold/40'
                        : 'text-muted hover:text-ink border border-transparent hover:bg-gold/10'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {/* Labels Toggle (Shown in 3D Canvas mode) */}
            {viewMode === 'canvas' && (
              <button
                type="button"
                onClick={() => setShowLabels((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-[11px] font-semibold transition-all backdrop-blur-md shadow-md ${
                  showLabels
                    ? 'border-gold/40 bg-gold/20 text-gold-light'
                    : 'border-gold/20 bg-[#0B1812]/90 text-muted hover:text-ink'
                }`}
              >
                <Tag className="size-3" />
                Labels: {showLabels ? 'ON' : 'OFF'}
              </button>
            )}

            {/* Entity Role Filter Pills */}
            <div className="flex items-center gap-1 rounded-xl border border-gold/20 bg-[#0B1812]/90 p-1 backdrop-blur-md shadow-md">
              <button
                type="button"
                onClick={() => setFilterRole('all')}
                className={`rounded-lg px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                  filterRole === 'all'
                    ? 'border border-gold/40 bg-gold/20 text-gold-light font-semibold'
                    : 'border border-transparent text-muted/60 hover:text-muted'
                }`}
              >
                All
              </button>
              {[
                { id: 'victim', label: 'Victims', color: '#00C878' },
                { id: 'mule', label: 'Mules', color: '#F59E0B' },
                { id: 'cash_out', label: 'Sinks', color: '#EF4444' },
              ].map((r) => {
                const active = filterRole === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setFilterRole(r.id as any)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium transition-all ${
                      active
                        ? 'border border-gold/40 bg-gold/20 text-gold-light font-semibold'
                        : 'border border-transparent text-muted/60 hover:text-muted'
                    }`}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: active ? r.color : '#6B7280' }}
                    />
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Sleek Single-Line Legend */}
          <div className="flex items-center gap-3 rounded-xl border border-gold/20 bg-[#0B1812]/90 px-3 py-1.5 backdrop-blur-md shadow-md text-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Legend:
            </span>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="size-2 rounded-full bg-[#00C878] shadow-[0_0_6px_#00C878]" />
              <span className="text-ink/90 font-medium">Inflow (Victim)</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="size-2 rounded-full bg-[#C9A85B] shadow-[0_0_6px_#C9A85B]" />
              <span className="text-ink/90 font-medium">Mule Conduit</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="size-2 rounded-full bg-[#EF4444] shadow-[0_0_6px_#EF4444]" />
              <span className="text-ink/90 font-medium">Cash-out Sink</span>
            </div>
          </div>
        </div>

        {/* Center Display: Maps OR 3D Canvas from first commit */}
        {viewMode === 'map' ? (
          rawGeoGraph && (
            <GisWorldMap
              geoGraph={rawGeoGraph}
              selectedCity={selectedCityLocation}
              selectedArc={selectedGeoArc}
              activeTxnIds={activeTxnIds}
              cameraPreset={cameraPreset}
              searchQuery={searchQuery}
              filterRole={filterRole}
              onSelectCity={(loc) => {
                setSelectedNode(null);
                setSelectedEdge(null);
                setSelectedCity(
                  loc
                    ? {
                        id: loc.id,
                        city: loc.city,
                        lat: loc.lat,
                        lon: loc.lon,
                        country: loc.country,
                        state: loc.state,
                      }
                    : null,
                );
              }}
              onSelectArc={(arc) => {
                setSelectedNode(null);
                setSelectedCity(null);
                if (arc) {
                  const matchingEdge = edges.find((e) => e.txn_id === arc.txn_id) || null;
                  setSelectedEdge(matchingEdge);
                } else {
                  setSelectedEdge(null);
                }
              }}
              onSelectAccount={(acc) => {
                setSelectedEdge(null);
                setSelectedCity(null);
                setSelectedNode(acc);
              }}
            />
          )
        ) : (
          <SceneContainer
            nodes={canvasNodes}
            edges={canvasEdges}
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            onSelectNode={(node) => {
              setSelectedEdge(null);
              setSelectedNode(node);
            }}
            onSelectEdge={(edge) => {
              setSelectedNode(null);
              setSelectedEdge(edge);
            }}
            showLabels={showLabels}
            activeTxnIds={activeTxnIds}
            speedMultiplier={speed}
          />
        )}

        {/* City Inspector Slide-Out Drawer (shown in Maps mode when clicking city beacon) */}
        {viewMode === 'map' && (
          <CityInspector
            location={selectedCityLocation}
            onClose={() => setSelectedCity(null)}
            onSelectAccount={(acc: AccountNodeData) => {
              setSelectedNode(acc);
            }}
          />
        )}

        {/* Account Inspector Slide-out Drawer */}
        <AccountInspector
          account={selectedNode}
          onClose={() => setSelectedNode(null)}
        />

        {/* Transaction Edge Inspector Floating Card */}
        <TransactionInspector
          edge={selectedEdge}
          onClose={handleCloseInspectors}
        />

        {/* Bottom Floating Cinematic Timeline Replay Bar */}
        <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-auto">
          <TimelineReplayBar
            isPlaying={isPlaying}
            speed={speed}
            progress={progress}
            formattedTime={formattedTime}
            runningTotals={runningTotals}
            totalTransactions={edges.length}
            onPlay={play}
            onPause={pause}
            onRestart={restart}
            onScrub={scrubTo}
            onSpeedChange={setSpeed}
          />
        </div>
      </div>
    </div>
  );
}
