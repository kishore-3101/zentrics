import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import type { AccountNodeData } from '../../../../types/ring-graph';

interface AccountNode3DProps {
  node: AccountNodeData;
  isSelected: boolean;
  isHighlighted?: boolean;
  showLabels: boolean;
  onSelect: (node: AccountNodeData) => void;
}

const ROLE_COLORS: Record<AccountNodeData['role'], string> = {
  victim: '#00C878', // Emerald
  collector: '#C9A85B', // Antique Gold
  mule: '#F59E0B', // Warning Amber
  cash_out: '#EF4444', // Danger Crimson
};

export function AccountNode3D({
  node,
  isSelected,
  isHighlighted,
  showLabels,
  onSelect,
}: AccountNode3DProps) {
  const meshRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const color = ROLE_COLORS[node.role];
  const size = node.role === 'collector' ? 0.9 : node.role === 'cash_out' ? 0.8 : 0.65;

  // Gentle breathing and focus ring rotation
  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 1.5;
      ringRef.current.rotation.x += delta * 0.8;
    }
  });

  return (
    <group
      ref={meshRef}
      position={node.position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      {/* 1. Primary Node Geometry by Role */}
      {node.role === 'victim' && (
        <mesh scale={hovered ? 1.25 : isHighlighted ? 1.15 : 1.0}>
          <sphereGeometry args={[size, 24, 24]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={isHighlighted ? 0.6 : hovered ? 0.5 : 0.25}
            roughness={0.2}
            metalness={0.4}
          />
        </mesh>
      )}

      {node.role === 'collector' && (
        <mesh scale={hovered ? 1.25 : isHighlighted ? 1.15 : 1.0}>
          <octahedronGeometry args={[size, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={isHighlighted ? 0.8 : hovered ? 0.7 : 0.45}
            roughness={0.15}
            metalness={0.7}
          />
        </mesh>
      )}

      {node.role === 'mule' && (
        <group scale={hovered ? 1.25 : isHighlighted ? 1.15 : 1.0}>
          <mesh>
            <sphereGeometry args={[size, 20, 20]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={isHighlighted ? 0.7 : hovered ? 0.6 : 0.3}
              roughness={0.25}
              metalness={0.5}
            />
          </mesh>
          <mesh rotation={[Math.PI / 3, 0, 0]}>
            <torusGeometry args={[size * 1.35, 0.04, 12, 24]} />
            <meshBasicMaterial color={color} transparent opacity={0.65} />
          </mesh>
        </group>
      )}

      {node.role === 'cash_out' && (
        <mesh scale={hovered ? 1.25 : isHighlighted ? 1.15 : 1.0}>
          <boxGeometry args={[size * 1.3, size * 1.3, size * 1.3]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={isHighlighted ? 0.8 : hovered ? 0.7 : 0.4}
            roughness={0.3}
            metalness={0.6}
          />
        </mesh>
      )}

      {/* 2. Selection Focus Aura */}
      {isSelected && (
        <mesh ref={ringRef}>
          <torusGeometry args={[size * 1.8, 0.05, 16, 32]} />
          <meshBasicMaterial color="#E5C778" transparent opacity={0.85} />
        </mesh>
      )}

      {/* 2b. Autonomous AI Shield Quarantine Wireframe Sphere */}
      {(node.is_blocked || node.is_frozen) && (
        <mesh>
          <sphereGeometry args={[size * 1.6, 16, 16]} />
          <meshBasicMaterial color="#EF4444" wireframe transparent opacity={0.7} />
        </mesh>
      )}

      {/* 3. HTML Billboard Label (Toggleable) */}
      {showLabels && (
        <Html
          position={[0, size + 0.45, 0]}
          center
          distanceFactor={18}
          zIndexRange={[10, 0]}
        >
          <div className="pointer-events-none select-none flex items-center gap-1 rounded-md border border-gold/30 bg-canvas/85 px-1.5 py-0.5 shadow-lg backdrop-blur-xs">
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: (node.is_blocked || node.is_frozen) ? '#EF4444' : color }}
              aria-hidden
            />
            <span className="font-mono text-[10px] font-semibold text-ink">
              {node.account_id}
            </span>
            {(node.is_blocked || node.is_frozen) ? (
              <span className="rounded bg-danger/30 text-danger border border-danger/40 px-1 text-[8px] font-bold tracking-wider">
                FROZEN
              </span>
            ) : (
              <span
                className={`rounded px-1 text-[9px] font-mono font-bold ${
                  node.risk_score >= 80
                    ? 'bg-danger/25 text-danger'
                    : node.risk_score >= 60
                      ? 'bg-gold/25 text-gold-light'
                      : 'bg-emerald/25 text-emerald'
                }`}
              >
                {Math.round(node.risk_score)}
              </span>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}
