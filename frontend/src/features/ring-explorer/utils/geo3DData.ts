import * as THREE from 'three';
import type { GeoCityCoordinate } from '../types/geo';
import { geoTo3D } from './geo3DProjection';

export { GEO_CENTER_LAT, GEO_CENTER_LON, GEO_SCALE, geoTo3D, threeDtoGeo } from './geo3DProjection';

// Primary City Coordinate Registry
export const CITY_COORDINATES: Record<string, GeoCityCoordinate> = {
  tier1_delhi: { id: 'tier1_delhi', city: 'Delhi', state: 'National Capital Territory', country: 'India', lat: 28.6139, lon: 77.2090 },
  tier1_ncr: { id: 'tier1_ncr', city: 'Gurugram / NCR', state: 'Haryana', country: 'India', lat: 28.4595, lon: 77.0266 },
  tier2_jaipur: { id: 'tier2_jaipur', city: 'Jaipur', state: 'Rajasthan', country: 'India', lat: 26.9124, lon: 75.7873 },
  tier3_alwar: { id: 'tier3_alwar', city: 'Alwar', state: 'Rajasthan', country: 'India', lat: 27.5530, lon: 76.6346 },
  tier2_lucknow: { id: 'tier2_lucknow', city: 'Lucknow', state: 'Uttar Pradesh', country: 'India', lat: 26.8467, lon: 80.9462 },
  tier2_kanpur: { id: 'tier2_kanpur', city: 'Kanpur', state: 'Uttar Pradesh', country: 'India', lat: 26.4499, lon: 80.3319 },
  tier1_mumbai: { id: 'tier1_mumbai', city: 'Mumbai', state: 'Maharashtra', country: 'India', lat: 19.0760, lon: 72.8777 },
  tier1_pune: { id: 'tier1_pune', city: 'Pune', state: 'Maharashtra', country: 'India', lat: 18.5204, lon: 73.8567 },
  tier1_kolkata: { id: 'tier1_kolkata', city: 'Kolkata', state: 'West Bengal', country: 'India', lat: 22.5726, lon: 88.3639 },
  tier1_bengaluru: { id: 'tier1_bengaluru', city: 'Bengaluru', state: 'Karnataka', country: 'India', lat: 12.9716, lon: 77.5946 },
  tier2_hubli: { id: 'tier2_hubli', city: 'Hubballi', state: 'Karnataka', country: 'India', lat: 15.3647, lon: 75.1240 },
  tier1_hyderabad: { id: 'tier1_hyderabad', city: 'Hyderabad', state: 'Telangana', country: 'India', lat: 17.3850, lon: 78.4867 },
  tier1_chennai: { id: 'tier1_chennai', city: 'Chennai', state: 'Tamil Nadu', country: 'India', lat: 13.0827, lon: 80.2707 },
  offshore_dubai: { id: 'offshore_dubai', city: 'Dubai', state: 'Emirate of Dubai', country: 'United Arab Emirates', lat: 25.2048, lon: 55.2708 },
  offshore_singapore: { id: 'offshore_singapore', city: 'Singapore', state: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198 },
};

export interface StateLabelData {
  name: string;
  lat: number;
  lon: number;
  pos3D: [number, number, number];
  tier: 'state' | 'country';
}

// State & Jurisdiction Centroids for Labels
export const STATE_CENTROIDS: StateLabelData[] = [
  { name: 'TAMIL NADU', lat: 11.12, lon: 78.65, pos3D: geoTo3D(78.65, 11.12, 0.08), tier: 'state' },
  { name: 'KARNATAKA', lat: 14.85, lon: 75.75, pos3D: geoTo3D(75.75, 14.85, 0.08), tier: 'state' },
  { name: 'KERALA', lat: 10.15, lon: 76.50, pos3D: geoTo3D(76.50, 10.15, 0.08), tier: 'state' },
  { name: 'MAHARASHTRA', lat: 19.75, lon: 75.71, pos3D: geoTo3D(75.71, 19.75, 0.08), tier: 'state' },
  { name: 'TELANGANA', lat: 17.84, lon: 79.11, pos3D: geoTo3D(79.11, 17.84, 0.08), tier: 'state' },
  { name: 'ANDHRA PRADESH', lat: 15.91, lon: 79.74, pos3D: geoTo3D(79.74, 15.91, 0.08), tier: 'state' },
  { name: 'GUJARAT', lat: 22.25, lon: 71.19, pos3D: geoTo3D(71.19, 22.25, 0.08), tier: 'state' },
  { name: 'RAJASTHAN', lat: 26.58, lon: 73.84, pos3D: geoTo3D(73.84, 26.58, 0.08), tier: 'state' },
  { name: 'MADHYA PRADESH', lat: 23.47, lon: 77.94, pos3D: geoTo3D(77.94, 23.47, 0.08), tier: 'state' },
  { name: 'UTTAR PRADESH', lat: 27.05, lon: 80.75, pos3D: geoTo3D(80.75, 27.05, 0.08), tier: 'state' },
  { name: 'WEST BENGAL', lat: 23.70, lon: 87.85, pos3D: geoTo3D(87.85, 23.70, 0.08), tier: 'state' },
  { name: 'ODISHA', lat: 20.95, lon: 85.09, pos3D: geoTo3D(85.09, 20.95, 0.08), tier: 'state' },
  { name: 'BIHAR', lat: 25.09, lon: 85.31, pos3D: geoTo3D(85.31, 25.09, 0.08), tier: 'state' },
  { name: 'PUNJAB / HARYANA', lat: 30.15, lon: 75.80, pos3D: geoTo3D(75.80, 30.15, 0.08), tier: 'state' },
  { name: 'DELHI NCT', lat: 28.61, lon: 77.21, pos3D: geoTo3D(77.21, 28.61, 0.08), tier: 'state' },
  { name: 'SRI LANKA', lat: 7.87, lon: 80.77, pos3D: geoTo3D(80.77, 7.87, 0.08), tier: 'country' },
  { name: 'UNITED ARAB EMIRATES', lat: 24.45, lon: 54.37, pos3D: geoTo3D(54.37, 24.45, 0.08), tier: 'country' },
  { name: 'SINGAPORE', lat: 1.35, lon: 103.82, pos3D: geoTo3D(103.82, 1.35, 0.08), tier: 'country' },
];

