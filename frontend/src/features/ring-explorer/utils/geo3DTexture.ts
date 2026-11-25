import * as THREE from 'three';
import {
  INDIA_COASTLINE_POLYLINE,
  INDIA_NORTH_BORDER,
  OFFSHORE_OUTLINES,
  STATE_BORDER_POLYLINES,
  STATE_CENTROIDS,
  geoTo3D,
} from './geo3DData';

export const MAP_PLANE_WIDTH = 60;
export const MAP_PLANE_HEIGHT = 44;
const CANVAS_SIZE = 2048;

/** Convert 3D [X, Z] to Canvas pixel coordinates [u, v] */
function toCanvasCoords(x: number, z: number): [number, number] {
  const u = ((x + MAP_PLANE_WIDTH / 2) / MAP_PLANE_WIDTH) * CANVAS_SIZE;
  const v = ((z + MAP_PLANE_HEIGHT / 2) / MAP_PLANE_HEIGHT) * CANVAS_SIZE;
  return [u, v];
}

/** Convert [lon, lat] directly to Canvas pixel coordinates [u, v] */
function lonLatToCanvas(lon: number, lat: number): [number, number] {
  const [x, , z] = geoTo3D(lon, lat);
  return toCanvasCoords(x, z);
}

/**
 * Generate a high-definition 2048x2048 dark emerald and gold tactical
 * geographical map texture for the Three.js 3D ground plane.
 */
export function generateGeoMapTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // 1. Abyssal Ocean Background (Deep obsidian emerald)
  ctx.fillStyle = '#030A06';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // 2. Graticule Grid (Bathymetry lines)
  ctx.strokeStyle = 'rgba(16, 45, 30, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 6]);

  // Longitude Meridians: 50°E to 105°E in steps of 5°
  for (let lon = 50; lon <= 105; lon += 5) {
    const [u1] = lonLatToCanvas(lon, 40);
    const [u2] = lonLatToCanvas(lon, -2);
    ctx.beginPath();
    ctx.moveTo(u1, 0);
    ctx.lineTo(u2, CANVAS_SIZE);
    ctx.stroke();

    // Meridian label
    ctx.fillStyle = 'rgba(201, 168, 91, 0.35)';
    ctx.font = '16px monospace';
    ctx.fillText(`${lon}°E`, u1 + 6, CANVAS_SIZE - 24);
  }

  // Latitude Parallels: 0° to 35°N in steps of 5°
  for (let lat = 0; lat <= 35; lat += 5) {
    const [, v] = lonLatToCanvas(78.5, lat);
    ctx.beginPath();
    ctx.moveTo(0, v);
    ctx.lineTo(CANVAS_SIZE, v);
    ctx.stroke();

    // Parallel label
    ctx.fillStyle = 'rgba(201, 168, 91, 0.35)';
    ctx.font = '16px monospace';
    ctx.fillText(`${lat}°N`, 24, v - 6);
  }
  ctx.setLineDash([]); // Reset dash

  // 3. Helper to draw and fill polygon path
  const fillPolyline = (coords: [number, number][], fillColor: string, strokeColor: string) => {
    if (coords.length === 0) return;
    ctx.beginPath();
    const [startU, startV] = lonLatToCanvas(coords[0][0], coords[0][1]);
    ctx.moveTo(startU, startV);

    for (let i = 1; i < coords.length; i++) {
      const [u, v] = lonLatToCanvas(coords[i][0], coords[i][1]);
      ctx.lineTo(u, v);
    }
    ctx.closePath();

    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.0;
    ctx.stroke();
  };

  // 4. Fill Landmasses
  // India Subcontinent Landmass Polygon
  const indiaLandmassCoords = [...INDIA_COASTLINE_POLYLINE, ...INDIA_NORTH_BORDER];
  fillPolyline(indiaLandmassCoords, '#071710', 'rgba(201, 168, 91, 0.55)');

  // Offshore hubs: UAE, Singapore, Sri Lanka
  OFFSHORE_OUTLINES.forEach((item) => {
    fillPolyline(item.polyline, '#071710', 'rgba(201, 168, 91, 0.6)');
  });

  // 5. Draw Indian State Boundaries (Subtle glowing emerald lines)
  ctx.strokeStyle = 'rgba(0, 200, 120, 0.45)';
  ctx.lineWidth = 1.8;
  ctx.shadowColor = '#00C878';
  ctx.shadowBlur = 4;

  STATE_BORDER_POLYLINES.forEach((polyline) => {
    if (polyline.length === 0) return;
    ctx.beginPath();
    const [u0, v0] = lonLatToCanvas(polyline[0][0], polyline[0][1]);
    ctx.moveTo(u0, v0);
    for (let i = 1; i < polyline.length; i++) {
      const [u, v] = lonLatToCanvas(polyline[i][0], polyline[i][1]);
      ctx.lineTo(u, v);
    }
    ctx.stroke();
  });
  ctx.shadowBlur = 0; // Reset blur

  // 6. Draw State & Country Name Labels on the Map Surface
  STATE_CENTROIDS.forEach((sc) => {
    const [u, v] = lonLatToCanvas(sc.lon, sc.lat);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (sc.tier === 'country') {
      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = 'rgba(229, 199, 120, 0.85)'; // Antique Gold
      ctx.fillText(sc.name, u, v);
    } else {
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = 'rgba(0, 200, 120, 0.70)'; // Emerald Green
      ctx.fillText(sc.name, u, v);
    }
  });

  // 7. Tactical GIS Compass & Provenance Legend in the Indian Ocean Corner
  ctx.save();
  const [compassU, compassV] = [CANVAS_SIZE - 280, CANVAS_SIZE - 200];
  ctx.translate(compassU, compassV);

  // Tactical Ring
  ctx.strokeStyle = 'rgba(201, 168, 91, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 54, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshairs
  ctx.beginPath();
  ctx.moveTo(0, -64);
  ctx.lineTo(0, 64);
  ctx.moveTo(-64, 0);
  ctx.lineTo(64, 0);
  ctx.stroke();

  // Cardinal Points
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#C9A85B';
  ctx.textAlign = 'center';
  ctx.fillText('N', 0, -72);
  ctx.fillText('S', 0, 80);
  ctx.fillText('E', 76, 5);
  ctx.fillText('W', -76, 5);

  ctx.restore();

  // Map Provenance Stamp
  ctx.font = '14px monospace';
  ctx.fillStyle = 'rgba(201, 168, 91, 0.5)';
  ctx.textAlign = 'left';
  ctx.fillText('ZENTRICS FINANCIAL INTELLIGENCE · 3D GEOGRAPHIC GRID', 40, CANVAS_SIZE - 40);
  ctx.fillText('SPATIAL PROJECTION: WGS84 / 3D TOPOLOGY MESH', 40, CANVAS_SIZE - 20);

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}
