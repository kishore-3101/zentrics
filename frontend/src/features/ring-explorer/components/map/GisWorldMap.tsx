import {
  Box,
  Compass,
  ShieldAlert,
  SkipForward,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  Map,
  Marker,
  type MapLibreInstance,
  type MapLibreMarker,
  type StyleSpecification,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type MapMouseEvent,
} from '../../../../lib/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GeoGraphData, GeoLocationNode, GeoTransactionArc } from '../../types/geo';
import { createCurvedLineCoordinates } from '../../utils/geoData';
import type { AccountNodeData } from '../../../../types/ring-graph';
import { cn } from '../../../../lib/cn';

// 1. Google Maps Default: Full-resolution official roadmap with streets, topology & city networks
export const GOOGLE_MAPS_DEFAULT_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'google-roadmap-base': {
      type: 'raster',
      tiles: [
        'https://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}',
        'https://mt1.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}',
        'https://mt2.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}',
        'https://mt3.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}',
      ],
      tileSize: 256,
      attribution: '© Google Maps',
      maxzoom: 20,
    },
  },
  layers: [
    {
      id: 'google-roadmap-bg',
      type: 'background',
      paint: { 'background-color': '#F4F3F0' },
    },
    {
      id: 'google-roadmap-layer',
      type: 'raster',
      source: 'google-roadmap-base',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

// 2. Google Maps Satellite: High-resolution satellite aerial photography + labels
export const GOOGLE_MAPS_SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'google-hybrid-base': {
      type: 'raster',
      tiles: [
        'https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}',
        'https://mt1.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}',
        'https://mt2.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}',
        'https://mt3.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}',
      ],
      tileSize: 256,
      attribution: '© Google Earth / Google Maps, Maxar Technologies',
      maxzoom: 20,
    },
  },
  layers: [
    {
      id: 'google-satellite-bg',
      type: 'background',
      paint: { 'background-color': '#07110D' },
    },
    {
      id: 'google-hybrid-layer',
      type: 'raster',
      source: 'google-hybrid-base',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

export const GOOGLE_EARTH_HYBRID_STYLE = GOOGLE_MAPS_SATELLITE_STYLE;
export const GOOGLE_EARTH_SATELLITE_STYLE = GOOGLE_MAPS_SATELLITE_STYLE;

export type BasemapMode = 'default' | 'satellite';

export const BASEMAP_CONFIGS: Record<BasemapMode, { style: StyleSpecification; label: string }> = {
  default: { style: GOOGLE_MAPS_DEFAULT_STYLE, label: '🗺️ Default' },
  satellite: { style: GOOGLE_MAPS_SATELLITE_STYLE, label: '🛰️ Satellite' },
};

interface GisWorldMapProps {
  geoGraph: GeoGraphData;
  selectedCity: GeoLocationNode | null;
  selectedArc: GeoTransactionArc | null;
  activeTxnIds: Set<string>;
  reducedMotion?: boolean;
  cameraPreset?: string | null;
  searchQuery?: string;
  filterRole?: 'all' | 'victim' | 'mule' | 'cash_out';
  autoPlaySimulation?: boolean;
  replayTrigger?: number;
  onSelectCity: (loc: GeoLocationNode | null) => void;
  onSelectArc: (arc: GeoTransactionArc | null) => void;
  onSelectAccount?: (acc: AccountNodeData) => void;
}

type PlaybackPhase = 'idle' | 'genesis' | 'hop1' | 'hop2' | 'hop3' | 'hop4' | 'blocked' | 'completed';

interface PrecomputedArc {
  arc: GeoTransactionArc;
  fullCurve: [number, number][];
  color: string;
  isBlocked: boolean;
}

const PHASE_DURATIONS: Record<PlaybackPhase, number> = {
  idle: 0,
  genesis: 1800,
  hop1: 2200,
  hop2: 2200,
  hop3: 2200,
  hop4: 2200,
  blocked: 3800,
  completed: 0,
};

function phaseToHopNum(phase: PlaybackPhase): number {
  if (phase === 'hop1') return 1;
  if (phase === 'hop2') return 2;
  if (phase === 'hop3') return 3;
  if (phase === 'hop4' || phase === 'blocked' || phase === 'completed') return 4;
  return 0;
}

export const GisWorldMap = memo(function GisWorldMap({
  geoGraph,
  selectedCity,
  selectedArc,
  activeTxnIds,
  reducedMotion = false,
  cameraPreset,
  searchQuery = '',
  filterRole = 'all',
  autoPlaySimulation = false,
  replayTrigger,
  onSelectCity,
  onSelectArc,
  onSelectAccount,
}: GisWorldMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreInstance | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const liveAnimFrameRef = useRef<number | null>(null);
  const particleAnimFrameRef = useRef<number | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Imperative refs for 60fps zero-re-render SVG updates
  const svgPathRefs = useRef<Record<string, { casing: SVGPathElement | null; glow: SVGPathElement | null; core: SVGPathElement | null; pulse: SVGPathElement | null; head: SVGGElement | null }>>({});

  const [basemap, setBasemap] = useState<BasemapMode>('default');
  const [is3dPitch, setIs3dPitch] = useState<boolean>(true);
  const [isLiveActive, setIsLiveActive] = useState<boolean>(autoPlaySimulation);
  const [livePhase, setLivePhase] = useState<PlaybackPhase>(autoPlaySimulation ? 'genesis' : 'idle');
  const [hasArrivedCurrentHop, setHasArrivedCurrentHop] = useState<boolean>(false);

  // Precompute Bezier geographic curves ONCE whenever geoGraph changes (instead of 60x per second)
  const precomputedArcs = useMemo<PrecomputedArc[]>(() => {
    const locMap = new globalThis.Map(geoGraph.locations.map((l) => [l.id, l]));
    return [...geoGraph.arcs]
      .sort((a, b) => a.hop_index - b.hop_index)
      .map((arc) => {
        const srcLoc = locMap.get(arc.src_city_id);
        const dstLoc = locMap.get(arc.dst_city_id);
        const srcCoord: [number, number] = srcLoc ? [srcLoc.lon, srcLoc.lat] : [77.2, 28.6];
        const dstCoord: [number, number] = dstLoc ? [dstLoc.lon, dstLoc.lat] : [75.8, 26.9];
        const fullCurve = createCurvedLineCoordinates(srcCoord, dstCoord, 0.16);
        const isBlocked = Boolean(arc.is_blocked);
        const color = isBlocked
          ? '#EF4444'
          : arc.arcType === 'victim'
            ? '#00C878'
            : arc.arcType === 'cash_out'
              ? '#EF4444'
              : arc.color || '#C9A85B';
        return { arc, fullCurve, color, isBlocked };
      });
  }, [geoGraph]);

  const orderedArcs = useMemo(() => precomputedArcs.map((p) => p.arc), [precomputedArcs]);

  const victimLocation = useMemo(() => {
    if (orderedArcs.length === 0) return geoGraph.locations[0] || null;
    return geoGraph.locations.find((l) => l.id === orderedArcs[0].src_city_id) || geoGraph.locations[0] || null;
  }, [orderedArcs, geoGraph]);

  const blockedLocation = useMemo(() => {
    return geoGraph.locations.find((l) => l.isBlocked) || null;
  }, [geoGraph]);

  // Mutable refs to eliminate stale closures inside MapLibre callbacks and rAF loops
  const livePhaseRef = useRef<PlaybackPhase>(livePhase);
  livePhaseRef.current = livePhase;
  const liveProgressRef = useRef<number>(0);
  const isLiveActiveRef = useRef<boolean>(isLiveActive);
  isLiveActiveRef.current = isLiveActive;
  const geoGraphRef = useRef<GeoGraphData>(geoGraph);
  geoGraphRef.current = geoGraph;
  const precomputedArcsRef = useRef<PrecomputedArc[]>(precomputedArcs);
  precomputedArcsRef.current = precomputedArcs;
  const selectedArcRef = useRef<GeoTransactionArc | null>(selectedArc);
  selectedArcRef.current = selectedArc;
  const onSelectCityRef = useRef(onSelectCity);
  onSelectCityRef.current = onSelectCity;
  const onSelectArcRef = useRef(onSelectArc);
  onSelectArcRef.current = onSelectArc;

  // Imperatively updates SVG path `d` attributes and wavefront position at native 60fps with ZERO React re-renders
  const updateSvgDOM = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentPhase = livePhaseRef.current;
    const currentProgress = liveProgressRef.current;
    const isLive = isLiveActiveRef.current && currentPhase !== 'idle' && currentPhase !== 'completed';
    const currentHopNum = phaseToHopNum(currentPhase);
    const arcs = precomputedArcsRef.current;

    for (let i = 0; i < arcs.length; i++) {
      const { arc, fullCurve } = arcs[i];
      const refs = svgPathRefs.current[arc.txn_id];
      if (!refs) continue;

      let points = fullCurve;
      let showArc = true;
      let headCoord: [number, number] | null = null;

      if (isLive) {
        if (arc.hop_index < currentHopNum) {
          points = fullCurve;
        } else if (arc.hop_index === currentHopNum) {
          const sliceCount = Math.max(2, Math.floor(Math.max(0.06, currentProgress) * fullCurve.length));
          points = currentPhase === 'blocked' ? fullCurve : fullCurve.slice(0, sliceCount);
          if (currentPhase !== 'blocked' && points.length > 0) {
            headCoord = points[points.length - 1];
          }
        } else {
          showArc = false;
        }
      }

      if (!showArc || points.length === 0) {
        if (refs.casing) refs.casing.setAttribute('d', '');
        if (refs.glow) refs.glow.setAttribute('d', '');
        if (refs.core) refs.core.setAttribute('d', '');
        if (refs.pulse) refs.pulse.setAttribute('d', '');
        if (refs.head) refs.head.style.display = 'none';
        continue;
      }

      let pathD = '';
      for (let j = 0; j < points.length; j++) {
        const pt = map.project(points[j]);
        pathD += (j === 0 ? 'M ' : ' L ') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1);
      }

      if (refs.casing) refs.casing.setAttribute('d', pathD);
      if (refs.glow) refs.glow.setAttribute('d', pathD);
      if (refs.core) refs.core.setAttribute('d', pathD);
      if (refs.pulse) refs.pulse.setAttribute('d', pathD);

      if (refs.head) {
        if (headCoord) {
          const hPt = map.project(headCoord);
          refs.head.style.display = '';
          refs.head.setAttribute('transform', `translate(${hPt.x.toFixed(1)}, ${hPt.y.toFixed(1)})`);
        } else {
          refs.head.style.display = 'none';
        }
      }
    }
  }, []);

  // Build static/phase-level GeoJSON features cleanly
  const buildRoutesGeoJson = useCallback(() => {
    const arcs = precomputedArcsRef.current;
    const currentSelected = selectedArcRef.current;
    const isLive = isLiveActiveRef.current && livePhaseRef.current !== 'idle' && livePhaseRef.current !== 'completed';
    const currentHopNum = phaseToHopNum(livePhaseRef.current);

    const features: any[] = [];
    for (let i = 0; i < arcs.length; i++) {
      const { arc, fullCurve, color, isBlocked } = arcs[i];
      if (isLive && arc.hop_index > currentHopNum) {
        continue;
      }
      const isLiveBlocked = Boolean(isBlocked || (isLive && livePhaseRef.current === 'blocked' && arc.hop_index === arcs.length));
      features.push({
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: fullCurve,
        },
        properties: {
          txn_id: arc.txn_id,
          amount: arc.amount,
          channel: arc.channel,
          color: isLiveBlocked ? '#EF4444' : color,
          arcType: arc.arcType,
          is_active: activeTxnIds.has(arc.txn_id) || true,
          is_selected: currentSelected?.txn_id === arc.txn_id,
          is_blocked: isLiveBlocked,
          blocked_reason: arc.blocked_reason || null,
          src_city: arc.src_city,
          dst_city: arc.dst_city,
        },
      });
    }
    return { type: 'FeatureCollection' as const, features };
  }, [activeTxnIds]);

  const ensureRouteLayers = useCallback((map: MapLibreInstance) => {
    if (!map || !map.getContainer()) return;
    try {
      const style = map.getStyle();
      if (!style) return;

      const geojson = buildRoutesGeoJson();
      const existingSource = map.getSource('routes-source') as GeoJSONSource | undefined;
      if (!existingSource) {
        map.addSource('routes-source', { type: 'geojson', data: geojson });
      } else {
        existingSource.setData(geojson);
      }

      if (!map.getLayer('routes-casing')) {
        map.addLayer({
          id: 'routes-casing',
          type: 'line',
          source: 'routes-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#020604', 'line-width': 7.0, 'line-opacity': 0.95 },
        });
      }

      if (!map.getLayer('routes-glow')) {
        map.addLayer({
          id: 'routes-glow',
          type: 'line',
          source: 'routes-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': ['coalesce', ['get', 'color'], '#FFD700'],
            'line-width': 12,
            'line-opacity': 0.7,
            'line-blur': 3.5,
          },
        });
      }

      if (!map.getLayer('routes-core')) {
        map.addLayer({
          id: 'routes-core',
          type: 'line',
          source: 'routes-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': ['coalesce', ['get', 'color'], '#FFD700'],
            'line-width': [
              'case',
              ['boolean', ['get', 'is_selected'], false],
              5.5,
              ['boolean', ['get', 'is_active'], false],
              4.5,
              3.5,
            ],
            'line-opacity': 1.0,
          },
        });
      }

      if (!map.getSource('particle-source')) {
        map.addSource('particle-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
      }

      if (!map.getLayer('particle-layer')) {
        map.addLayer({
          id: 'particle-layer',
          type: 'circle',
          source: 'particle-source',
          paint: {
            'circle-radius': 5.0,
            'circle-color': '#FFF8D6',
            'circle-stroke-color': ['coalesce', ['get', 'color'], '#FFD700'],
            'circle-stroke-width': 2.2,
          },
        });
      }
    } catch (err) {
      console.warn('[GisWorldMap] Error ensuring route layers:', err);
    }
  }, [buildRoutesGeoJson]);

  // 1. Initialize MapLibre GL Map ONCE on mount (zero WebGL teardown on ring updates!)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new Map({
      container: mapContainerRef.current,
      style: BASEMAP_CONFIGS.default.style,
      center: [78.9629, 22.5937],
      zoom: 4.5,
      pitch: 48,
      bearing: -10,
      minZoom: 1.5,
      maxZoom: 22,
      attributionControl: false,
    });

    mapRef.current = map;

    const onMapMove = () => {
      updateSvgDOM();
    };

    const onStyleData = () => {
      ensureRouteLayers(map);
      updateSvgDOM();
    };

    map.on('move', onMapMove);
    map.on('styledata', onStyleData);

    map.on('load', () => {
      ensureRouteLayers(map);
      updateSvgDOM();

      map.on('click', 'routes-core', (e: MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return;
        const txnId = e.features[0].properties?.txn_id;
        const arc = geoGraphRef.current.arcs.find((a) => a.txn_id === txnId);
        if (arc) {
          onSelectArcRef.current(arc);
          onSelectCityRef.current(null);
        }
      });

      map.on('mouseenter', 'routes-core', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'routes-core', () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('click', (e: MapMouseEvent) => {
        if (!map.getLayer('routes-core')) return;
        const features = map.queryRenderedFeatures(e.point, { layers: ['routes-core'] });
        if (features.length === 0) {
          onSelectCityRef.current(null);
          onSelectArcRef.current(null);
        }
      });
    });

    map.on('error', (e) => {
      if (e?.error) {
        console.debug('[GisWorldMap] MapLibre event:', e.error);
      }
    });

    window.addEventListener('resize', onMapMove);

    return () => {
      window.removeEventListener('resize', onMapMove);
      map.off('move', onMapMove);
      map.off('styledata', onStyleData);
      map.remove();
      mapRef.current = null;
    };
  }, [ensureRouteLayers, updateSvgDOM]);

  // Trigger or re-trigger live attack playback
  const handleStartReplay = useCallback(() => {
    setIsLiveActive(true);
    isLiveActiveRef.current = true;
    setLivePhase('genesis');
    livePhaseRef.current = 'genesis';
    liveProgressRef.current = 0;
    setHasArrivedCurrentHop(false);
    updateSvgDOM();
  }, [updateSvgDOM]);

  // Trigger live playback cleanly whenever autoPlaySimulation is active for a newly loaded/simulated graph
  useEffect(() => {
    if (autoPlaySimulation) {
      handleStartReplay();
    } else {
      setIsLiveActive(false);
      isLiveActiveRef.current = false;
      setLivePhase('idle');
      livePhaseRef.current = 'idle';
      setHasArrivedCurrentHop(false);
      updateSvgDOM();
    }
  }, [autoPlaySimulation, geoGraph, handleStartReplay, updateSvgDOM]);

  // Handle explicit replay trigger
  useEffect(() => {
    if (replayTrigger && replayTrigger > 0) {
      handleStartReplay();
    }
  }, [replayTrigger, handleStartReplay]);

  // Smooth 60fps Live Video Animation Controller Loop (ZERO per-frame React state updates!)
  useEffect(() => {
    if (!isLiveActive || livePhase === 'idle' || livePhase === 'completed') return;

    let startTime = performance.now();
    let currentPhase: PlaybackPhase = livePhase;
    let arrivalTriggered = false;
    const map = mapRef.current;

    if (currentPhase === 'genesis' && map && victimLocation) {
      map.flyTo({ center: [victimLocation.lon, victimLocation.lat], zoom: 5.8, pitch: 46, duration: 1300 });
    }

    const updateProgressBarWidth = (phase: PlaybackPhase, progress: number) => {
      if (!progressBarRef.current) return;
      const pct =
        phase === 'genesis'
          ? progress * 15
          : phase === 'hop1'
            ? 15 + progress * 20
            : phase === 'hop2'
              ? 35 + progress * 20
              : phase === 'hop3'
                ? 55 + progress * 20
                : phase === 'hop4'
                  ? 75 + progress * 20
                  : 100;
      progressBarRef.current.style.width = `${pct.toFixed(1)}%`;
    };

    const step = (now: number) => {
      const elapsed = now - startTime;
      const totalDuration = PHASE_DURATIONS[currentPhase] || 2200;
      const progress = Math.min(1.0, elapsed / totalDuration);

      liveProgressRef.current = progress;
      updateProgressBarWidth(currentPhase, progress);
      updateSvgDOM();

      if (!arrivalTriggered && progress >= 0.85 && currentPhase.startsWith('hop')) {
        arrivalTriggered = true;
        setHasArrivedCurrentHop(true);
      }

      if (progress >= 1.0) {
        let nextPhase: PlaybackPhase = 'completed';
        if (currentPhase === 'genesis') {
          nextPhase = 'hop1';
          if (map && orderedArcs[0]) {
            const dstLoc = geoGraph.locations.find((l) => l.id === orderedArcs[0].dst_city_id);
            if (dstLoc && victimLocation) {
              map.easeTo({
                center: [(victimLocation.lon + dstLoc.lon) / 2, (victimLocation.lat + dstLoc.lat) / 2],
                zoom: 5.2,
                duration: 1200,
              });
            }
          }
        } else if (currentPhase === 'hop1') {
          nextPhase = orderedArcs.length >= 2 ? 'hop2' : 'blocked';
          if (map && orderedArcs[1]) {
            const dstLoc = geoGraph.locations.find((l) => l.id === orderedArcs[1].dst_city_id);
            if (dstLoc) map.easeTo({ center: [dstLoc.lon, dstLoc.lat], zoom: 5.4, duration: 1200 });
          }
        } else if (currentPhase === 'hop2') {
          nextPhase = orderedArcs.length >= 3 ? 'hop3' : 'blocked';
          if (map && orderedArcs[2]) {
            const dstLoc = geoGraph.locations.find((l) => l.id === orderedArcs[2].dst_city_id);
            if (dstLoc) map.easeTo({ center: [dstLoc.lon, dstLoc.lat], zoom: 5.5, duration: 1200 });
          }
        } else if (currentPhase === 'hop3') {
          nextPhase = orderedArcs.length >= 4 ? 'hop4' : 'blocked';
          if (map && orderedArcs[3]) {
            const dstLoc = geoGraph.locations.find((l) => l.id === orderedArcs[3].dst_city_id);
            if (dstLoc) map.easeTo({ center: [dstLoc.lon, dstLoc.lat], zoom: 5.6, duration: 1200 });
          }
        } else if (currentPhase === 'hop4') {
          nextPhase = 'blocked';
          if (map && blockedLocation) {
            map.flyTo({ center: [blockedLocation.lon, blockedLocation.lat], zoom: 6.8, pitch: 52, duration: 1200 });
          }
        } else if (currentPhase === 'blocked') {
          currentPhase = 'completed';
          livePhaseRef.current = 'completed';
          setLivePhase('completed');
          setIsLiveActive(false);
          isLiveActiveRef.current = false;
          setHasArrivedCurrentHop(true);
          updateSvgDOM();
          if (map) {
            map.flyTo({ center: [78.9629, 22.5937], zoom: 4.6, pitch: 48, duration: 1500 });
          }
          return;
        }

        currentPhase = nextPhase;
        livePhaseRef.current = nextPhase;
        liveProgressRef.current = 0;
        arrivalTriggered = false;
        setHasArrivedCurrentHop(false);
        setLivePhase(nextPhase);
        startTime = now;
        updateSvgDOM();
      }

      liveAnimFrameRef.current = requestAnimationFrame(step);
    };

    liveAnimFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (liveAnimFrameRef.current) cancelAnimationFrame(liveAnimFrameRef.current);
    };
  }, [isLiveActive, livePhase, victimLocation, blockedLocation, orderedArcs, geoGraph, updateSvgDOM]);

  // Basemap Switch
  const handleSelectBasemap = useCallback((mode: BasemapMode) => {
    setBasemap(mode);
    mapRef.current?.setStyle(BASEMAP_CONFIGS[mode].style);
  }, []);

  const toggle3dPitch = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ pitch: is3dPitch ? 0 : 50, duration: 700 });
    setIs3dPitch(!is3dPitch);
  }, [is3dPitch]);

  const handleResetNorth = useCallback(() => {
    mapRef.current?.resetNorthPitch({ duration: 700 });
    setIs3dPitch(false);
  }, []);

  // Sync MapLibre GeoJSON source and SVG positions on graph/phase/selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    ensureRouteLayers(map);
    updateSvgDOM();
  }, [precomputedArcs, livePhase, selectedArc, activeTxnIds, ensureRouteLayers, updateSvgDOM]);

  // Render and sync DOM Markers ONLY when graph, selection, filter, phase, or hop arrival changes (ZERO per-frame churn!)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const currentHopNum = phaseToHopNum(livePhase);

    const visibleLocations = geoGraph.locations.filter((loc) => {
      if (!isLiveActive || livePhase === 'idle' || livePhase === 'completed') {
        if (filterRole === 'all') return true;
        if (filterRole === 'victim') return loc.isVictimHub;
        if (filterRole === 'mule') return loc.isMuleHub || loc.isCollectorHub;
        if (filterRole === 'cash_out') return loc.isCashoutHub;
        return true;
      }

      if (livePhase === 'genesis') {
        return loc.id === victimLocation?.id;
      }
      if (loc.id === victimLocation?.id) return true;
      for (let h = 1; h < currentHopNum; h++) {
        if (orderedArcs[h - 1]?.dst_city_id === loc.id) return true;
      }
      if (
        currentHopNum >= 1 &&
        orderedArcs[currentHopNum - 1]?.dst_city_id === loc.id &&
        (hasArrivedCurrentHop || livePhase === 'blocked')
      ) {
        return true;
      }
      if (livePhase === 'blocked' && loc.isBlocked) return true;
      return false;
    });

    visibleLocations.forEach((loc) => {
      const isSelected = selectedCity?.id === loc.id;
      const isCityActive = geoGraph.arcs.some(
        (a) => activeTxnIds.has(a.txn_id) && (a.src_city_id === loc.id || a.dst_city_id === loc.id),
      );

      const isFrozenNode = isLiveActive
        ? (livePhase === 'blocked' || livePhase === 'completed') && Boolean(loc.isBlocked)
        : Boolean(loc.isBlocked);

      const color = isFrozenNode
        ? '#EF4444'
        : loc.isCollectorHub || loc.isMuleHub
          ? '#C9A85B'
          : '#00C878';

      const el = document.createElement('div');
      el.className = 'group relative flex items-center justify-center cursor-pointer select-none';
      el.innerHTML = `
        <div class="absolute -inset-3 rounded-full border opacity-${
          isFrozenNode ? '95' : isSelected || isCityActive ? '80' : '40'
        } animate-ping pointer-events-none" style="border-color: ${color}; animation-duration: ${isFrozenNode ? '0.9s' : '2.0s'};"></div>
        <div class="size-5 rounded-full border-2 bg-[#07110D] flex items-center justify-center shadow-lg transition-transform group-hover:scale-125" style="border-color: ${color};">
          <div class="size-2 rounded-full" style="background-color: ${color};"></div>
        </div>
        <div class="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-md border border-gold/30 bg-[#0B1812]/90 px-1.5 py-0.5 text-[10px] font-semibold text-ink shadow-md backdrop-blur-xs transition-all whitespace-nowrap group-hover:border-gold group-hover:text-gold-light pointer-events-none ${
          isFrozenNode ? 'border-danger/70 text-danger bg-danger/15 shadow-[0_0_12px_rgba(239,68,68,0.5)]' : isSelected ? 'border-gold text-gold-light shadow-glow-gold' : ''
        }">
          <span class="font-display tracking-tight">${loc.city}</span>
          <span class="font-mono text-[9px] text-muted">(${loc.accounts.length})</span>
          ${isFrozenNode ? '<span class="ml-1 rounded bg-danger/30 text-danger border border-danger/40 px-1 py-0.2 text-[8px] font-bold">FROZEN</span>' : ''}
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectCityRef.current(loc);
        onSelectArcRef.current(null);
        map.flyTo({ center: [loc.lon, loc.lat], zoom: Math.max(map.getZoom(), 7.0), speed: 1.3 });
      });

      const marker = new Marker({ element: el, anchor: 'center' })
        .setLngLat([loc.lon, loc.lat])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [
    geoGraph,
    selectedCity,
    activeTxnIds,
    filterRole,
    isLiveActive,
    livePhase,
    hasArrivedCurrentHop,
    victimLocation,
    orderedArcs,
  ]);

  // Separate throttled WebGL particle loop (30fps with cached curves, zero interference with SVG rAF)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || reducedMotion || isLiveActive) return;

    let progress = 0;
    let lastTick = 0;
    const animateParticles = (now: number) => {
      if (now - lastTick >= 33) {
        lastTick = now;
        progress = (progress + 0.014) % 1;
        if (map.isStyleLoaded() && map.getSource('particle-source')) {
          const arcs = precomputedArcsRef.current;
          const features = arcs.map(({ arc, fullCurve, color }) => {
            const idx = Math.min(fullCurve.length - 1, Math.floor(progress * (fullCurve.length - 1)));
            const pt = fullCurve[idx] || [77.2, 28.6];
            return {
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: pt },
              properties: { color: arc.color || color },
            };
          });
          const source = map.getSource('particle-source') as GeoJSONSource | undefined;
          source?.setData({ type: 'FeatureCollection', features });
        }
      }
      particleAnimFrameRef.current = requestAnimationFrame(animateParticles);
    };

    particleAnimFrameRef.current = requestAnimationFrame(animateParticles);

    return () => {
      if (particleAnimFrameRef.current) cancelAnimationFrame(particleAnimFrameRef.current);
    };
  }, [precomputedArcs, reducedMotion, isLiveActive]);

  // Camera preset handler
  useEffect(() => {
    if (!cameraPreset || !mapRef.current) return;
    const map = mapRef.current;
    switch (cameraPreset) {
      case 'india':
        map.flyTo({ center: [78.9629, 22.5937], zoom: 4.6, pitch: 48, bearing: -10, duration: 1200 });
        break;
      case 'mumbai':
        map.flyTo({ center: [73.3, 18.8], zoom: 7.5, pitch: 55, bearing: -22, duration: 1200 });
        break;
      case 'kolkata':
        map.flyTo({ center: [88.3639, 22.5726], zoom: 7.6, pitch: 50, bearing: 15, duration: 1200 });
        break;
      case 'north':
        map.flyTo({ center: [76.5, 27.7], zoom: 6.5, pitch: 48, bearing: -12, duration: 1200 });
        break;
      case 'dubai':
        map.flyTo({ center: [55.2708, 25.2048], zoom: 6.2, pitch: 50, bearing: -30, duration: 1400 });
        break;
    }
  }, [cameraPreset]);

  // Search and fly to matching city or account
  useEffect(() => {
    if (!searchQuery || !searchQuery.trim() || !mapRef.current) return;
    const term = searchQuery.toLowerCase().trim();
    const match = geoGraph.locations.find(
      (l) =>
        l.city.toLowerCase().includes(term) ||
        l.accounts.some((a) => a.account_id.toLowerCase().includes(term)),
    );
    if (match) {
      onSelectCity(match);
      const matchedAccount = match.accounts.find((a) =>
        a.account_id.toLowerCase().includes(term),
      );
      if (matchedAccount && onSelectAccount) {
        onSelectAccount(matchedAccount);
      }
      mapRef.current.flyTo({ center: [match.lon, match.lat], zoom: 7.8, duration: 1000 });
    }
  }, [searchQuery, geoGraph, onSelectCity, onSelectAccount]);

  const handleSkipToFinal = () => {
    setIsLiveActive(false);
    isLiveActiveRef.current = false;
    setLivePhase('completed');
    livePhaseRef.current = 'completed';
    setHasArrivedCurrentHop(true);
    updateSvgDOM();
    mapRef.current?.flyTo({ center: [78.9629, 22.5937], zoom: 4.6, pitch: 48, duration: 1000 });
  };

  return (
    <div className="relative size-full overflow-hidden bg-[#07110D] select-none">
      {/* 1. Primary MapLibre Container */}
      <div ref={mapContainerRef} className="size-full" />

      {/* 2. High-Visibility Tactical SVG Curved Route Network (Imperatively updated at 60fps via refs) */}
      <svg className="absolute inset-0 pointer-events-none size-full z-10 overflow-visible" aria-hidden="true">
        <defs>
          <filter id="map-edge-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.0" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="map-edge-blocked-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <marker id="arrowhead-gold" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#C9A85B" />
          </marker>
          <marker id="arrowhead-green" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#00C878" />
          </marker>
          <marker id="arrowhead-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#EF4444" />
          </marker>
        </defs>

        {precomputedArcs.map(({ arc, color, isBlocked }) => {
          const isSelected = selectedArc?.txn_id === arc.txn_id;
          const isLive = isLiveActive && livePhase !== 'idle' && livePhase !== 'completed';
          const effectiveBlocked = Boolean(isBlocked || (isLive && livePhase === 'blocked' && arc.hop_index === precomputedArcs.length));
          const strokeWidth = isSelected ? 4.8 : effectiveBlocked ? 3.8 : 3.2;
          const activeColor = effectiveBlocked ? '#EF4444' : color;
          const arrowMarker = effectiveBlocked
            ? 'url(#arrowhead-red)'
            : arc.arcType === 'victim'
              ? 'url(#arrowhead-green)'
              : 'url(#arrowhead-gold)';

          if (!svgPathRefs.current[arc.txn_id]) {
            svgPathRefs.current[arc.txn_id] = { casing: null, glow: null, core: null, pulse: null, head: null };
          }
          const entry = svgPathRefs.current[arc.txn_id];

          return (
            <g key={arc.txn_id}>
              <path
                ref={(el) => { entry.casing = el; }}
                fill="none"
                stroke="#020805"
                strokeWidth={strokeWidth + 4.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.92}
              />
              <path
                ref={(el) => { entry.glow = el; }}
                fill="none"
                stroke={activeColor}
                strokeWidth={strokeWidth + 3.0}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={effectiveBlocked ? 0.75 : 0.45}
                filter={effectiveBlocked ? 'url(#map-edge-blocked-glow)' : 'url(#map-edge-glow)'}
              />
              <path
                ref={(el) => { entry.core = el; }}
                fill="none"
                stroke={activeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.96}
                markerEnd={!isLive ? arrowMarker : undefined}
              />
              <path
                ref={(el) => { entry.pulse = el; }}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={Math.max(1.8, strokeWidth * 0.55)}
                strokeLinecap="round"
                strokeDasharray="6 18"
                opacity={0.85}
              >
                <animate attributeName="stroke-dashoffset" from="0" to="-24" dur="1.2s" repeatCount="indefinite" />
              </path>
              <g ref={(el) => { entry.head = el; }} style={{ display: 'none' }}>
                <circle r="8" fill="none" stroke={activeColor} strokeWidth="1.5" opacity="0.8">
                  <animate attributeName="r" values="4;12;4" dur="0.8s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0.1;0.9" dur="0.8s" repeatCount="indefinite" />
                </circle>
                <circle r="4.5" fill="#FFFFFF" stroke={activeColor} strokeWidth="2" />
              </g>
            </g>
          );
        })}
      </svg>

      {/* 3. Floating Live Attack Video Playback HUD Overlay */}
      {isLiveActive && livePhase !== 'idle' && livePhase !== 'completed' && (
        <div className="absolute top-16 right-4 z-30 max-w-md w-[92%] sm:w-[380px] animate-fadeIn pointer-events-auto">
          <div className="rounded-xl border border-gold/40 bg-[#0B1812]/95 p-3 shadow-2xl backdrop-blur-md space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {livePhase === 'blocked' ? (
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-danger/25 text-danger border border-danger/40 animate-pulse">
                    <ShieldAlert className="size-3.5" />
                  </span>
                ) : (
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-gold/20 text-gold-light border border-gold/40">
                    <Zap className="size-3.5 fill-current" />
                  </span>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-xs font-bold text-ink truncate">
                      {livePhase === 'genesis' && '🔴 LIVE ATTACK STREAMING: Account Compromise'}
                      {livePhase === 'hop1' && '💸 LIVE ATTACK STREAMING: Hop 1 ➔ Adversary Transfer'}
                      {livePhase === 'hop2' && '💸 LIVE ATTACK STREAMING: Hop 2 ➔ Distributor Layering'}
                      {livePhase === 'hop3' && '💸 LIVE ATTACK STREAMING: Hop 3 ➔ Mule Smurfing Fan-Out'}
                      {livePhase === 'hop4' && '🚨 LIVE ATTACK STREAMING: Hop 4 ➔ Cash-Out Extraction Attempt'}
                      {livePhase === 'blocked' && '🛡️ AUTONOMOUS AI SHIELD ENGAGED: Syndicate Quarantined!'}
                    </span>
                    <span className={cn(
                      'shrink-0 rounded px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase tracking-wider border',
                      livePhase === 'blocked' ? 'bg-danger/25 text-danger border-danger/40 animate-pulse' : 'bg-gold/15 text-gold-light border-gold/30'
                    )}>
                      {livePhase === 'blocked' ? 'CONTAINMENT ACTIVE' : 'LIVE STREAM'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted truncate mt-0.5">
                    {livePhase === 'genesis' && `Withdrawing stolen funds from ${victimLocation?.city || 'Victim Account'} via instant rail`}
                    {livePhase === 'hop1' && `Tracing money moving from ${orderedArcs[0]?.src_city} to ${orderedArcs[0]?.dst_city}`}
                    {livePhase === 'hop2' && `Forwarding structured funds from ${orderedArcs[1]?.src_city} to ${orderedArcs[1]?.dst_city}`}
                    {livePhase === 'hop3' && `Layering smurfed funds from ${orderedArcs[2]?.src_city} to ${orderedArcs[2]?.dst_city}`}
                    {livePhase === 'hop4' && `Intercepting terminal extraction from ${orderedArcs[3]?.src_city} to ${orderedArcs[3]?.dst_city}`}
                    {livePhase === 'blocked' && `Cash-out extraction blocked! Syndicate accounts quarantined under PMLA Sec 5. ₹${(geoGraph.arcs[0]?.amount || 500000).toLocaleString('en-IN')} preserved.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSkipToFinal}
                className="shrink-0 flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-muted hover:text-ink hover:bg-white/5 transition-colors cursor-pointer"
              >
                <span>Skip</span>
                <SkipForward className="size-3" />
              </button>
            </div>

            <div className="w-full h-1 bg-canvas/80 rounded-full overflow-hidden border border-gold/15">
              <div
                ref={progressBarRef}
                className={cn(
                  'h-full',
                  livePhase === 'blocked' ? 'bg-danger' : 'bg-gradient-to-r from-gold to-emerald'
                )}
                style={{ width: '0%' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. Basemap Switcher */}
      <div className="absolute bottom-5 left-4 z-20 hidden sm:flex items-center rounded-xl border border-gold/30 bg-[#0B1812]/95 p-1 shadow-md backdrop-blur-md">
        <button
          type="button"
          onClick={() => handleSelectBasemap('default')}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
            basemap === 'default'
              ? 'border border-gold/60 bg-gold/25 text-gold-light shadow-[0_0_8px_rgba(201,168,91,0.3)]'
              : 'border border-transparent text-muted hover:text-ink'
          }`}
        >
          🗺️ Default
        </button>
        <button
          type="button"
          onClick={() => handleSelectBasemap('satellite')}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
            basemap === 'satellite'
              ? 'border border-gold/60 bg-gold/25 text-gold-light shadow-[0_0_8px_rgba(201,168,91,0.3)]'
              : 'border border-transparent text-muted hover:text-ink'
          }`}
        >
          🛰️ Satellite
        </button>
      </div>

      {/* 5. Navigation Controls */}
      <div className="absolute bottom-5 right-4 z-20 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={toggle3dPitch}
          aria-label={is3dPitch ? 'Switch to 2D Top-Down' : 'Switch to 3D Orbit'}
          title={is3dPitch ? '3D Orbit Active (Click for 2D)' : '2D Top-Down Active (Click for 3D)'}
          className={`grid size-8 place-items-center rounded-lg border text-xs font-bold transition-colors shadow-md backdrop-blur-md cursor-pointer ${
            is3dPitch
              ? 'border-gold/60 bg-gold/20 text-gold-light'
              : 'border-gold/25 bg-[#0B1812]/90 text-muted hover:text-ink'
          }`}
        >
          <Box className="size-4" />
        </button>
        <button
          type="button"
          onClick={handleResetNorth}
          aria-label="Reset North"
          title="Reset North Orientation"
          className="grid size-8 place-items-center rounded-lg border border-gold/25 bg-[#0B1812]/90 text-gold-light hover:border-gold/60 hover:bg-gold/15 transition-colors shadow-md backdrop-blur-md cursor-pointer"
        >
          <Compass className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="Zoom in"
          className="grid size-8 place-items-center rounded-lg border border-gold/25 bg-[#0B1812]/90 text-gold-light hover:border-gold/60 hover:bg-gold/15 transition-colors shadow-md backdrop-blur-md cursor-pointer"
        >
          <ZoomIn className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="Zoom out"
          className="grid size-8 place-items-center rounded-lg border border-gold/25 bg-[#0B1812]/90 text-gold-light hover:border-gold/60 hover:bg-gold/15 transition-colors shadow-md backdrop-blur-md cursor-pointer"
        >
          <ZoomOut className="size-4" />
        </button>
      </div>
    </div>
  );
});

export default GisWorldMap;
