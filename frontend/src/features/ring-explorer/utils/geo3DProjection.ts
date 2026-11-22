// Center reference point: Central India (near Nagpur)
export const GEO_CENTER_LON = 78.5;
export const GEO_CENTER_LAT = 21.0;
export const GEO_SCALE = 0.92; // 3D units per geographic degree

/**
 * Project latitude/longitude coordinates into 3D space:
 * - X corresponds to Longitude (West to East)
 * - Z corresponds to -Latitude (North is -Z, South is +Z)
 * - Y is elevation above the ground plane
 */
export function geoTo3D(
  lon: number,
  lat: number,
  elevation: number = 0,
): [number, number, number] {
  const x = (lon - GEO_CENTER_LON) * GEO_SCALE;
  const z = -(lat - GEO_CENTER_LAT) * GEO_SCALE;
  return [x, elevation, z];
}

/** Reverse projection: 3D [X, Z] back to [lon, lat] */
export function threeDtoGeo(x: number, z: number): [number, number] {
  const lon = x / GEO_SCALE + GEO_CENTER_LON;
  const lat = -z / GEO_SCALE + GEO_CENTER_LAT;
  return [lon, lat];
}
