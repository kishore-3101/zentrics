import { AlertTriangle, RotateCw } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AccountInspector } from '../features/ring-explorer/components/AccountInspector';
import { SceneContainer } from '../features/ring-explorer/components/canvas/SceneContainer';
import { CityInspector } from '../features/ring-explorer/components/CityInspector';
import { GraphControlsOverlay } from '../features/ring-explorer/components/GraphControlsOverlay';
import { GraphLegend } from '../features/ring-explorer/components/GraphLegend';
import { RingExplorerHeader } from '../features/ring-explorer/components/RingExplorerHeader';
import { RingExplorerSkeleton } from '../features/ring-explorer/components/RingExplorerSkeleton';
import { RingSummaryBar } from '../features/ring-explorer/components/RingSummaryBar';
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
    selectedRoles,
    handleToggleRole,
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

  // 3D Geographic & Camera Preset State
  const [selectedCity, setSelectedCity] = useState<GeoCityCoordinate | null>(null);
  const [cameraPreset, setCameraPreset] = useState<string | null>(null);

  // Compute GeoGraph summary for City Inspector drawer
  const rawGeoGraph = useMemo(() => {
    if (!graph) return null;
    return buildGeoGraph(graph, 4.8);
  }, [graph]);

  // Selected city location object for CityInspector
  const selectedCityLocation = useMemo(() => {
    if (!selectedCity || !rawGeoGraph) return null;
    return rawGeoGraph.locations.find((l) => l.id === selectedCity.id) || null;
  }, [selectedCity, rawGeoGraph]);

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
      {/* 1. Header with Ring ID, Risk Score, Status, Ring Switcher */}
      <RingExplorerHeader graph={graph} />

      {/* 2. Top Bar: Summary KPIs (Total accounts, Victims, Collectors, Mules, Sinks, Volume, At Risk) */}
      <div className="min-w-0">
        <RingSummaryBar graph={graph} />
      </div>

      {/* 3. Integrated 3D Network & Real Geographic Map Command Center */}
      <div className="relative h-[680px] w-full rounded-2xl border border-gold/20 bg-[#030A06] shadow-2xl overflow-hidden min-w-0">
        {/* Top Floating Controls & Corridor Quick-Jumps Overlay */}
        <div className="absolute left-4 right-4 top-4 z-20 flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between pointer-events-auto">
          <div className="flex-1 max-w-2xl">
            <GraphControlsOverlay
              showLabels={showLabels}
              onToggleLabels={() => setShowLabels((prev) => !prev)}
              selectedRoles={selectedRoles}
              onToggleRole={handleToggleRole}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectPreset={handleSelectCameraPreset}
            />
          </div>
          <GraphLegend />
        </div>

        {/* Center 3D WebGL Canvas: Unified Geography + Animated Network Graph */}
        <SceneContainer
          nodes={nodes}
          edges={edges}
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          selectedCity={selectedCity}
          onSelectNode={(node) => {
            setSelectedEdge(null);
            setSelectedNode(node);
          }}
          onSelectEdge={(edge) => {
            setSelectedNode(null);
            setSelectedEdge(edge);
          }}
          onSelectCity={(city) => {
            setSelectedCity(city);
          }}
          showLabels={showLabels}
          activeTxnIds={activeTxnIds}
          speedMultiplier={speed}
          cameraPreset={cameraPreset}
        />

        {/* City Inspector Slide-Out Drawer (when clicking city ground beacon) */}
        <CityInspector
          location={selectedCityLocation}
          onClose={() => setSelectedCity(null)}
          onSelectAccount={(acc: AccountNodeData) => {
            setSelectedNode(acc);
          }}
        />

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

        {/* Bottom-Left Geospatial Provenance Disclaimer */}
        <div className="absolute bottom-20 left-4 z-20 pointer-events-none hidden sm:block max-w-md">
          <div className="rounded-lg border border-gold/20 bg-[#0B1812]/85 px-3 py-1.5 text-[10px] text-muted backdrop-blur-md">
            <span className="text-gold-light font-semibold">3D GIS PROVENANCE: </span>
            Accounts anchored to coordinates above real Indian state boundaries & regional hubs.
          </div>
        </div>
      </div>
    </div>
  );
}
