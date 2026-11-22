import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Component, memo, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';

interface GlobeProps {
  reducedMotion?: boolean;
}

const GLOBE_RADIUS = 5.2;

// Major global financial hubs
const FINANCIAL_HUBS = [
  { name: 'Mumbai / Delhi', lat: 21.0, lon: 77.0, color: '#C9A85B' },
  { name: 'Dubai', lat: 25.2, lon: 55.3, color: '#E5C778' },
  { name: 'Singapore', lat: 1.35, lon: 103.8, color: '#00C878' },
  { name: 'Hong Kong', lat: 22.3, lon: 114.2, color: '#00C878' },
  { name: 'London', lat: 51.5, lon: -0.12, color: '#E5C778' },
  { name: 'Frankfurt / Zurich', lat: 48.5, lon: 9.0, color: '#00C878' },
  { name: 'New York', lat: 40.7, lon: -74.0, color: '#C9A85B' },
  { name: 'Tokyo', lat: 35.7, lon: 139.7, color: '#00C878' },
  { name: 'Sydney', lat: -33.8, lon: 151.2, color: '#00C878' },
];

// Hub connections representing cross-border remittance/offshore flight corridors
const HUB_CORRIDORS: [number, number][] = [
  [0, 1], // Mumbai -> Dubai
  [1, 4], // Dubai -> London
  [4, 6], // London -> New York
  [0, 2], // Mumbai -> Singapore
  [2, 3], // Singapore -> Hong Kong
  [3, 7], // Hong Kong -> Tokyo
  [4, 5], // London -> Frankfurt
  [2, 8], // Singapore -> Sydney
];

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

// Check if a coordinate is over approximate major landmasses
function isLikelyLand(lat: number, lon: number): boolean {
  // Eurasia
  if (lat >= 5 && lat <= 70 && lon >= -10 && lon <= 150) {
    if (lat >= 10 && lat <= 35 && lon >= 65 && lon <= 95) return true; // India / South Asia
    if (lat >= 20 && lat <= 45 && lon >= 35 && lon <= 60) return true; // Middle East
    if (lat >= 35 && lat <= 65 && lon >= -10 && lon <= 45) return true; // Europe
    if (lat >= 15 && lat <= 60 && lon >= 95 && lon <= 145) return true; // East Asia
    return Math.random() < 0.65;
  }
  // Africa
  if (lat >= -35 && lat <= 37 && lon >= -18 && lon <= 52) {
    return Math.random() < 0.7;
  }
  // North America
  if (lat >= 15 && lat <= 70 && lon >= -165 && lon <= -55) {
    return Math.random() < 0.68;
  }
  // South America
  if (lat >= -55 && lat <= 12 && lon >= -82 && lon <= -34) {
    return Math.random() < 0.65;
  }
  // Australia
  if (lat >= -42 && lat <= -11 && lon >= 112 && lon <= 154) {
    return Math.random() < 0.72;
  }
  return false;
}

