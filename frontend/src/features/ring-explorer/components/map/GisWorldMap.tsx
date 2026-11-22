import {
  Box,
  Compass,
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

// 1. Google Earth Hybrid: High-resolution satellite photography + labels, borders & transport networks
export const GOOGLE_EARTH_HYBRID_STYLE: StyleSpecification = {
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
      maxzoom: 22,
    },
  },
  layers: [
    {
      id: 'google-hybrid-layer',
      type: 'raster',
      source: 'google-hybrid-base',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

// 2. Google Earth Pure Satellite: Raw photorealistic satellite photography
export const GOOGLE_EARTH_SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'google-sat-base': {
      type: 'raster',
      tiles: [
        'https://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}',
        'https://mt1.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}',
        'https://mt2.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}',
        'https://mt3.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}',
      ],
      tileSize: 256,
      attribution: '© Google Earth / Google Maps, Maxar Technologies',
      maxzoom: 22,
    },
  },
  layers: [
    {
      id: 'google-sat-layer',
      type: 'raster',
      source: 'google-sat-base',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

// 3. Vector Style: OpenFreeMap Dark
export const OPEN_FREE_MAP_DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';

// 4. Fallback Raster Style: Esri World Dark Gray Canvas
export const ESRI_DARK_GRAY_FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'esri-dark-base': {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '© Esri, © OpenStreetMap contributors, OpenFreeMap',
    },
    'esri-dark-ref': {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: 'esri-dark-base-layer',
      type: 'raster',
      source: 'esri-dark-base',
      minzoom: 0,
      maxzoom: 16,
    },
    {
      id: 'esri-dark-ref-layer',
      type: 'raster',
      source: 'esri-dark-ref',
      minzoom: 0,
      maxzoom: 16,
    },
  ],
};

export type BasemapMode = 'google-hybrid' | 'google-satellite' | 'tactical-dark' | 'esri-gray';

export const BASEMAP_CONFIGS: Record<BasemapMode, { name: string; style: string | StyleSpecification; label: string }> = {
  'google-hybrid': {
    name: 'Google Earth Hybrid',
    style: GOOGLE_EARTH_HYBRID_STYLE,
    label: '🛰️ Earth Hybrid',
  },
  'google-satellite': {
    name: 'Google Satellite',
    style: GOOGLE_EARTH_SATELLITE_STYLE,
    label: '🌍 Satellite',
  },
  'tactical-dark': {
    name: 'Tactical Dark',
    style: OPEN_FREE_MAP_DARK_STYLE,
    label: '🌑 Tactical Dark',
  },
  'esri-gray': {
    name: 'Esri Dark Canvas',
    style: ESRI_DARK_GRAY_FALLBACK_STYLE,
    label: '🗺️ Esri Gray',
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
  onSelectCity: (loc: GeoLocationNode | null) => void;
  onSelectArc: (arc: GeoTransactionArc | null) => void;
  onSelectAccount?: (acc: AccountNodeData) => void;
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
  onSelectCity,
  onSelectArc,
  onSelectAccount,
}: GisWorldMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreInstance | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const animFrameRef = useRef<number | null>(null);

  const [basemap, setBasemap] = useState<BasemapMode>('google-hybrid');
  const [is3dPitch, setIs3dPitch] = useState<boolean>(true);

  // Compute curved GeoJSON routes
  const routesGeoJson = useMemo(() => {
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
          color: arc.color,
          arcType: arc.arcType,
          is_active: activeTxnIds.has(arc.txn_id),
          is_selected: selectedArc?.txn_id === arc.txn_id,
          src_city: arc.src_city,
          dst_city: arc.dst_city,
        },
      };
    });

    return {
      type: 'FeatureCollection' as const,
      features,
    };
  }, [geoGraph, activeTxnIds, selectedArc]);

  // Keep a ref to latest routes GeoJSON to prevent closure race conditions
  const routesGeoJsonRef = useRef(routesGeoJson);
  routesGeoJsonRef.current = routesGeoJson;

  // Setup routes source & layers helper
  const setupRouteLayers = useCallback((map: MapLibreInstance) => {
    if (!map.getSource('routes-source')) {
      map.addSource('routes-source', {
        type: 'geojson',
        data: routesGeoJsonRef.current,
      });
    }

    // Layer 1: Dark Casing for high contrast over satellite landmasses and oceans
    if (!map.getLayer('routes-casing')) {
      map.addLayer({
        id: 'routes-casing',
        type: 'line',
        source: 'routes-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#020604',
          'line-width': 5.5,
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
          'line-color': ['get', 'color'],
          'line-width': 9,
          'line-opacity': 0.55,
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
          'line-color': ['get', 'color'],
          'line-width': [
            'case',
            ['boolean', ['get', 'is_selected'], false],
            4.2,
            ['boolean', ['get', 'is_active'], false],
            3.4,
            2.2,
          ],
          'line-opacity': [
            'case',
            ['boolean', ['get', 'is_active'], false],
            1.0,
            0.85,
          ],
        },
      });
    }
  }, []);

  // Setup animated particles layer helper
  const setupParticleLayer = useCallback((map: MapLibreInstance) => {
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
          'circle-radius': 4.0,
          'circle-color': '#FFF8D6',
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': 2.0,
        },
      });
    }
  }, []);

  // 1. Initialize MapLibre GL Map with Google Earth Satellite Style & 3D oblique tilt
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new Map({
      container: mapContainerRef.current,
      style: GOOGLE_EARTH_HYBRID_STYLE,
      center: [78.9629, 22.5937], // Centered on India
      zoom: 4.5,
      pitch: 48, // Authentic Google Earth 3D oblique tilt
      bearing: -10,
      minZoom: 1.5,
      maxZoom: 20,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('load', () => {
      setupRouteLayers(map);
      setupParticleLayer(map);

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

    // Fallback handler if satellite style encounters network restrictions
    map.on('error', (e) => {
      if (!map.isStyleLoaded() && e.error) {
        console.warn('Satellite style unreachable, falling back to Esri Dark Canvas');
        try {
          map.setStyle(ESRI_DARK_GRAY_FALLBACK_STYLE);
          map.once('style.load', () => {
            setupRouteLayers(map);
            setupParticleLayer(map);
          });
        } catch {}
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [geoGraph, onSelectArc, onSelectCity, setupRouteLayers, setupParticleLayer]);

  // Handle Basemap Switch
  const handleSelectBasemap = useCallback(
    (mode: BasemapMode) => {
      setBasemap(mode);
      const map = mapRef.current;
      if (!map) return;
      const config = BASEMAP_CONFIGS[mode];
      map.setStyle(config.style);
      map.once('style.load', () => {
        setupRouteLayers(map);
        setupParticleLayer(map);
      });
    },
    [setupRouteLayers, setupParticleLayer],
  );

  // Toggle 3D Tilt Orbit
  const toggle3dPitch = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const nextPitch = !is3dPitch;
    setIs3dPitch(nextPitch);
    map.easeTo({
      pitch: nextPitch ? 52 : 0,
      bearing: nextPitch ? -15 : 0,
      duration: 1000,
    });
  }, [is3dPitch]);

  // Reset North Orientation
  const handleResetNorth = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      bearing: 0,
      duration: 800,
    });
  }, []);

  // Sync Camera Presets (e.g. from Corridor Quick Jumps)
  useEffect(() => {
    if (!cameraPreset || !mapRef.current) return;
    const map = mapRef.current;

    switch (cameraPreset) {
      case 'overview':
        map.flyTo({
          center: [78.9629, 22.5937],
          zoom: 4.5,
          pitch: 48,
          bearing: 0,
          duration: 1400,
        });
        break;
      case 'south':
        map.flyTo({
          center: [78.9, 13.0],
          zoom: 6.8,
          pitch: 52,
          bearing: 18,
          duration: 1600,
        });
        break;
      case 'mumbai':
        map.flyTo({
          center: [73.3, 18.8],
          zoom: 7.5,
          pitch: 55,
          bearing: -22,
          duration: 1600,
        });
        break;
      case 'kolkata':
        map.flyTo({
          center: [88.3639, 22.5726],
          zoom: 7.6,
          pitch: 50,
          bearing: 15,
          duration: 1600,
        });
        break;
      case 'north':
        map.flyTo({
          center: [76.5, 27.7],
          zoom: 6.5,
          pitch: 48,
          bearing: -12,
          duration: 1600,
        });
        break;
      case 'dubai':
        map.flyTo({
          center: [55.2708, 25.2048],
          zoom: 6.2,
          pitch: 50,
          bearing: -30,
          duration: 1800,
        });
        break;
    }
  }, [cameraPreset]);

  // 2. Update routes source when geoGraph, activeTxnIds or selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('routes-source') as GeoJSONSource | undefined;
    if (source) {
      source.setData(routesGeoJson);
    }
  }, [routesGeoJson]);

  // 3. Render and sync DOM Markers for Cities
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Filter cities if a role filter is active
    const filteredLocations = geoGraph.locations.filter((loc) => {
      if (filterRole === 'all') return true;
      if (filterRole === 'victim') return loc.isVictimHub;
      if (filterRole === 'mule') return loc.isMuleHub || loc.isCollectorHub;
      if (filterRole === 'cash_out') return loc.isCashoutHub;
      return true;
    });

    filteredLocations.forEach((loc) => {
      const isSelected = selectedCity?.id === loc.id;
      const isCityActive = geoGraph.arcs.some(
        (a) =>
          activeTxnIds.has(a.txn_id) &&
          (a.src_city_id === loc.id || a.dst_city_id === loc.id),
      );

      // Dominant color
      const color = loc.isCashoutHub
        ? '#EF4444' // Red
        : loc.isCollectorHub || loc.isMuleHub
          ? '#C9A85B' // Gold
          : '#00C878'; // Emerald

      // Create Custom Tactical Marker DOM element
      const el = document.createElement('div');
      el.className = 'group relative flex flex-col items-center cursor-pointer select-none';

      // HTML structure for pin with pulsing ripple
      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          <!-- Pulse ring -->
          <div class="absolute -inset-2 rounded-full border border-[${color}] opacity-${
            isSelected || isCityActive ? '80' : '40'
          } animate-ping" style="border-color: ${color}; animation-duration: 2.2s;"></div>
          <!-- Outer anchor circle -->
          <div class="size-5 rounded-full border-2 bg-[#07110D] flex items-center justify-center shadow-lg transition-transform group-hover:scale-125" style="border-color: ${color};">
            <!-- Center Core -->
            <div class="size-2 rounded-full" style="background-color: ${color};"></div>
          </div>
        </div>
        <!-- City Label Card -->
        <div class="mt-1 flex items-center gap-1 rounded-md border border-gold/30 bg-[#0B1812]/90 px-1.5 py-0.5 text-[10px] font-semibold text-ink shadow-md backdrop-blur-xs transition-all group-hover:border-gold group-hover:text-gold-light ${
          isSelected ? 'border-gold text-gold-light shadow-glow-gold' : ''
        }">
          <span class="font-display tracking-tight">${loc.city}</span>
          <span class="font-mono text-[9px] text-muted">(${loc.accounts.length})</span>
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

      const marker = new Marker({ element: el, anchor: 'bottom' })
        .setLngLat([loc.lon, loc.lat])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [geoGraph, selectedCity, activeTxnIds, filterRole, onSelectCity, onSelectArc]);

  // 4. Animated Flow Particles traveling along routes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || reducedMotion) return;

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
            geometry: {
              type: 'Point' as const,
              coordinates: pt,
            },
            properties: {
              color: arc.color,
            },
          };
        });

        const source = map.getSource('particle-source') as GeoJSONSource | undefined;
        source?.setData({
          type: 'FeatureCollection',
          features: particleFeatures,
        });
      }

      animFrameRef.current = requestAnimationFrame(animateParticles);
    };

    const initParticles = () => {
      if (!map.getSource('particle-source')) {
        map.addSource('particle-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addLayer({
          id: 'particle-layer',
          type: 'circle',
          source: 'particle-source',
          paint: {
            'circle-radius': 3.5,
            'circle-color': '#FFF8D6',
            'circle-stroke-color': ['get', 'color'],
            'circle-stroke-width': 1.5,
          },
        });
      }

      animFrameRef.current = requestAnimationFrame(animateParticles);
    };

    if (map.isStyleLoaded()) {
      initParticles();
    } else {
      map.once('load', initParticles);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [geoGraph, reducedMotion]);

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

  return (
    <div className="relative size-full overflow-hidden bg-[#07110D] select-none">
      {/* 1. Primary MapLibre Container */}
      <div ref={mapContainerRef} className="size-full" />

      {/* 2. Sleek Basemap Switcher: Satellite vs Dark (Bottom-Left) */}
      <div className="absolute bottom-20 left-4 z-20 hidden sm:flex items-center rounded-xl border border-gold/30 bg-[#0B1812]/95 p-1 shadow-md backdrop-blur-md">
        <button
          type="button"
          onClick={() => handleSelectBasemap('google-hybrid')}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
            basemap === 'google-hybrid'
              ? 'border border-gold/60 bg-gold/25 text-gold-light shadow-[0_0_8px_rgba(201,168,91,0.3)]'
              : 'border border-transparent text-muted hover:text-ink'
          }`}
        >
          🛰️ Satellite
        </button>
        <button
          type="button"
          onClick={() => handleSelectBasemap('tactical-dark')}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
            basemap === 'tactical-dark'
              ? 'border border-gold/60 bg-gold/25 text-gold-light shadow-[0_0_8px_rgba(201,168,91,0.3)]'
              : 'border border-transparent text-muted hover:text-ink'
          }`}
        >
          🌑 Dark Canvas
        </button>
      </div>

      {/* 3. Navigation Controls: 3D Tilt, Compass North, Zoom (Bottom-Right) */}
      <div className="absolute bottom-20 right-4 z-20 flex flex-col gap-1.5">
        {/* 3D Tilt Orbit Toggle */}
        <button
          type="button"
          onClick={toggle3dPitch}
          aria-label={is3dPitch ? 'Switch to 2D Top-Down' : 'Switch to 3D Orbit'}
          title={is3dPitch ? '3D Orbit Active (Click for 2D)' : '2D Top-Down Active (Click for 3D)'}
          className={`grid size-8 place-items-center rounded-lg border text-xs font-bold transition-colors shadow-md backdrop-blur-md ${
            is3dPitch
              ? 'border-gold/60 bg-gold/20 text-gold-light'
              : 'border-gold/25 bg-[#0B1812]/90 text-muted hover:text-ink'
          }`}
        >
          <Box className="size-4" />
        </button>

        {/* Compass Reset North */}
        <button
          type="button"
          onClick={handleResetNorth}
          aria-label="Reset North"
          title="Reset North Orientation"
          className="grid size-8 place-items-center rounded-lg border border-gold/25 bg-[#0B1812]/90 text-gold-light hover:border-gold/60 hover:bg-gold/15 transition-colors shadow-md backdrop-blur-md"
        >
          <Compass className="size-4" />
        </button>

        {/* Zoom In */}
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="Zoom in"
          className="grid size-8 place-items-center rounded-lg border border-gold/25 bg-[#0B1812]/90 text-gold-light hover:border-gold/60 hover:bg-gold/15 transition-colors shadow-md backdrop-blur-md"
        >
          <ZoomIn className="size-4" />
        </button>

        {/* Zoom Out */}
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="Zoom out"
          className="grid size-8 place-items-center rounded-lg border border-gold/25 bg-[#0B1812]/90 text-gold-light hover:border-gold/60 hover:bg-gold/15 transition-colors shadow-md backdrop-blur-md"
        >
          <ZoomOut className="size-4" />
        </button>
      </div>

      {/* 4. Bottom-Left Photorealistic Earth Engine Disclaimer */}
      <div className="absolute bottom-4 left-4 z-20 pointer-events-none hidden md:block max-w-lg">
        <div className="rounded-lg border border-gold/20 bg-[#0B1812]/90 px-3 py-1 text-[10px] text-muted backdrop-blur-md">
          <span className="text-gold-light font-semibold">GOOGLE EARTH SATELLITE ENGINE: </span>
          High-resolution satellite terrain imagery synchronized with active mule ring corridors ({geoGraph.locations.length} regional hubs).
        </div>
      </div>
    </div>
  );
});

export default GisWorldMap;
