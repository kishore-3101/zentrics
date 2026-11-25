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
      maxzoom: 20, // Prevents 404s; MapLibre automatically overzooms tiles smoothly up to zoom 22
    },
  },
  layers: [
    {
      id: 'google-roadmap-bg',
      type: 'background',
      paint: {
        'background-color': '#F4F3F0',
      },
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

// 2. Google Maps Satellite: High-resolution satellite aerial photography + labels, borders & transport networks
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
      maxzoom: 20, // Overzooms seamlessly up to zoom 22 without ever blacking out
    },
  },
  layers: [
    {
      id: 'google-satellite-bg',
      type: 'background',
      paint: {
        'background-color': '#07110D',
      },
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

// Backwards-compatible aliases
export const GOOGLE_EARTH_HYBRID_STYLE = GOOGLE_MAPS_SATELLITE_STYLE;
export const GOOGLE_EARTH_SATELLITE_STYLE = GOOGLE_MAPS_SATELLITE_STYLE;

export type BasemapMode = 'default' | 'satellite';

export const BASEMAP_CONFIGS: Record<BasemapMode, { style: StyleSpecification; label: string }> = {
  default: {
    style: GOOGLE_MAPS_DEFAULT_STYLE,
    label: '🗺️ Default',
  },
  satellite: {
    style: GOOGLE_MAPS_SATELLITE_STYLE,
    label: '🛰️ Satellite',
  },
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
  const animFrameRef = useRef<number | null>(null);

  const [basemap, setBasemap] = useState<BasemapMode>('default');
  const [is3dPitch, setIs3dPitch] = useState<boolean>(true);

  // ---------------------------------------------------------------------------
  // Live Attack Video Playback Engine State
  // ---------------------------------------------------------------------------
  const [isLiveActive, setIsLiveActive] = useState<boolean>(autoPlaySimulation);
  const [livePhase, setLivePhase] = useState<PlaybackPhase>(autoPlaySimulation ? 'genesis' : 'idle');
  const [liveProgress, setLiveProgress] = useState<number>(0); // 0.0 to 1.0 within phase

  // Sort arcs chronologically by hop index (1, 2, 3...)
  const orderedArcs = useMemo(() => {
    return [...geoGraph.arcs].sort((a, b) => a.hop_index - b.hop_index);
  }, [geoGraph]);

  const victimLocation = useMemo(() => {
    if (orderedArcs.length === 0) return geoGraph.locations[0] || null;
    return geoGraph.locations.find((l) => l.id === orderedArcs[0].src_city_id) || geoGraph.locations[0] || null;
  }, [orderedArcs, geoGraph]);

  const blockedLocation = useMemo(() => {
    return geoGraph.locations.find((l) => l.isBlocked) || null;
  }, [geoGraph]);

  // Projected screen SVG curved edges connecting geographic nodes
  const [svgEdges, setSvgEdges] = useState<
    Array<{
      id: string;
      pathD: string;
      color: string;
      strokeWidth: number;
      isBlocked: boolean;
      arc: GeoTransactionArc;
      headPos?: { x: number; y: number };
    }>
  >([]);

  // Keep state refs for animation & camera listener updates without stale closures
  const livePhaseRef = useRef<PlaybackPhase>(livePhase);
  livePhaseRef.current = livePhase;
  const liveProgressRef = useRef<number>(liveProgress);
  liveProgressRef.current = liveProgress;
  const isLiveActiveRef = useRef<boolean>(isLiveActive);
  isLiveActiveRef.current = isLiveActive;
  const geoGraphRef = useRef<GeoGraphData>(geoGraph);
  geoGraphRef.current = geoGraph;
  const selectedArcRef = useRef<GeoTransactionArc | null>(selectedArc);
  selectedArcRef.current = selectedArc;

  // Function to reproject geographic curved lines to screen pixel SVG paths
  const updateSvgEdges = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentLivePhase = livePhaseRef.current;
    const currentLiveProgress = liveProgressRef.current;
    const currentIsLive = isLiveActiveRef.current && currentLivePhase !== 'idle' && currentLivePhase !== 'completed';
    const currentGeoGraph = geoGraphRef.current;
    const currentSelectedArc = selectedArcRef.current;

    const currentHopNum =
      currentLivePhase === 'hop1'
        ? 1
        : currentLivePhase === 'hop2'
          ? 2
          : currentLivePhase === 'hop3'
            ? 3
            : currentLivePhase === 'hop4'
              ? 4
              : currentLivePhase === 'blocked' || currentLivePhase === 'completed'
                ? 4
                : 0;

    const items: Array<{
      id: string;
      pathD: string;
      color: string;
      strokeWidth: number;
      isBlocked: boolean;
      arc: GeoTransactionArc;
      headPos?: { x: number; y: number };
    }> = [];

    currentGeoGraph.arcs.forEach((arc) => {
      const srcLoc = currentGeoGraph.locations.find((l) => l.id === arc.src_city_id);
      const dstLoc = currentGeoGraph.locations.find((l) => l.id === arc.dst_city_id);
      if (!srcLoc || !dstLoc) return;

      const srcCoord: [number, number] = [srcLoc.lon, srcLoc.lat];
      const dstCoord: [number, number] = [dstLoc.lon, dstLoc.lat];
      const fullCurve = createCurvedLineCoordinates(srcCoord, dstCoord, 0.16);

      let curvePoints = fullCurve;
      let headPos: { x: number; y: number } | undefined;

      if (currentIsLive) {
        if (arc.hop_index < currentHopNum) {
          // Previously completed hop: edge stays drawn after transfer
          curvePoints = fullCurve;
        } else if (arc.hop_index === currentHopNum) {
          // Current hop: draws progressively as amount travels
          const sliceCount = Math.max(
            2,
            Math.floor(Math.max(0.06, currentLiveProgress) * fullCurve.length),
          );
          curvePoints = currentLivePhase === 'blocked' ? fullCurve : fullCurve.slice(0, sliceCount);
          const lastPt = curvePoints[curvePoints.length - 1];
          if (lastPt) {
            const projected = map.project([lastPt[0], lastPt[1]]);
            headPos = { x: projected.x, y: projected.y };
          }
        } else {
          // Future hop: DO NOT render until amount is transferred
          return;
        }
      }

      let pathD = '';
      for (let i = 0; i < curvePoints.length; i++) {
        const pt = map.project([curvePoints[i][0], curvePoints[i][1]]);
        pathD += (i === 0 ? 'M ' : ' L ') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1);
      }

      const isBlocked = Boolean(
        arc.is_blocked || (currentIsLive && currentLivePhase === 'blocked' && arc.hop_index === 4),
      );

      const color = isBlocked
        ? '#EF4444'
        : arc.arcType === 'victim'
          ? '#00C878'
          : arc.arcType === 'cash_out'
            ? '#EF4444'
            : arc.color || '#C9A85B';

      const isSelected = currentSelectedArc?.txn_id === arc.txn_id;

      items.push({
        id: arc.txn_id,
        pathD,
        color,
        strokeWidth: isSelected ? 4.8 : isBlocked ? 3.8 : 3.2,
        isBlocked,
        arc,
        headPos,
      });
    });

    setSvgEdges(items);
  }, []);

  // Handle re-triggering simulation video playback
  const handleStartReplay = useCallback(() => {
    setIsLiveActive(true);
    isLiveActiveRef.current = true;
    setLivePhase('genesis');
    livePhaseRef.current = 'genesis';
    setLiveProgress(0);
    liveProgressRef.current = 0;
    updateSvgEdges();
  }, [updateSvgEdges]);

  // Trigger auto-play if prop changes
  useEffect(() => {
    if (autoPlaySimulation) {
      handleStartReplay();
    }
  }, [autoPlaySimulation, handleStartReplay]);

  // Handle external replay trigger from header command bar
  useEffect(() => {
    if (replayTrigger && replayTrigger > 0) {
      handleStartReplay();
    }
  }, [replayTrigger, handleStartReplay]);

  // ---------------------------------------------------------------------------
  // Live Video Animation Controller Loop
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isLiveActive || livePhase === 'idle' || livePhase === 'completed') return;

    let startTime = performance.now();
    let currentPhase: PlaybackPhase = livePhase;

    // Phase durations in milliseconds
    const DURATIONS: Record<PlaybackPhase, number> = {
      idle: 0,
      genesis: 2200,   // Withdrawal pulse at victim account
      hop1: 2800,      // Line draws & money travels from Victim to Adversary
      hop2: 2800,      // Line draws & money travels from Adversary to Distributor
      hop3: 2800,      // Line draws & money travels towards Mule Intermediator
      hop4: 2800,      // Line draws & money travels towards Terminal Cash-Out
      blocked: 4200,   // AI Shield Containment Triggered! Target account frozen
      completed: 0,
    };

    const map = mapRef.current;

    // Initial camera movement when genesis starts
    if (currentPhase === 'genesis' && map && victimLocation) {
      map.flyTo({
        center: [victimLocation.lon, victimLocation.lat],
        zoom: 6.0,
        pitch: 46,
        duration: 1600,
      });
    }

    const step = (now: number) => {
      const elapsed = now - startTime;
      const totalDuration = DURATIONS[currentPhase] || 2500;
      const progress = Math.min(1.0, elapsed / totalDuration);
      setLiveProgress(progress);
      liveProgressRef.current = progress;
      updateSvgEdges();

      if (progress >= 1.0) {
        // Transition to next phase
        if (currentPhase === 'genesis') {
          currentPhase = 'hop1';
          setLivePhase('hop1');
          livePhaseRef.current = 'hop1';
          startTime = now;
          updateSvgEdges();
          if (map && orderedArcs[0]) {
            const dstLoc = geoGraph.locations.find((l) => l.id === orderedArcs[0].dst_city_id);
            if (dstLoc && victimLocation) {
              map.easeTo({
                center: [(victimLocation.lon + dstLoc.lon) / 2, (victimLocation.lat + dstLoc.lat) / 2],
                zoom: 5.2,
                duration: 1500,
              });
            }
          }
        } else if (currentPhase === 'hop1') {
          currentPhase = 'hop2';
          setLivePhase('hop2');
          livePhaseRef.current = 'hop2';
          startTime = now;
          updateSvgEdges();
          if (map && orderedArcs[1]) {
            const dstLoc = geoGraph.locations.find((l) => l.id === orderedArcs[1].dst_city_id);
            if (dstLoc) {
              map.easeTo({ center: [dstLoc.lon, dstLoc.lat], zoom: 5.4, duration: 1500 });
            }
          }
        } else if (currentPhase === 'hop2') {
          currentPhase = 'hop3';
          setLivePhase('hop3');
          livePhaseRef.current = 'hop3';
          startTime = now;
          updateSvgEdges();
          if (map && orderedArcs[2]) {
            const dstLoc = geoGraph.locations.find((l) => l.id === orderedArcs[2].dst_city_id);
            if (dstLoc) {
              map.easeTo({ center: [dstLoc.lon, dstLoc.lat], zoom: 5.5, duration: 1500 });
            }
          }
        } else if (currentPhase === 'hop3') {
          currentPhase = 'hop4';
          setLivePhase('hop4');
          livePhaseRef.current = 'hop4';
          startTime = now;
          updateSvgEdges();
          if (map && orderedArcs[3]) {
            const dstLoc = geoGraph.locations.find((l) => l.id === orderedArcs[3].dst_city_id);
            if (dstLoc) {
              map.easeTo({ center: [dstLoc.lon, dstLoc.lat], zoom: 5.6, duration: 1500 });
            }
          }
        } else if (currentPhase === 'hop4') {
          currentPhase = 'blocked';
          setLivePhase('blocked');
          livePhaseRef.current = 'blocked';
          startTime = now;
          updateSvgEdges();
          if (map && blockedLocation) {
            // Zoom right into the frozen target
            map.flyTo({
              center: [blockedLocation.lon, blockedLocation.lat],
              zoom: 7.2,
              pitch: 52,
              duration: 1400,
            });
          }
        } else if (currentPhase === 'blocked') {
          currentPhase = 'completed';
          setLivePhase('completed');
          livePhaseRef.current = 'completed';
          setIsLiveActive(false);
          isLiveActiveRef.current = false;
          updateSvgEdges();
          // Pull camera back to full view of network
          if (map) {
            map.flyTo({
              center: [78.9629, 22.5937],
              zoom: 4.6,
              pitch: 48,
              duration: 1800,
            });
          }
          return;
        }
      }

      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isLiveActive, livePhase, victimLocation, blockedLocation, orderedArcs, geoGraph, updateSvgEdges]);

  // Compute curved GeoJSON routes with live progressive drawing
  const routesGeoJson = useMemo(() => {
    // If NOT in live playback, render all arcs normally
    if (!isLiveActive || livePhase === 'idle' || livePhase === 'completed') {
      const features = geoGraph.arcs.map((arc) => {
        const srcLoc = geoGraph.locations.find((l) => l.id === arc.src_city_id);
        const dstLoc = geoGraph.locations.find((l) => l.id === arc.dst_city_id);

        const srcCoord: [number, number] = srcLoc ? [srcLoc.lon, srcLoc.lat] : [77.2, 28.6];
        const dstCoord: [number, number] = dstLoc ? [dstLoc.lon, dstLoc.lat] : [75.8, 26.9];

        const curvedCoords = createCurvedLineCoordinates(srcCoord, dstCoord, 0.16);

        return {
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: curvedCoords,
          },
          properties: {
            txn_id: arc.txn_id,
            amount: arc.amount,
            channel: arc.channel,
            color: arc.is_blocked ? '#EF4444' : (arc.color || '#C9A85B'),
            arcType: arc.arcType,
            is_active: activeTxnIds.has(arc.txn_id) || true,
            is_selected: selectedArc?.txn_id === arc.txn_id,
            is_blocked: Boolean(arc.is_blocked),
            blocked_reason: arc.blocked_reason || null,
            src_city: arc.src_city,
            dst_city: arc.dst_city,
          },
        };
      });

      return { type: 'FeatureCollection' as const, features };
    }

    // LIVE PLAYBACK MODE: Draw lines progressively as money travels!
    const features: any[] = [];
    const currentHopNum =
      livePhase === 'hop1'
        ? 1
        : livePhase === 'hop2'
          ? 2
          : livePhase === 'hop3'
            ? 3
            : livePhase === 'hop4'
              ? 4
              : livePhase === 'blocked'
                ? 4
                : 0;

    orderedArcs.forEach((arc) => {
      const srcLoc = geoGraph.locations.find((l) => l.id === arc.src_city_id);
      const dstLoc = geoGraph.locations.find((l) => l.id === arc.dst_city_id);
      const srcCoord: [number, number] = srcLoc ? [srcLoc.lon, srcLoc.lat] : [77.2, 28.6];
      const dstCoord: [number, number] = dstLoc ? [dstLoc.lon, dstLoc.lat] : [75.8, 26.9];

      const fullCurve = createCurvedLineCoordinates(srcCoord, dstCoord, 0.16);

      if (arc.hop_index < currentHopNum) {
        // Already fully traversed hop: draw entire curve
        features.push({
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: fullCurve },
          properties: {
            txn_id: arc.txn_id,
            amount: arc.amount,
            color: arc.is_blocked ? '#EF4444' : (arc.color || '#C9A85B'),
            is_active: true,
            is_blocked: Boolean(arc.is_blocked),
            blocked_reason: arc.blocked_reason || null,
            src_city: arc.src_city,
            dst_city: arc.dst_city,
          },
        });
      } else if (arc.hop_index === currentHopNum) {
        // Currently traveling hop: draw sliced curve up to liveProgress!
        // Guarantee at least 2 points for a valid LineString
        const sliceCount = Math.max(2, Math.floor(Math.max(0.06, liveProgress) * fullCurve.length));
        const partialCoords = livePhase === 'blocked' ? fullCurve : fullCurve.slice(0, sliceCount);
        const isBlockedHop = Boolean(
          arc.is_blocked || (livePhase === 'blocked' && arc.hop_index === 4)
        );
        features.push({
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: partialCoords },
          properties: {
            txn_id: arc.txn_id,
            amount: arc.amount,
            color: isBlockedHop ? '#EF4444' : (arc.color || '#00C878'),
            is_active: true,
            is_blocked: isBlockedHop,
            blocked_reason: arc.blocked_reason || null,
            src_city: arc.src_city,
            dst_city: arc.dst_city,
          },
        });
      }
      // Future hops are not shown until the amount is actually transferred
    });

    return { type: 'FeatureCollection' as const, features };
  }, [geoGraph, activeTxnIds, selectedArc, isLiveActive, livePhase, liveProgress, orderedArcs]);

  // Keep a ref to latest routes GeoJSON to prevent closure race conditions
  const routesGeoJsonRef = useRef(routesGeoJson);
  routesGeoJsonRef.current = routesGeoJson;

  // Unified, idempotent helper to guarantee routes source & layers exist on current style
  const ensureRouteLayers = useCallback((map: MapLibreInstance) => {
    if (!map || !map.getContainer()) return;

    try {
      const style = map.getStyle();
      if (!style) return;

      const existingSource = map.getSource('routes-source') as GeoJSONSource | undefined;
      if (!existingSource) {
        map.addSource('routes-source', {
          type: 'geojson',
          data: routesGeoJsonRef.current,
        });
      } else {
        existingSource.setData(routesGeoJsonRef.current);
      }

      // Layer 1: Dark Casing for high contrast over satellite landmasses and dark canvas
      if (!map.getLayer('routes-casing')) {
        map.addLayer({
          id: 'routes-casing',
          type: 'line',
          source: 'routes-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#020604',
            'line-width': 7.0,
            'line-opacity': 0.95,
          },
        });
      }

      // Layer 2: Glowing Translucent Glow under routes
      if (!map.getLayer('routes-glow')) {
        map.addLayer({
          id: 'routes-glow',
          type: 'line',
          source: 'routes-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': ['coalesce', ['get', 'color'], '#FFD700'],
            'line-width': 12,
            'line-opacity': 0.70,
            'line-blur': 3.5,
          },
        });
      }

      // Layer 3: Sharp Main Transaction Core Line
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
            'line-opacity': [
              'case',
              ['boolean', ['get', 'is_active'], false],
              1.0,
              0.95,
            ],
          },
        });
      }

      // Animated Particles Layer
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
  }, []);

  // 1. Initialize MapLibre GL Map with Google Maps Default Style & 3D oblique tilt
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new Map({
      container: mapContainerRef.current,
      style: BASEMAP_CONFIGS[basemap].style,
      center: [78.9629, 22.5937], // Centered on India
      zoom: 4.5,
      pitch: 48, // Authentic 3D oblique tilt
      bearing: -10,
      minZoom: 1.5,
      maxZoom: 22, // Full zoom down to street level without blacking out
      attributionControl: false,
    });

    mapRef.current = map;

    // Listen on map camera movement and re-sync SVG route paths
    const onMapChange = () => {
      updateSvgEdges();
    };

    map.on('move', onMapChange);
    map.on('zoom', onMapChange);
    map.on('pitch', onMapChange);
    map.on('rotate', onMapChange);
    map.on('render', onMapChange);

    // Listen on styledata to re-establish layers whenever a style completes loading
    const onStyleData = () => {
      ensureRouteLayers(map);
      updateSvgEdges();
    };

    map.on('styledata', onStyleData);
    map.on('idle', onStyleData);

    map.on('load', () => {
      ensureRouteLayers(map);
      updateSvgEdges();

      // Click on route to inspect transaction
      map.on('click', 'routes-core', (e: MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const txnId = feature.properties?.txn_id;
        const arc = geoGraph.arcs.find((a) => a.txn_id === txnId);
        if (arc) {
          onSelectArc(arc);
          onSelectCity(null);
        }
      });

      map.on('mouseenter', 'routes-core', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'routes-core', () => {
        map.getCanvas().style.cursor = '';
      });

      // Click background to deselect
      map.on('click', (e: MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['routes-core'] });
        if (features.length === 0) {
          onSelectCity(null);
          onSelectArc(null);
        }
      });
    });

    // Handle non-fatal MapLibre events without switching basemap or blacking out
    map.on('error', (e) => {
      if (e?.error) {
        console.debug('[GisWorldMap] MapLibre warning/error:', e.error);
      }
    });

    window.addEventListener('resize', onMapChange);

    return () => {
      window.removeEventListener('resize', onMapChange);
      map.off('move', onMapChange);
      map.off('zoom', onMapChange);
      map.off('pitch', onMapChange);
      map.off('rotate', onMapChange);
      map.off('render', onMapChange);
      map.remove();
      mapRef.current = null;
    };
  }, [geoGraph, onSelectArc, onSelectCity, ensureRouteLayers, updateSvgEdges]);

  // Handle Basemap Switch
  const handleSelectBasemap = useCallback(
    (mode: BasemapMode) => {
      setBasemap(mode);
      const map = mapRef.current;
      if (!map) return;
      const config = BASEMAP_CONFIGS[mode];
      map.setStyle(config.style);
    },
    [],
  );

  const toggle3dPitch = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const nextPitch = is3dPitch ? 0 : 50;
    map.easeTo({ pitch: nextPitch, duration: 800 });
    setIs3dPitch(!is3dPitch);
  }, [is3dPitch]);

  const handleResetNorth = useCallback(() => {
    mapRef.current?.resetNorthPitch({ duration: 800 });
    setIs3dPitch(false);
  }, []);

  // Update routes source when geoGraph, activeTxnIds or liveProgress changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    ensureRouteLayers(map);
    updateSvgEdges();
  }, [routesGeoJson, ensureRouteLayers, updateSvgEdges]);

  // Render and sync DOM Markers for Cities (supports progressive live appearance)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Filter locations to show
    const currentHopNum =
      livePhase === 'hop1'
        ? 1
        : livePhase === 'hop2'
          ? 2
          : livePhase === 'hop3'
            ? 3
            : livePhase === 'hop4'
              ? 4
              : livePhase === 'blocked' || livePhase === 'completed'
                ? 4
                : 0;

    const visibleLocations = geoGraph.locations.filter((loc) => {
      if (!isLiveActive || livePhase === 'idle' || livePhase === 'completed') {
        if (filterRole === 'all') return true;
        if (filterRole === 'victim') return loc.isVictimHub;
        if (filterRole === 'mule') return loc.isMuleHub || loc.isCollectorHub;
        if (filterRole === 'cash_out') return loc.isCashoutHub;
        return true;
      }

      // LIVE PLAYBACK PROGRESSIVE VISIBILITY:
      if (livePhase === 'genesis') {
        return loc.id === victimLocation?.id;
      }
      if (currentHopNum === 1) {
        // Victim visible, Adversary visible as money arrives
        if (loc.id === victimLocation?.id) return true;
        if (loc.id === orderedArcs[0]?.dst_city_id && liveProgress >= 0.85) return true;
        return false;
      }
      if (currentHopNum === 2) {
        if (loc.id === victimLocation?.id) return true;
        if (loc.id === orderedArcs[0]?.dst_city_id) return true;
        if (loc.id === orderedArcs[1]?.dst_city_id && liveProgress >= 0.85) return true;
        return false;
      }
      if (currentHopNum === 3) {
        if (loc.id === victimLocation?.id) return true;
        if (loc.id === orderedArcs[0]?.dst_city_id) return true;
        if (loc.id === orderedArcs[1]?.dst_city_id) return true;
        if (loc.id === orderedArcs[2]?.dst_city_id && liveProgress >= 0.85) return true;
        return false;
      }
      if (currentHopNum >= 4 || livePhase === 'blocked') {
        if (loc.id === victimLocation?.id) return true;
        if (loc.id === orderedArcs[0]?.dst_city_id) return true;
        if (loc.id === orderedArcs[1]?.dst_city_id) return true;
        if (loc.id === orderedArcs[2]?.dst_city_id) return true;
        if (loc.id === orderedArcs[3]?.dst_city_id && (liveProgress >= 0.85 || livePhase === 'blocked')) return true;
        return false;
      }

      return true;
    });

    visibleLocations.forEach((loc) => {
      const isSelected = selectedCity?.id === loc.id;
      const isCityActive = geoGraph.arcs.some(
        (a) =>
          activeTxnIds.has(a.txn_id) &&
          (a.src_city_id === loc.id || a.dst_city_id === loc.id),
      );

      // FROZEN status should ONLY be displayed after edge travel completes (in blocked/completed phase)!
      const isFrozenNode = isLiveActive
        ? (livePhase === 'blocked' || livePhase === 'completed') && Boolean(loc.isBlocked)
        : Boolean(loc.isBlocked);

      // Dominant color (Red if frozen/blocked or cashout)
      const color = isFrozenNode
        ? '#EF4444' // Red / Alert
        : loc.isCollectorHub || loc.isMuleHub
          ? '#C9A85B' // Gold
          : '#00C878'; // Emerald

      // Create Custom Tactical Marker DOM element centered exactly on geographic [lon, lat]
      const el = document.createElement('div');
      el.className = 'group relative flex items-center justify-center cursor-pointer select-none';

      // HTML structure: center dot is pinned at (lon, lat) with anchor: 'center'
      el.innerHTML = `
        <!-- Outer pulse ring -->
        <div class="absolute -inset-3 rounded-full border border-[${color}] opacity-${
          isFrozenNode ? '95' : isSelected || isCityActive ? '80' : '40'
        } animate-ping pointer-events-none" style="border-color: ${color}; animation-duration: ${isFrozenNode ? '0.9s' : '2.0s'};"></div>
        <!-- Center node circle (matches 3D canvas node) -->
        <div class="size-5 rounded-full border-2 bg-[#07110D] flex items-center justify-center shadow-lg transition-transform group-hover:scale-125" style="border-color: ${color};">
          <div class="size-2 rounded-full" style="background-color: ${color};"></div>
        </div>
        <!-- City Label Card positioned cleanly below the node -->
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
        onSelectCity(loc);
        onSelectArc(null);

        map.flyTo({
          center: [loc.lon, loc.lat],
          zoom: Math.max(map.getZoom(), 7.2),
          speed: 1.2,
          curve: 1.42,
        });
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
    liveProgress,
    victimLocation,
    blockedLocation,
    orderedArcs,
    onSelectCity,
    onSelectArc,
  ]);

  // Traveling Money Particle Loop
  useEffect(() => {
    const map = mapRef.current;
    if (!map || reducedMotion) return;

    if (isLiveActive && livePhase !== 'idle' && livePhase !== 'completed') {
      // In live mode: Place single particle at the tip of the current active drawing hop!
      const currentHopNum =
        livePhase === 'hop1'
          ? 1
          : livePhase === 'hop2'
            ? 2
            : livePhase === 'hop3'
              ? 3
              : livePhase === 'hop4'
                ? 4
                : 0;
      const activeArc = orderedArcs.find((a) => a.hop_index === currentHopNum);

      if (activeArc && map.isStyleLoaded() && map.getSource('particle-source')) {
        const srcLoc = geoGraph.locations.find((l) => l.id === activeArc.src_city_id);
        const dstLoc = geoGraph.locations.find((l) => l.id === activeArc.dst_city_id);
        const srcCoord: [number, number] = srcLoc ? [srcLoc.lon, srcLoc.lat] : [77.2, 28.6];
        const dstCoord: [number, number] = dstLoc ? [dstLoc.lon, dstLoc.lat] : [75.8, 26.9];

        const curve = createCurvedLineCoordinates(srcCoord, dstCoord, 0.16);
        const idx = Math.min(curve.length - 1, Math.floor(liveProgress * (curve.length - 1)));
        const pt = curve[idx] || srcCoord;

        const source = map.getSource('particle-source') as GeoJSONSource | undefined;
        source?.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: pt },
              properties: { color: '#FFD700' }, // Brilliant Gold particle
            },
          ],
        });
      }
      return;
    }

    // Static / Replay mode: normal particles loop
    let progress = 0;
    const animateParticles = () => {
      progress = (progress + 0.008) % 1;

      if (map.isStyleLoaded() && map.getSource('particle-source')) {
        const particleFeatures = geoGraph.arcs.map((arc) => {
          const srcLoc = geoGraph.locations.find((l) => l.id === arc.src_city_id);
          const dstLoc = geoGraph.locations.find((l) => l.id === arc.dst_city_id);
          const srcCoord: [number, number] = srcLoc ? [srcLoc.lon, srcLoc.lat] : [77.2, 28.6];
          const dstCoord: [number, number] = dstLoc ? [dstLoc.lon, dstLoc.lat] : [75.8, 26.9];

          const curve = createCurvedLineCoordinates(srcCoord, dstCoord, 0.16);
          const idx = Math.min(curve.length - 1, Math.floor(progress * (curve.length - 1)));
          const pt = curve[idx] || srcCoord;

          return {
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: pt },
            properties: { color: arc.color },
          };
        });

        const source = map.getSource('particle-source') as GeoJSONSource | undefined;
        source?.setData({ type: 'FeatureCollection', features: particleFeatures });
      }

      animFrameRef.current = requestAnimationFrame(animateParticles);
    };

    animFrameRef.current = requestAnimationFrame(animateParticles);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [geoGraph, reducedMotion, isLiveActive, livePhase, liveProgress, orderedArcs]);

  // Camera preset handler
  useEffect(() => {
    if (!cameraPreset || !mapRef.current) return;
    const map = mapRef.current;
    switch (cameraPreset) {
      case 'india':
        map.flyTo({ center: [78.9629, 22.5937], zoom: 4.6, pitch: 48, bearing: -10, duration: 1600 });
        break;
      case 'mumbai':
        map.flyTo({ center: [73.3, 18.8], zoom: 7.5, pitch: 55, bearing: -22, duration: 1600 });
        break;
      case 'kolkata':
        map.flyTo({ center: [88.3639, 22.5726], zoom: 7.6, pitch: 50, bearing: 15, duration: 1600 });
        break;
      case 'north':
        map.flyTo({ center: [76.5, 27.7], zoom: 6.5, pitch: 48, bearing: -12, duration: 1600 });
        break;
      case 'dubai':
        map.flyTo({ center: [55.2708, 25.2048], zoom: 6.2, pitch: 50, bearing: -30, duration: 1800 });
        break;
    }
  }, [cameraPreset]);

  // Search and fly to matching city or account when searchQuery changes
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
      mapRef.current.flyTo({
        center: [match.lon, match.lat],
        zoom: 7.8,
        duration: 1200,
      });
    }
  }, [searchQuery, geoGraph, onSelectCity, onSelectAccount]);

  const handleSkipToFinal = () => {
    setIsLiveActive(false);
    setLivePhase('completed');
    mapRef.current?.flyTo({
      center: [78.9629, 22.5937],
      zoom: 4.6,
      pitch: 48,
      duration: 1200,
    });
  };

  return (
    <div className="relative size-full overflow-hidden bg-[#07110D] select-none">
      {/* 1. Primary MapLibre Container */}
      <div ref={mapContainerRef} className="size-full" />

      {/* 2. High-Visibility Tactical SVG Curved Route Network (Guaranteed 100% visible across any basemap) */}
      <svg
        className="absolute inset-0 pointer-events-none size-full z-10 overflow-visible"
        aria-hidden="true"
      >
        <defs>
          {/* Subtle Glow Filter */}
          <filter id="map-edge-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.0" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Alert Glow Filter for Frozen/Blocked Edge */}
          <filter id="map-edge-blocked-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Directional Arrowheads */}
          <marker
            id="arrowhead-gold"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="5.5"
            markerHeight="5.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#C9A85B" />
          </marker>
          <marker
            id="arrowhead-green"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="5.5"
            markerHeight="5.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#00C878" />
          </marker>
          <marker
            id="arrowhead-red"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6.5"
            markerHeight="6.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#EF4444" />
          </marker>
        </defs>

        {svgEdges.map((edge) => {
          const arrowMarker = edge.isBlocked
            ? 'url(#arrowhead-red)'
            : edge.arc.arcType === 'victim'
              ? 'url(#arrowhead-green)'
              : 'url(#arrowhead-gold)';

          return (
            <g key={edge.id} className="transition-opacity duration-300">
              {/* Layer 1: Contrast casing */}
              <path
                d={edge.pathD}
                fill="none"
                stroke="#020805"
                strokeWidth={edge.strokeWidth + 4.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.92}
              />

              {/* Layer 2: Radiant Halo Glow */}
              <path
                d={edge.pathD}
                fill="none"
                stroke={edge.color}
                strokeWidth={edge.strokeWidth + 3.0}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={edge.isBlocked ? 0.75 : 0.45}
                filter={edge.isBlocked ? 'url(#map-edge-blocked-glow)' : 'url(#map-edge-glow)'}
              />

              {/* Layer 3: Main Core Vibrant Colored Line */}
              <path
                d={edge.pathD}
                fill="none"
                stroke={edge.color}
                strokeWidth={edge.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.96}
                markerEnd={!edge.headPos ? arrowMarker : undefined}
              />

              {/* Layer 4: Animated Dashed Pulse indicating money movement direction */}
              <path
                d={edge.pathD}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={Math.max(1.8, edge.strokeWidth * 0.55)}
                strokeLinecap="round"
                strokeDasharray="6 18"
                opacity={0.85}
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="-24"
                  dur="1.2s"
                  repeatCount="indefinite"
                />
              </path>

              {/* Layer 5: Traveling Wavefront Particle during Live Attack Hop */}
              {edge.headPos && (
                <g transform={`translate(${edge.headPos.x}, ${edge.headPos.y})`}>
                  {/* Pulsing ring around wavefront head */}
                  <circle
                    r="8"
                    fill="none"
                    stroke={edge.color}
                    strokeWidth="1.5"
                    opacity="0.8"
                  >
                    <animate
                      attributeName="r"
                      values="4;12;4"
                      dur="0.8s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.9;0.1;0.9"
                      dur="0.8s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  {/* Bright glowing core dot */}
                  <circle
                    r="4.5"
                    fill="#FFFFFF"
                    stroke={edge.color}
                    strokeWidth="2"
                  />
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* 2. Floating Live Attack Video Playback HUD Overlay (Positioned in top-right corner to never obscure map nodes & corridors) */}
      {isLiveActive && livePhase !== 'idle' && livePhase !== 'completed' && (
        <div className="absolute top-16 right-4 z-30 max-w-md w-[92%] sm:w-[380px] animate-fadeIn pointer-events-auto">
          <div className="rounded-xl border border-gold/40 bg-[#0B1812]/95 p-3 shadow-2xl backdrop-blur-md space-y-2">
            {/* Header row */}
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
                      {livePhase === 'blocked' && '🛡️ AUTONOMOUS AI SHIELD ENGAGED: Entire Mule Network Quarantined!'}
                    </span>
                    <span className={cn(
                      'shrink-0 rounded px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase tracking-wider border',
                      livePhase === 'blocked' ? 'bg-danger/25 text-danger border-danger/40 animate-pulse' : 'bg-gold/15 text-gold-light border-gold/30'
                    )}>
                      {livePhase === 'blocked' ? 'CONTAINMENT ACTIVE' : 'LIVE STREAM'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted truncate mt-0.5">
                    {livePhase === 'genesis' && `Withdrawing stolen funds from ${victimLocation?.city || 'Victim Account'} via instant UPI rail`}
                    {livePhase === 'hop1' && `Tracing money moving across state borders from ${orderedArcs[0]?.src_city} to ${orderedArcs[0]?.dst_city}`}
                    {livePhase === 'hop2' && `Forwarding structured funds from ${orderedArcs[1]?.src_city} to ${orderedArcs[1]?.dst_city}`}
                    {livePhase === 'hop3' && `Layering smurfed funds from ${orderedArcs[2]?.src_city} to ${orderedArcs[2]?.dst_city}`}
                    {livePhase === 'hop4' && `Intercepting terminal extraction from ${orderedArcs[3]?.src_city} to ${orderedArcs[3]?.dst_city}`}
                    {livePhase === 'blocked' && `Cash-out extraction blocked! All syndicate accounts quarantined under PMLA Sec 5. ₹${(geoGraph.arcs[0]?.amount || 500000).toLocaleString('en-IN')} preserved.`}
                  </p>
                </div>
              </div>

              {/* Skip button */}
              <button
                type="button"
                onClick={handleSkipToFinal}
                className="shrink-0 flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-muted hover:text-ink hover:bg-white/5 transition-colors cursor-pointer"
              >
                <span>Skip</span>
                <SkipForward className="size-3" />
              </button>
            </div>

            {/* Live Progress Bar */}
            <div className="w-full h-1 bg-canvas/80 rounded-full overflow-hidden border border-gold/15">
              <div
                className={cn(
                  'h-full transition-all duration-150',
                  livePhase === 'blocked' ? 'bg-danger' : 'bg-gradient-to-r from-gold to-emerald'
                )}
                style={{
                  width: `${
                    livePhase === 'genesis'
                      ? liveProgress * 15
                      : livePhase === 'hop1'
                        ? 15 + liveProgress * 20
                        : livePhase === 'hop2'
                          ? 35 + liveProgress * 20
                          : livePhase === 'hop3'
                            ? 55 + liveProgress * 20
                            : livePhase === 'hop4'
                              ? 75 + liveProgress * 20
                              : 100
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. Sleek Basemap Switcher: Default vs Satellite (Bottom-Left) */}
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

      {/* 5. Navigation Controls: 3D Tilt, Compass North, Zoom (Bottom-Right) */}
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
