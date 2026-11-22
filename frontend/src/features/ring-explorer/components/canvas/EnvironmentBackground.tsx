import { useMemo } from 'react';
import * as THREE from 'three';

export function EnvironmentBackground() {
  // Generate random ambient star particles in deep space
  const particleCount = 280;
  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);

    const emerald = new THREE.Color('#00C878');
    const gold = new THREE.Color('#C9A85B');
    const darkMuted = new THREE.Color('#0E2E20');

    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 90;
      pos[i * 3 + 1] = 6 + Math.random() * 32; // Floating above the map in 3D atmosphere
      pos[i * 3 + 2] = (Math.random() - 0.5) * 70;

      const mixed = Math.random() > 0.6 ? emerald : Math.random() > 0.3 ? gold : darkMuted;
      col[i * 3] = mixed.r;
      col[i * 3 + 1] = mixed.g;
      col[i * 3 + 2] = mixed.b;
    }
    return [pos, col];
  }, []);

  return (
    <group>
      {/* Subtle atmospheric depth starfield */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[colors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.16}
          vertexColors
          transparent
          opacity={0.45}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
