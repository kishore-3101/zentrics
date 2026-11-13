import { Line } from '@react-three/drei';
import { useMemo, useState } from 'react';
import * as THREE from 'three';
import type { TransactionEdgeData } from '../../../../types/ring-graph';

interface TransactionEdge3DProps {
  edge: TransactionEdgeData;
  srcPos: [number, number, number];
  dstPos: [number, number, number];
  isSelected: boolean;
  isHighlighted?: boolean;
  onSelect: (edge: TransactionEdgeData) => void;
}

export function TransactionEdge3D({
  edge,
  srcPos,
  dstPos,
  isSelected,
  isHighlighted,
  onSelect,
}: TransactionEdge3DProps) {
  const [hovered, setHovered] = useState(false);

  // Compute 3D Quadratic Bezier Curve and Arrow orientation
  const { curvePoints, arrowPos, arrowRot, hitGeometry } = useMemo(() => {
    const v0 = new THREE.Vector3(...srcPos);
    const v2 = new THREE.Vector3(...dstPos);

    // Compute arched control point
    const mid = new THREE.Vector3().addVectors(v0, v2).multiplyScalar(0.5);
    const dist = v0.distanceTo(v2);
    // Arc elevation upwards
    mid.y += Math.min(2.5, dist * 0.22);

    const curve = new THREE.QuadraticBezierCurve3(v0, mid, v2);
    const points = curve.getPoints(24);

    // Arrow positioning at 75% along trajectory
    const t = 0.72;
    const arrowPoint = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();

    // Orientation quaternion to align cone along tangent
    const up = new THREE.Vector3(0, 1, 0);
    const orientation = new THREE.Quaternion().setFromUnitVectors(up, tangent);
    const euler = new THREE.Euler().setFromQuaternion(orientation);

    // Hit-testing cylinder geometry along direct path
    const hitGeo = new THREE.CylinderGeometry(0.35, 0.35, dist, 6);

    return {
      curvePoints: points,
      arrowPos: [arrowPoint.x, arrowPoint.y, arrowPoint.z] as [number, number, number],
      arrowRot: [euler.x, euler.y, euler.z] as [number, number, number],
      hitGeometry: hitGeo,
    };
  }, [srcPos, dstPos]);

  // Stroke color logic
  const color = isSelected
    ? '#E5C778'
    : edge.channel === 'ATM_WITHDRAWAL'
      ? '#EF4444'
      : isHighlighted || hovered
        ? '#C9A85B'
        : '#2FB5A6';

  return (
    <group>
      {/* 1. Visible Curved 3D Line using Drei Line */}
      <Line
        points={curvePoints}
        color={color}
        lineWidth={isSelected ? 3 : hovered ? 2 : 1}
        transparent
        opacity={isSelected ? 1.0 : hovered ? 0.9 : isHighlighted ? 0.8 : 0.45}
      />

      {/* 2. Directional Arrow Cone */}
      <mesh position={arrowPos} rotation={arrowRot}>
        <coneGeometry args={[0.2, 0.45, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>

      {/* 3. Invisible Hit-Testing Cylinder for Hover/Click */}
      <mesh
        position={[
          (srcPos[0] + dstPos[0]) / 2,
          (srcPos[1] + dstPos[1]) / 2,
          (srcPos[2] + dstPos[2]) / 2,
        ]}
        geometry={hitGeometry}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(edge);
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
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}
