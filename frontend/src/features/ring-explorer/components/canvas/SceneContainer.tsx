import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { AccountNodeData, TransactionEdgeData } from '../../../../types/ring-graph';
import { AccountNode3D } from './AccountNode3D';
import { EnvironmentBackground } from './EnvironmentBackground';
import { FlowParticles3D } from './FlowParticles3D';
import { TransactionEdge3D } from './TransactionEdge3D';

interface SceneContainerProps {
  nodes: AccountNodeData[];
  edges: TransactionEdgeData[];
  selectedNode: AccountNodeData | null;
  selectedEdge: TransactionEdgeData | null;
  onSelectNode: (node: AccountNodeData) => void;
  onSelectEdge: (edge: TransactionEdgeData) => void;
  showLabels: boolean;
  activeTxnIds: Set<string>;
  speedMultiplier?: number;
}

export function SceneContainer({
  nodes,
  edges,
  selectedNode,
  selectedEdge,
  onSelectNode,
  onSelectEdge,
  showLabels,
  activeTxnIds,
  speedMultiplier = 1,
}: SceneContainerProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  // Map of account_id -> 3D position (with safe fallback coordinate resolution)
  const nodePositionMap = useMemo(() => {
    const map = new Map<string, [number, number, number]>();
    const roleDefaultPositions: Record<string, [number, number, number]> = {
      victim: [-8.0, 0.5, 0.0],
      collector: [-4.0, 2.5, 1.2],
      mule: [0.0, 0.0, -1.0],
      cash_out: [8.0, -1.5, 0.0],
    };
    nodes.forEach((n, idx) => {
      const pos: [number, number, number] =
        Array.isArray(n.position) && n.position.length === 3 && !n.position.some(isNaN)
          ? n.position
          : roleDefaultPositions[n.role] || [(idx - (nodes.length - 1) / 2) * 3.5, 0, 0];
      map.set(n.account_id, pos);
    });
    return map;
  }, [nodes]);

  // Set of account IDs directly connected to the currently selected node
  const connectedAccountIds = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const set = new Set<string>();
    edges.forEach((e) => {
      if (e.src_account === selectedNode.account_id) set.add(e.dst_account);
      if (e.dst_account === selectedNode.account_id) set.add(e.src_account);
    });
    return set;
  }, [selectedNode, edges]);

  return (
    <div className="relative h-full w-full select-none bg-[#07110D]">
      <Canvas
        camera={{ position: [0, 7, 24], fov: 46 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
        onPointerMissed={() => {
          // Clicking empty canvas space deselects
        }}
      >
        {/* Atmosphere & Ambient Lighting */}
        <color attach="background" args={['#07110D']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 16, 12]} intensity={1.2} color="#00C878" />
        <pointLight position={[-6, 10, 6]} intensity={1.6} color="#C9A85B" distance={30} />
        <pointLight position={[6, -4, 4]} intensity={0.9} color="#2FB5A6" distance={25} />

        {/* Orbit Camera Controls */}
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.06}
          minDistance={6}
          maxDistance={42}
          maxPolarAngle={Math.PI / 2 + 0.15}
        />

        {/* Cyber Environment Particles & Grid from first commit */}
        <EnvironmentBackground />

        {/* Transaction Edges */}
        {edges.map((edge) => {
          const srcPos = nodePositionMap.get(edge.src_account);
          const dstPos = nodePositionMap.get(edge.dst_account);
          if (!srcPos || !dstPos) return null;

          const isEdgeHighlighted =
            activeTxnIds.has(edge.txn_id) ||
            (selectedNode &&
              (edge.src_account === selectedNode.account_id ||
                edge.dst_account === selectedNode.account_id));

          return (
            <TransactionEdge3D
              key={edge.txn_id}
              edge={edge}
              srcPos={srcPos}
              dstPos={dstPos}
              isSelected={selectedEdge?.txn_id === edge.txn_id}
              isHighlighted={Boolean(isEdgeHighlighted)}
              onSelect={onSelectEdge}
            />
          );
        })}

        {/* Traveling Money Flow Particles */}
        <FlowParticles3D
          edges={edges}
          nodePositions={nodePositionMap}
          activeTxnIds={activeTxnIds}
          speedMultiplier={speedMultiplier}
        />

        {/* Account Nodes */}
        {nodes.map((node) => {
          const isSelected = selectedNode?.account_id === node.account_id;
          const isHighlighted = connectedAccountIds.has(node.account_id);
          const safeNode = {
            ...node,
            position: nodePositionMap.get(node.account_id) || [0, 0, 0],
          };

          return (
            <AccountNode3D
              key={node.account_id}
              node={safeNode}
              isSelected={isSelected}
              isHighlighted={isHighlighted}
              showLabels={showLabels}
              onSelect={onSelectNode}
            />
          );
        })}
      </Canvas>
    </div>
  );
}

export default SceneContainer;
