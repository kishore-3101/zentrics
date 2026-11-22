import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { memo, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GeoCityCoordinate } from '../../types/geo';
import {
  CITY_COORDINATES,
  createGeographicLinesGeometry,
  geoTo3D,
} from '../../utils/geo3DData';
import {
  generateGeoMapTexture,
  MAP_PLANE_HEIGHT,
  MAP_PLANE_WIDTH,
} from '../../utils/geo3DTexture';

interface GeographicSurface3DProps {
  activeCityIds?: Set<string>;
  onSelectCity?: (city: GeoCityCoordinate) => void;
  selectedCityId?: string | null;
}

export const GeographicSurface3D = memo(function GeographicSurface3D({
  activeCityIds,
  onSelectCity,
  selectedCityId,
}: GeographicSurface3DProps) {
  const radarRef = useRef<THREE.Mesh>(null);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);

  // 1. Generate the 2048x2048 High-Resolution Tactical Canvas Texture
  const geoTexture = useMemo(() => generateGeoMapTexture(), []);

  // 2. Generate 3D Vector Line Geometry for crisp borders
  const linesGeometry = useMemo(() => createGeographicLinesGeometry(), []);

  // 3. Collect active city coordinates
  const displayedCities = useMemo(() => {
    return Object.values(CITY_COORDINATES).filter((c) => {
      if (!activeCityIds || activeCityIds.size === 0) return true;
      return activeCityIds.has(c.id);
    });
  }, [activeCityIds]);

  // Subtle pulsing animation on city ground beacons
  useFrame(({ clock }) => {
    if (radarRef.current) {
      const t = clock.getElapsedTime();
      const s = 1.0 + Math.sin(t * 2.5) * 0.15;
      radarRef.current.scale.set(s, s, 1);
    }
  });

  return (
    <group position={[0, -0.02, 0]}>
      {/* 1. Primary Geographical Map Ground Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[MAP_PLANE_WIDTH, MAP_PLANE_HEIGHT]} />
        <meshBasicMaterial map={geoTexture} />
      </mesh>

      {/* 2. Sharp 3D Vector Line Overlay for State & Country Boundaries */}
      <lineSegments geometry={linesGeometry}>
        <lineBasicMaterial
          color="#00C878"
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </lineSegments>

      {/* 3. Subtle Cybernetic Grid Helper over Ocean Margins */}
      <gridHelper
        args={[60, 30, '#C9A85B', '#091B13']}
        position={[0, 0.01, 0]}
      />

      {/* 4. Tactical City Anchors: Vertical Projection Laser Pillars & Radar Discs */}
      {displayedCities.map((city) => {
        const [x, , z] = geoTo3D(city.lon, city.lat, 0);
        const isSelected = selectedCityId === city.id;
        const isHovered = hoveredCity === city.id;

        return (
          <group key={city.id} position={[x, 0, z]}>
            {/* Ground Radar Pulse Ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
              <ringGeometry args={[0.3, 0.6, 24]} />
              <meshBasicMaterial
                color={isSelected ? '#E5C778' : isHovered ? '#C9A85B' : '#00C878'}
                transparent
                opacity={isSelected ? 0.9 : isHovered ? 0.8 : 0.45}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Inner Ground Anchor Dot */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
              <circleGeometry args={[0.15, 16]} />
              <meshBasicMaterial
                color={isSelected ? '#FFF8D6' : '#00C878'}
              />
            </mesh>

            {/* Vertical Laser Projection Guide Beam (Ground up to floating nodes) */}
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[new Float32Array([0, 0.02, 0, 0, 1.8, 0]), 3]}
                />
              </bufferGeometry>
              <lineBasicMaterial
                color={isSelected ? '#E5C778' : '#00C878'}
                transparent
                opacity={isSelected ? 0.65 : 0.25}
              />
            </line>

            {/* 3D Tactical City Label using Drei Html */}
            <Html
              position={[0, 0.1, 0]}
              distanceFactor={32}
              center
              className="pointer-events-auto select-none"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCity?.(city);
                }}
                onPointerOver={() => setHoveredCity(city.id)}
                onPointerOut={() => setHoveredCity(null)}
                className={`group flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-mono tracking-tight transition-all backdrop-blur-md shadow-lg ${
                  isSelected
                    ? 'border-gold bg-[#0B1812]/95 text-gold-light shadow-glow-gold'
                    : isHovered
                      ? 'border-gold/70 bg-[#0B1812]/90 text-gold-light'
                      : 'border-emerald/40 bg-[#07110D]/85 text-ink/80 hover:border-gold hover:text-gold-light'
                }`}
              >
                <span className="font-bold uppercase tracking-wider">{city.city}</span>
                {city.state && (
                  <span className="text-[8px] text-muted/70 hidden sm:inline">
                    · {city.state.split(' ')[0]}
                  </span>
                )}
              </button>
            </Html>
          </group>
        );
      })}
    </group>
  );
});

export default GeographicSurface3D;
