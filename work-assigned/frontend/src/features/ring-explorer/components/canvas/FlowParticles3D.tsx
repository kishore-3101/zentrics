import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { TransactionEdgeData } from '../../../../types/ring-graph';

interface FlowParticles3DProps {
  edges: TransactionEdgeData[];
  nodePositions: Map<string, [number, number, number]>;
  activeTxnIds: Set<string>;
  speedMultiplier?: number;
}

export function FlowParticles3D({
  edges,
  nodePositions,
  activeTxnIds,
  speedMultiplier = 1,
}: FlowParticles3DProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Filter edges that have valid src and dst positions
  const validEdges = useMemo(() => {
    return edges
      .map((e) => {
        const src = nodePositions.get(e.src_account);
        const dst = nodePositions.get(e.dst_account);
        if (!src || !dst) return null;

        const v0 = new THREE.Vector3(...src);
        const v2 = new THREE.Vector3(...dst);
        const mid = new THREE.Vector3().addVectors(v0, v2).multiplyScalar(0.5);
        mid.y += Math.min(2.5, v0.distanceTo(v2) * 0.22);

        return {
          edge: e,
          curve: new THREE.QuadraticBezierCurve3(v0, mid, v2),
          isCashOut: e.channel === 'ATM_WITHDRAWAL',
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [edges, nodePositions]);

  // Particle count: 2 particles per edge
  const particleCount = validEdges.length * 2;
  const progressRefs = useRef<Float32Array>(new Float32Array(particleCount));

  // Initialize offset progress
  useMemo(() => {
    const arr = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      arr[i] = (i % 2) * 0.5;
    }
    progressRefs.current = arr;
  }, [particleCount]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    if (!meshRef.current || validEdges.length === 0) return;

    const progresses = progressRefs.current;
    const baseSpeed = 0.45 * speedMultiplier;

    let index = 0;
    validEdges.forEach((item) => {
      const isActive = activeTxnIds.size === 0 || activeTxnIds.has(item.edge.txn_id);

      for (let p = 0; p < 2; p++) {
        // Advance particle progress
        progresses[index] = (progresses[index] + delta * baseSpeed) % 1.0;
        const t = progresses[index];

        if (isActive) {
          const pt = item.curve.getPoint(t);
          dummy.position.set(pt.x, pt.y, pt.z);
          dummy.scale.setScalar(item.isCashOut ? 1.4 : 1.0);
        } else {
          // Collapse inactive particles
          dummy.scale.setScalar(0);
        }

        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(index, dummy.matrix);
        index++;
      }
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (particleCount === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, particleCount]}
    >
      <sphereGeometry args={[0.12, 8, 8]} />
      <meshBasicMaterial color="#E5C778" />
    </instancedMesh>
  );
}