/**
 * Geometric vector boundary polylines for India's external coastline & land borders,
 * as well as internal state boundaries. Expressed in [lon, lat] pairs.
 */
export const INDIA_COASTLINE_POLYLINE: [number, number][] = [
  // West Coast from Gujarat Kutch down to Kanyakumari
  [68.6, 23.8], [69.0, 23.0], [70.2, 22.8], [69.4, 22.4], [68.9, 21.8],
  [70.0, 20.9], [71.5, 20.8], [72.2, 21.6], [72.8, 21.2], [72.8, 19.5],
  [72.8, 18.9], [73.2, 17.0], [73.8, 15.5], [74.3, 14.8], [74.8, 13.3],
  [75.8, 11.8], [76.2, 9.9], [76.9, 8.8], [77.5, 8.1], // Kanyakumari
  // East Coast up from Kanyakumari to West Bengal Sundarbans
  [78.1, 8.5], [78.8, 9.2], [79.2, 9.8], [79.8, 10.8], [80.3, 13.1],
  [80.1, 14.5], [80.9, 15.8], [82.2, 16.9], [83.3, 17.7], [84.9, 19.2],
  [85.8, 19.8], [87.0, 21.5], [88.2, 21.6], [89.1, 22.1], [89.0, 23.5],
];

// Northern Land Border of India
export const INDIA_NORTH_BORDER: [number, number][] = [
  [68.6, 23.8], [70.5, 25.0], [71.0, 27.5], [73.8, 29.8], [74.5, 31.5],
  [74.3, 33.2], [74.8, 34.5], [76.5, 35.5], [78.5, 35.0], [80.2, 31.0],
  [81.5, 30.2], [84.5, 27.5], [88.1, 27.3], [88.9, 27.4], [90.0, 26.8],
  [92.5, 27.8], [95.5, 28.2], [97.0, 28.0], [95.0, 25.5], [93.2, 24.0],
  [92.2, 22.0], [89.1, 22.1]
];