function GlobeScene({ reducedMotion }: GlobeProps) {
  const globeGroupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const pulsesRef = useRef<THREE.Points>(null);
  const terrainRef = useRef<THREE.Points>(null);

  // 1. Generate Emerald Dotted World Map
  const { pointPositions, pointColors } = useMemo(() => {
    const coords: number[] = [];
    const colors: number[] = [];
    const colorEmerald = new THREE.Color('#00C878');
    const colorGold = new THREE.Color('#C9A85B');

    const totalSamples = 3400;
    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    for (let i = 0; i < totalSamples; i++) {
      const theta = (2 * Math.PI * i) / goldenRatio;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / totalSamples);

      const lat = 90 - (phi * 180) / Math.PI;
      const lon = ((theta * 180) / Math.PI) % 360 - 180;

      if (isLikelyLand(lat, lon)) {
        const v = latLonToVector3(lat, lon, GLOBE_RADIUS);
        coords.push(v.x, v.y, v.z);

        // Highlight occasional economic hubs with gold tone
        if (Math.random() < 0.08) {
          colors.push(colorGold.r, colorGold.g, colorGold.b);
        } else {
          colors.push(colorEmerald.r, colorEmerald.g, colorEmerald.b);
        }
      }
    }

    return {
      pointPositions: new Float32Array(coords),
      pointColors: new Float32Array(colors),
    };
  }, []);

  // 2. Generate Fine Longitude & Latitude Wireframe Lines
  const gridLines = useMemo(() => {
    const lines: THREE.LineSegments[] = [];
    const lineMat = new THREE.LineBasicMaterial({
      color: '#00C878',
      transparent: true,
      opacity: 0.16,
    });

    // Parallels (latitudes)
    const latitudes = [-60, -30, 0, 30, 60];
    for (const lat of latitudes) {
      const points: THREE.Vector3[] = [];
      for (let lon = -180; lon <= 180; lon += 5) {
        points.push(latLonToVector3(lat, lon, GLOBE_RADIUS * 1.002));
      }
      const geom = new THREE.BufferGeometry().setFromPoints(points);
      lines.push(new THREE.LineSegments(geom, lineMat));
    }

    // Meridians (longitudes)
    for (let lon = -180; lon < 180; lon += 30) {
      const points: THREE.Vector3[] = [];
      for (let lat = -80; lat <= 80; lat += 5) {
        points.push(latLonToVector3(lat, lon, GLOBE_RADIUS * 1.002));
      }
      const geom = new THREE.BufferGeometry().setFromPoints(points);
      lines.push(new THREE.LineSegments(geom, lineMat));
    }

    return lines;
  }, []);

  // 3. Generate 3D Arcs between Financial Hubs
  const { arcCurves, arcGeometries } = useMemo(() => {
    const curves: THREE.QuadraticBezierCurve3[] = [];
    const geometries: THREE.BufferGeometry[] = [];

    HUB_CORRIDORS.forEach(([srcIdx, dstIdx]) => {
      const p1 = latLonToVector3(FINANCIAL_HUBS[srcIdx].lat, FINANCIAL_HUBS[srcIdx].lon, GLOBE_RADIUS);
      const p2 = latLonToVector3(FINANCIAL_HUBS[dstIdx].lat, FINANCIAL_HUBS[dstIdx].lon, GLOBE_RADIUS);

      // Midpoint elevated above sphere to create graceful great-circle arch
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const distance = p1.distanceTo(p2);
      mid.normalize().multiplyScalar(GLOBE_RADIUS + Math.min(2.0, distance * 0.35));

      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
      curves.push(curve);

      const pts = curve.getPoints(36);
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      geometries.push(geom);
    });

    return { arcCurves: curves, arcGeometries: geometries };
  }, []);

  // 4. Undulating Cyber Particle Terrain Wave (Bottom landscape from reference)
  const { terrainPositions, terrainInitialY } = useMemo(() => {
    const cols = 55;
    const rows = 24;
    const coords: number[] = [];
    const initY: number[] = [];

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = (i - cols / 2) * 0.45;
        const z = (j - rows / 2) * 0.45 - 2;
        const y = -5.8 + Math.sin(x * 0.4) * 0.6 + Math.cos(z * 0.5) * 0.4;

        coords.push(x, y, z);
        initY.push(y);
      }
    }

    return {
      terrainPositions: new Float32Array(coords),
      terrainInitialY: initY,
    };
  }, []);

  // Pulses traveling along arcs
  const pulsePositions = useMemo(() => {
    const positions = new Float32Array(arcCurves.length * 3);
    return positions;
  }, [arcCurves.length]);

  // Animation Loop with clean cleanup and reduced-motion handling
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Subtle continuous idle rotation
    if (globeGroupRef.current && !reducedMotion) {
      globeGroupRef.current.rotation.y = t * 0.07;
    }

    // Animate light pulses along the arcs
    if (pulsesRef.current && !reducedMotion) {
      const posAttr = pulsesRef.current.geometry.attributes.position;
      arcCurves.forEach((curve, i) => {
        const speed = 0.4 + (i % 3) * 0.15;
        const progress = (t * speed + i * 0.25) % 1;
        const point = curve.getPoint(progress);
        posAttr.setXYZ(i, point.x, point.y, point.z);
      });
      posAttr.needsUpdate = true;
    }

    // Animate bottom undulating particle terrain wave
    if (terrainRef.current && !reducedMotion) {
      const posAttr = terrainRef.current.geometry.attributes.position;
      const count = posAttr.count;
      for (let i = 0; i < count; i++) {
        const x = posAttr.getX(i);
        const z = posAttr.getZ(i);
        const wave = Math.sin(x * 0.5 + t * 1.2) * 0.35 + Math.cos(z * 0.4 + t * 0.9) * 0.25;
        posAttr.setY(i, terrainInitialY[i] + wave);
      }
      posAttr.needsUpdate = true;
    }
  });

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} color="#00C878" />
      <directionalLight position={[10, 15, 12]} intensity={1.2} color="#E6E9DF" />
      <pointLight position={[-12, -8, -10]} intensity={0.6} color="#00C878" />
      <pointLight position={[0, -6, 10]} intensity={0.8} color="#C9A85B" />

      {/* Rotating Globe Group */}
      <group ref={globeGroupRef} position={[0, 0.4, 0]}>
        {/* Core Transparent Dark Sphere */}
        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS * 0.992, 48, 48]} />
          <meshStandardMaterial
            color="#04120B"
            transparent
            opacity={0.65}
            roughness={0.7}
            metalness={0.15}
          />
        </mesh>

        {/* Soft Atmospheric Glow Layer */}
        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS * 1.035, 32, 32]} />
          <meshBasicMaterial
            color="#00C878"
            transparent
            opacity={0.07}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* Emerald Dotted Landmass Points */}
        <points ref={particlesRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[pointPositions, 3]}
            />
            <bufferAttribute
              attach="attributes-color"
              args={[pointColors, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.075}
            vertexColors
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
          />
        </points>

        {/* Lat/Lon Wireframe Grid Lines */}
        {gridLines.map((line, idx) => (
          <primitive key={idx} object={line} />
        ))}

        {/* Financial Hub Markers */}
        {FINANCIAL_HUBS.map((hub, idx) => {
          const pos = latLonToVector3(hub.lat, hub.lon, GLOBE_RADIUS * 1.008);
          return (
            <group key={idx} position={[pos.x, pos.y, pos.z]}>
              <mesh>
                <sphereGeometry args={[0.09, 16, 16]} />
                <meshBasicMaterial color={hub.color || '#C9A85B'} />
              </mesh>
              <mesh>
                <ringGeometry args={[0.12, 0.17, 16]} />
                <meshBasicMaterial
                  color={hub.color || '#C9A85B'}
                  transparent
                  opacity={0.6}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          );
        })}

        {/* Financial Arc Corridors */}
        {arcGeometries.map((geom, idx) => (
          <primitive
            key={`arc-${idx}`}
            object={
              new THREE.Line(
                geom,
                new THREE.LineBasicMaterial({
                  color: idx % 2 === 0 ? '#C9A85B' : '#00C878',
                  transparent: true,
                  opacity: 0.32,
                }),
              )
            }
          />
        ))}

        {/* Traveling Light Pulses along Arcs */}
        <points ref={pulsesRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[pulsePositions, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.22}
            color="#FFE6A3"
            transparent
            opacity={0.95}
            blending={THREE.AdditiveBlending}
          />
        </points>
      </group>

      {/* Undulating Particle Terrain Mesh (Bottom Horizon) */}
      <points ref={terrainRef} position={[0, -0.6, 0]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[terrainPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.065}
          color="#00C878"
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Interactive Orbit & Touch Controls */}
      <OrbitControls
        enablePan={false}
        minDistance={10}
        maxDistance={24}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.5}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.65}
      />
    </>
  );
}

// Graceful WebGL Error Boundary Fallback
interface ErrorBoundaryState {
  hasError: boolean;
}

class WebGLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: unknown) {
    console.warn('Globe3D WebGL initialization fallback activated:', err);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function FallbackStaticGlobe() {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
      <div className="size-[580px] rounded-full border border-emerald/25 bg-radial from-emerald/10 via-[#07110D]/60 to-transparent shadow-[0_0_80px_rgba(0,200,120,0.18)]" />
      <div className="absolute size-[640px] rounded-full border border-gold/15 animate-spin duration-[45000ms]" />
    </div>
  );
}

export const Globe3DBackground = memo(function Globe3DBackground() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="absolute inset-0 select-none overflow-hidden bg-[#030A06]">
      {/* Cinematic Ambient Glow & Vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_38%,transparent_20%,#030A06_82%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[820px] rounded-full bg-[radial-gradient(circle,rgba(0,200,120,0.12),transparent_70%)] blur-2xl"
      />

      <WebGLErrorBoundary fallback={<FallbackStaticGlobe />}>
        <Canvas
          camera={{ position: [0, 0, 16], fov: 42 }}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
          }}
          className="h-full w-full"
        >
          <GlobeScene reducedMotion={reducedMotion} />
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
});
