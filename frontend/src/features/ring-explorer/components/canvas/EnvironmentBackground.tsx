import { useMemo } from 'react';
import * as THREE from 'three';

export function EnvironmentBackground() {
  // Generate random ambient star particles
  const particleCount = 200;
  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);

    const emerald = new THREE.Color('#00C878');
    const gold = new THREE.Color('#C9A85B');
    const darkMuted = new THREE.Color('#10251B');

    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60;

      const mixed = Math.random() > 0.6 ? emerald : Math.random() > 0.3 ? gold : darkMuted;
      col[i * 3] = mixed.r;
      col[i * 3 + 1] = mixed.g;
      col[i * 3 + 2] = mixed.b;
    }
    return [pos, col];
  }, []);

  return (
    <group>
      {/* Subtle depth starfield */}
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
          size={0.12}
          vertexColors
          transparent
          opacity={0.35}
          sizeAttenuation
        />
      </points>

      {/* Primary Cybernetic Forensic Grid Floor */}
      <gridHelper
        args={[44, 28, '#C9A85B', '#112D22']}
        position={[0, -3.2, 0]}
      />

      {/* Axis separator lines (gold centerline) */}
      <mesh position={[0, -3.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.08, 30]} />
        <meshBasicMaterial color="#C9A85B" transparent opacity={0.65} />
      </mesh>
      <mesh position={[0, -3.18, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[0.08, 44]} />
        <meshBasicMaterial color="#C9A85B" transparent opacity={0.65} />
      </mesh>
    </group>
  );
}