// Key Indian State Boundaries [lon, lat] polylines
export const STATE_BORDER_POLYLINES: [number, number][][] = [
  // Tamil Nadu - Kerala border
  [[77.5, 8.1], [77.1, 8.6], [76.9, 9.5], [77.2, 10.0], [76.8, 10.7], [76.4, 11.5]],
  // Tamil Nadu - Karnataka border
  [[76.4, 11.5], [77.0, 11.8], [77.7, 12.1], [78.2, 12.8], [78.5, 12.9]],
  // Tamil Nadu - Andhra Pradesh border
  [[78.5, 12.9], [79.2, 13.2], [80.1, 13.4], [80.3, 13.6]],
  // Karnataka - Kerala border
  [[76.4, 11.5], [75.6, 11.9], [75.2, 12.5], [74.9, 12.8]],
  // Karnataka - Goa border
  [[74.1, 14.9], [74.3, 15.5], [74.2, 15.8]],
  // Karnataka - Maharashtra border
  [[74.2, 15.8], [74.8, 16.5], [75.8, 17.2], [76.8, 17.7], [77.4, 17.8]],
  // Karnataka - Telangana border
  [[77.4, 17.8], [77.3, 16.8], [77.2, 16.0]],
  // Karnataka - Andhra Pradesh border
  [[77.2, 16.0], [77.5, 15.2], [77.1, 14.3], [77.8, 13.7], [78.5, 12.9]],
  // Maharashtra - Gujarat border
  [[72.8, 20.0], [73.5, 20.5], [73.9, 21.4], [74.3, 21.8]],
  // Maharashtra - Madhya Pradesh border
  [[74.3, 21.8], [75.5, 21.5], [76.8, 21.3], [78.5, 21.4], [80.1, 21.3]],
  // Maharashtra - Chhattisgarh border
  [[80.1, 21.3], [80.4, 20.5], [80.3, 19.2]],
  // Maharashtra - Telangana border
  [[80.3, 19.2], [79.2, 19.5], [78.3, 19.8], [77.8, 18.8], [77.4, 17.8]],
  // Telangana - Andhra Pradesh border
  [[77.4, 17.8], [78.2, 16.5], [79.3, 16.7], [80.1, 16.8], [81.1, 17.5]],
  // Telangana - Chhattisgarh border
  [[81.1, 17.5], [80.8, 18.5], [80.3, 19.2]],
  // Gujarat - Rajasthan border
  [[69.0, 24.3], [71.2, 24.5], [72.8, 24.6], [73.8, 24.2], [74.3, 23.5]],
  // Gujarat - Madhya Pradesh border
  [[74.3, 23.5], [74.3, 21.8]],
  // Rajasthan - Madhya Pradesh border
  [[74.3, 23.5], [75.2, 24.8], [76.5, 25.2], [77.2, 25.8], [78.2, 26.8]],
  // Rajasthan - Uttar Pradesh border
  [[78.2, 26.8], [77.5, 27.5], [77.2, 27.8]],
  // Rajasthan - Haryana / Punjab border
  [[77.2, 27.8], [76.2, 28.2], [75.5, 28.8], [74.2, 29.8], [73.8, 29.8]],
  // Uttar Pradesh - Madhya Pradesh border
  [[78.2, 26.8], [79.0, 25.5], [80.5, 25.2], [81.8, 25.0], [82.8, 24.5]],
  // Uttar Pradesh - Bihar border
  [[83.8, 24.5], [84.1, 25.8], [84.0, 27.2]],
  // Uttar Pradesh - Uttarakhand / Nepal border
  [[80.2, 28.8], [81.5, 28.2], [82.5, 27.8], [84.0, 27.2]],
  // West Bengal - Bihar / Jharkhand border
  [[87.8, 24.0], [86.8, 24.5], [86.2, 23.8], [86.5, 22.8], [87.0, 21.8]],
  // West Bengal - Odisha border
  [[87.0, 21.8], [87.5, 21.6]],
  // Odisha - Andhra Pradesh border
  [[85.0, 19.2], [84.0, 18.8], [83.0, 18.2]],
  // Odisha - Chhattisgarh border
  [[83.0, 18.2], [82.5, 20.0], [83.0, 21.5], [84.0, 22.5]],
  // Delhi NCT Boundary Circle/Box
  [[76.85, 28.40], [77.35, 28.40], [77.35, 28.88], [76.85, 28.88], [76.85, 28.40]],
];

// Regional International Hubs: Arabian Peninsula & Singapore
export const OFFSHORE_OUTLINES: { name: string; polyline: [number, number][] }[] = [
  // UAE & Persian Gulf coastline
  {
    name: 'UAE_DUBAI',
    polyline: [
      [51.5, 24.0], [52.5, 24.2], [53.5, 24.1], [54.4, 24.5],
      [55.2, 25.2], [55.8, 25.7], [56.3, 26.2], [56.4, 25.0],
      [56.0, 24.2], [55.2, 23.5], [54.0, 23.2], [52.0, 23.5], [51.5, 24.0]
    ],
  },
  // Singapore Island & Southern Malaya
  {
    name: 'SINGAPORE_HUB',
    polyline: [
      [103.6, 1.25], [103.7, 1.45], [103.9, 1.45], [104.05, 1.35],
      [103.95, 1.25], [103.75, 1.22], [103.6, 1.25]
    ],
  },
  // Sri Lanka
  {
    name: 'SRI_LANKA',
    polyline: [
      [79.8, 9.8], [80.5, 9.2], [81.5, 8.5], [81.9, 7.5],
      [81.6, 6.5], [80.8, 5.9], [80.1, 6.2], [79.8, 7.0],
      [79.7, 8.5], [79.8, 9.8]
    ],
  },
];

/**
 * Generate 3D LineSegments geometry from all state borders and coastlines
 */
export function createGeographicLinesGeometry(): THREE.BufferGeometry {
  const points: number[] = [];

  const addPolyline = (coords: [number, number][]) => {
    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = geoTo3D(coords[i][0], coords[i][1], 0.04);
      const p2 = geoTo3D(coords[i + 1][0], coords[i + 1][1], 0.04);
      points.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
    }
  };

  // 1. India Coastline & North Border
  addPolyline(INDIA_COASTLINE_POLYLINE);
  addPolyline(INDIA_NORTH_BORDER);

  // 2. All State Borders
  STATE_BORDER_POLYLINES.forEach(addPolyline);

  // 3. Offshore Hubs (Dubai, Singapore, Sri Lanka)
  OFFSHORE_OUTLINES.forEach((item) => addPolyline(item.polyline));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}
