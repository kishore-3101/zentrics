import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

// Configure MapLibre web worker using Vite's bundled asset URL so Vercel always serves it with application/javascript MIME type
if (typeof window !== 'undefined' && maplibregl.config) {
  maplibregl.config.WORKER_URL = maplibreWorkerUrl;
}

export const Map = maplibregl.Map;
export const Marker = maplibregl.Marker;
export const LngLatBounds = maplibregl.LngLatBounds;

export type MapLibreInstance = maplibregl.Map;
export type MapLibreMarker = maplibregl.Marker;
export type MapLibreBounds = maplibregl.LngLatBounds;

export type {
  StyleSpecification,
  GeoJSONSource,
  MapLayerMouseEvent,
  MapMouseEvent,
} from 'maplibre-gl';

export { maplibregl };
export default maplibregl;
