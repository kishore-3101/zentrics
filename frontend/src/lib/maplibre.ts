import * as maplibregl from 'maplibre-gl';

// Configure MapLibre web worker to prevent 404 / non-JS MIME type errors on Vercel
if (typeof window !== 'undefined' && maplibregl.config) {
  maplibregl.config.WORKER_URL = '/assets/maplibre-gl-worker.mjs';
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
