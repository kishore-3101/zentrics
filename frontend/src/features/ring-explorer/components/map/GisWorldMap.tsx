import {
  Compass,
  Layers,
  MapPin,
  RotateCcw,
  Search,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  Map,
  Marker,
  LngLatBounds,
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

// 1. Primary Vector Style: OpenFreeMap Dark (100% Free, Zero API Key, No Tracking, Zero Watermarks)
const OPEN_FREE_MAP_DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';

// 2. Fallback Raster Style: Esri World Dark Gray Canvas (Watermark-free public basemap)
const ESRI_DARK_GRAY_FALLBACK_STYLE: StyleSpecification = {
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

interface GisWorldMapProps {
  geoGraph: GeoGraphData;
  selectedCity: GeoLocationNode | null;
  selectedArc: GeoTransactionArc | null;
  activeTxnIds: Set<string>;
  reducedMotion?: boolean;
  onSelectCity: (loc: GeoLocationNode | null) => void;
  onSelectArc: (arc: GeoTransactionArc | null) => void;
}

export const GisWorldMap = memo(function GisWorldMap({
  geoGraph,
  selectedCity,
  selectedArc,
  activeTxnIds,
  reducedMotion = false,
  onSelectCity,
  onSelectArc,
}: GisWorldMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreInstance | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const animFrameRef = useRef<number | null>(null);

  const [currentZoom, setCurrentZoom] = useState<number>(4.4);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'victim' | 'mule' | 'cash_out'>('all');

  // Progressive Zoom Level Calculation
  const zoomLevelMeta = useMemo(() => {
    if (currentZoom < 3.2) {
      return {
        level: 1,
        name: 'Level 1 · Global View',
        desc: 'Showing continents, international routes & cross-border hubs',
      };
    }
    if (currentZoom < 5.2) {
      return {
        level: 2,
        name: 'Level 2 · National / Country View',
        desc: 'Showing country borders & national remittance corridors',
      };
    }
    if (currentZoom < 7.8) {
      return {
        level: 3,
        name: 'Level 3 · State & Jurisdiction View',
        desc: 'Revealing Indian state boundaries & interstate syndicates',
      };
    }
    return {
      level: 4,
      name: 'Level 4 · City & Account Hub View',
      desc: 'Showing precision city coordinates & account nodes',
    };
  }, [currentZoom]);

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

  // 1. Initialize MapLibre GL Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new Map({
      container: mapContainerRef.current,
      style: OPEN_FREE_MAP_DARK_STYLE,
      center: [78.9629, 22.5937], // Centered on India
      zoom: 4.4,
      minZoom: 1.5,
      maxZoom: 16,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('zoom', () => {
      setCurrentZoom(map.getZoom());
    });

    // Setup routes source & layers
    const setupRouteLayers = () => {
      if (!map.getSource('routes-source')) {
        map.addSource('routes-source', {
          type: 'geojson',
          data: routesGeoJsonRef.current,
        });

        // Layer 1: Dark Casing for high contrast over landmasses
        map.addLayer({
          id: 'routes-casing',
          type: 'line',
          source: 'routes-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#030A06',
            'line-width': 4.5,
            'line-opacity': 0.85,
          },
        });

        // Layer 2: Glowing Translucent Glow under routes
        map.addLayer({
          id: 'routes-glow',
          type: 'line',
          source: 'routes-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 7,
            'line-opacity': 0.35,
            'line-blur': 2,
          },
        });

        // Layer 3: Sharp Main Transaction Core Line
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
              3.5,
              ['boolean', ['get', 'is_active'], false],
              2.8,
              1.8,
            ],
            'line-opacity': [
              'case',
              ['boolean', ['get', 'is_active'], false],
              1.0,
              0.75,
            ],
          },
        });
      }
    };

    map.on('load', () => {
      setupRouteLayers();

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

    // Fallback handler if primary style fails
    map.on('error', (e) => {
      if (!map.isStyleLoaded() && e.error) {
        console.warn('Switching to watermark-free Esri Dark Gray fallback style');
        try {
          map.setStyle(ESRI_DARK_GRAY_FALLBACK_STYLE);
          map.once('style.load', () => {
            setupRouteLayers();
          });
        } catch {}
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

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

  // Fit bounds to show all ring hubs
  const handleFitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map || geoGraph.locations.length === 0) return;

    const bounds = new LngLatBounds();
    geoGraph.locations.forEach((loc) => bounds.extend([loc.lon, loc.lat]));

    map.fitBounds(bounds, {
      padding: { top: 70, bottom: 80, left: 60, right: 60 },
      maxZoom: 8,
      duration: 1200,
    });
  }, [geoGraph]);

  // Reset to India Overview
  const handleResetIndia = useCallback(() => {
    mapRef.current?.flyTo({
      center: [78.9629, 22.5937],
      zoom: 4.4,
      duration: 1000,
    });
  }, []);

  // Zoom to Global View
  const handleGlobalView = useCallback(() => {
    mapRef.current?.flyTo({
      center: [68.0, 20.0],
      zoom: 2.2,
      duration: 1200,
    });
  }, []);

  // Search input handler
  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) return;
    const term = q.toLowerCase().trim();
    const match = geoGraph.locations.find(
      (l) =>
        l.city.toLowerCase().includes(term) ||
        l.accounts.some((a) => a.account_id.toLowerCase().includes(term)),
    );
    if (match && mapRef.current) {
      onSelectCity(match);
      mapRef.current.flyTo({
        center: [match.lon, match.lat],
        zoom: 7.8,
        duration: 1200,
      });
    }
  };

  return (
    <div className="relative size-full overflow-hidden bg-[#07110D] select-none">
      {/* 1. Primary MapLibre Container */}
      <div ref={mapContainerRef} className="size-full" />

      {/* 2. Top-Center Progressive Zoom Level Indicator */}
      <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 z-20">
        <div className="flex items-center gap-2 rounded-xl border border-gold/30 bg-[#0B1812]/90 px-3.5 py-1.5 shadow-panel backdrop-blur-md">
          <Layers className="size-3.5 text-gold-light" />
          <div className="flex flex-col items-center">
            <span className="font-mono text-xs font-bold text-gold-light tracking-wide">
              {zoomLevelMeta.name}
            </span>
            <span className="text-[10px] text-muted hidden sm:inline">
              {zoomLevelMeta.desc}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Top-Left Tactical Search & Preset Navigation Bar */}
      <div className="absolute left-4 top-4 z-20 flex flex-col gap-2 max-w-sm">
        {/* Search Input */}
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search city or account (e.g. Delhi, ACC-9481)..."
            className="h-8 w-full rounded-xl border border-gold/25 bg-[#0B1812]/90 pl-8 pr-7 text-xs text-ink placeholder:text-muted/60 focus:border-gold/60 focus:outline-none backdrop-blur-md shadow-md"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => handleSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted hover:text-ink"
            >
              ✕
            </button>
          )}
        </div>

        {/* Quick View Presets & Role Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleGlobalView}
            className="inline-flex items-center gap-1 rounded-lg border border-gold/20 bg-[#0B1812]/80 px-2.5 py-1 text-[11px] font-medium text-muted hover:border-gold/40 hover:text-gold-light transition-colors backdrop-blur-xs shadow-sm"
          >
            <Compass className="size-3" />
            Global
          </button>
          <button
            type="button"
            onClick={handleResetIndia}
            className="inline-flex items-center gap-1 rounded-lg border border-gold/20 bg-[#0B1812]/80 px-2.5 py-1 text-[11px] font-medium text-muted hover:border-gold/40 hover:text-gold-light transition-colors backdrop-blur-xs shadow-sm"
          >
            <MapPin className="size-3 text-emerald" />
            India
          </button>
          <button
            type="button"
            onClick={handleFitAll}
            className="inline-flex items-center gap-1 rounded-lg border border-gold/30 bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-gold-light hover:bg-gold/20 transition-colors backdrop-blur-xs shadow-sm"
          >
            <RotateCcw className="size-3" />
            Fit Ring Hubs
          </button>
        </div>

        {/* Entity Role Filter Pill Bar */}
        <div className="flex items-center gap-1">
          {(
            [
              { key: 'all', label: 'All Roles' },
              { key: 'victim', label: 'Victims' },
              { key: 'mule', label: 'Mules' },
              { key: 'cash_out', label: 'Sinks' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilterRole(item.key)}
              className={`rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors backdrop-blur-xs ${
                filterRole === item.key
                  ? 'border-gold bg-gold/20 text-gold-light font-semibold'
                  : 'border-gold/15 bg-[#0B1812]/70 text-muted hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Top-Right Route & Entity Legend */}
      <div className="absolute right-4 top-4 z-20 hidden md:flex flex-col gap-1.5 rounded-xl border border-gold/20 bg-[#0B1812]/90 p-3 text-xs shadow-panel backdrop-blur-md">
        <span className="text-[10px] uppercase font-bold tracking-wider text-gold-light border-b border-gold/15 pb-1">
          GIS Entity & Route Legend
        </span>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="size-2 rounded-full bg-emerald shadow-[0_0_8px_#00C878]" />
          <span className="text-ink/90">Victims & Inflows</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="size-2 rounded-full bg-gold-light shadow-[0_0_8px_#C9A85B]" />
          <span className="text-ink/90">Collectors & Mule Conduit</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="size-2 rounded-full bg-danger shadow-[0_0_8px_#EF4444]" />
          <span className="text-ink/90">Cash-Out Terminals (Sinks)</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] pt-0.5 border-t border-gold/10 text-muted">
          <span className="size-1.5 rounded-full bg-[#FFF8D6]" />
          <span>Moving Flow Particles</span>
        </div>
      </div>

      {/* 5. Bottom-Right Interactive Zoom Control Buttons */}
      <div className="absolute bottom-20 right-4 z-20 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="Zoom in"
          className="grid size-8 place-items-center rounded-lg border border-gold/25 bg-[#0B1812]/90 text-gold-light hover:border-gold/60 hover:bg-gold/15 transition-colors shadow-md backdrop-blur-md"
        >
          <ZoomIn className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="Zoom out"
          className="grid size-8 place-items-center rounded-lg border border-gold/25 bg-[#0B1812]/90 text-gold-light hover:border-gold/60 hover:bg-gold/15 transition-colors shadow-md backdrop-blur-md"
        >
          <ZoomOut className="size-4" />
        </button>
      </div>

      {/* 6. Bottom-Left Synthetic Geospatial Disclaimer */}
      <div className="absolute bottom-20 left-4 z-20 pointer-events-none hidden sm:block max-w-md">
        <div className="rounded-lg border border-gold/20 bg-[#0B1812]/85 px-3 py-1.5 text-[10px] text-muted backdrop-blur-md">
          <span className="text-gold-light font-semibold">GIS PROVENANCE: </span>
          Synthetic demo coordinates projected from account cluster metadata ({geoGraph.locations.length} active hubs).
        </div>
      </div>
    </div>
  );
});

export default GisWorldMap;
