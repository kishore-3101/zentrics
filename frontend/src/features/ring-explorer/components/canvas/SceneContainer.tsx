import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useMemo, useRef } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { AccountNodeData, TransactionEdgeData } from '../../../../types/ring-graph';
import type { GeoCityCoordinate } from '../../types/geo';
import { resolveCityCoord } from '../../utils/geoData';
import { AccountNode3D } from './AccountNode3D';
import { EnvironmentBackground } from './EnvironmentBackground';
import { FlowParticles3D } from './FlowParticles3D';
import { GeographicSurface3D } from './GeographicSurface3D';
import { TransactionEdge3D } from './TransactionEdge3D';

interface SceneContainerProps {
  nodes: AccountNodeData[];
  edges: TransactionEdgeData[];
  selectedNode: AccountNodeData | null;
  selectedEdge: TransactionEdgeData | null;
  selectedCity?: GeoCityCoordinate | null;
  onSelectNode: (node: AccountNodeData) => void;
  onSelectEdge: (edge: TransactionEdgeData) => void;
  onSelectCity?: (city: GeoCityCoordinate) => void;
  showLabels: boolean;
  activeTxnIds: Set<string>;
  speedMultiplier?: number;
  cameraPreset?: string | null;
}

function CameraPresetHandler({
  preset,
  selectedNode,
}: {
  preset?: string | null;
  selectedNode: AccountNodeData | null;
}) {
  const { camera } = useThree();
  const controls = useThree((state) => state.controls as OrbitControlsImpl | null);

  useEffect(() => {
    if (!controls) return;

    if (selectedNode) {
      // Smoothly focus camera on selected account node
      const [nx, ny, nz] = selectedNode.position;
      gsap.to(camera.position, {
        x: nx + 3.5,
        y: ny + 4.5,
        z: nz + 6.5,
        duration: 1.2,
        ease: 'power2.out',
      });
      gsap.to(controls.target, {
        x: nx,
        y: ny,
        z: nz,
        duration: 1.2,
        ease: 'power2.out',
      });
      return;
    }

    if (!preset) return;

    let targetCam = [0, 20, 24];
    let targetLook = [0, 0, 2];

    if (preset === 'south') {
      targetCam = [1.2, 12, 14];
      targetLook = [0.5, 1.2, 7.5];
    } else if (preset === 'north') {
      targetCam = [-1.5, 12, -1.5];
      targetLook = [-1.5, 1.2, -6];
    } else if (preset === 'mumbai') {
      targetCam = [-4.5, 12, 7];
      targetLook = [-5, 1.2, 1.8];
    } else if (preset === 'kolkata') {
      targetCam = [9.5, 12, 4];
      targetLook = [9.0, 1.2, -1.5];
    } else if (preset === 'dubai') {
      targetCam = [-19, 12, 2];
      targetLook = [-21, 1.2, -3.8];
    }

    gsap.to(camera.position, {
      x: targetCam[0],
      y: targetCam[1],
      z: targetCam[2],
      duration: 1.2,
      ease: 'power2.out',
    });
    gsap.to(controls.target, {
      x: targetLook[0],
      y: targetLook[1],
      z: targetLook[2],
      duration: 1.2,
      ease: 'power2.out',
    });
  }, [preset, selectedNode, camera, controls]);

  return null;
}

export function SceneContainer({
  nodes,
  edges,
  selectedNode,
  selectedEdge,
  selectedCity,
  onSelectNode,
  onSelectEdge,
  onSelectCity,
  showLabels,
  activeTxnIds,
  speedMultiplier = 1,
  cameraPreset,
}: SceneContainerProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  // Map of account_id -> 3D position
  const nodePositionMap = useMemo(() => {
    const map = new Map<string, [number, number, number]>();
    nodes.forEach((n) => map.set(n.account_id, n.position));
    return map;
  }, [nodes]);

  // Set of active city IDs from currently visible nodes
  const activeCityIds = useMemo(() => {
    const set = new Set<string>();
    nodes.forEach((n) => {
      const coord = resolveCityCoord(n.city_cluster, n.account_id);
      set.add(coord.id);
    });
    return set;
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
    <div className="relative h-full w-full select-none bg-[#030A06]">
      <Canvas
        camera={{ position: [0, 20, 24], fov: 44 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
        onPointerMissed={() => {
          // Clicking empty canvas space
        }}
      >
        {/* Atmosphere & Lighting */}
        <color attach="background" args={['#030A06']} />
        <ambientLight intensity={0.9} color="#EAFFF4" />
        <directionalLight position={[10, 24, 12]} intensity={1.4} color="#FFFFFF" />
        <pointLight position={[-12, 16, 6]} intensity={1.8} color="#C9A85B" distance={50} />
        <pointLight position={[12, 14, -8]} intensity={1.4} color="#00C878" distance={45} />

        {/* Orbit Camera Controls with Tilt Bounds */}
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.06}
          minDistance={5}
          maxDistance={70}
          maxPolarAngle={Math.PI / 2 - 0.05} // Keep camera above the geographical map ground
        />

        {/* Camera Preset Handler */}
        <CameraPresetHandler preset={cameraPreset} selectedNode={selectedNode} />

        {/* Cyber Atmosphere Starfield */}
        <EnvironmentBackground />

        {/* 3D Real Geographical Surface underneath the network */}
        <GeographicSurface3D
          activeCityIds={activeCityIds}
          onSelectCity={onSelectCity}
          selectedCityId={selectedCity?.id}
        />

        {/* 3D Curved Transaction Edges connecting geographical locations */}
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

        {/* Moving Money Flow Particles traveling along real geographical paths */}
        <FlowParticles3D
          edges={edges}
          nodePositions={nodePositionMap}
          activeTxnIds={activeTxnIds}
          speedMultiplier={speedMultiplier}
        />

        {/* Glowing 3D Account Nodes hovering above their real-world cities */}
        {nodes.map((node) => {
          const isSelected = selectedNode?.account_id === node.account_id;
          const isHighlighted = connectedAccountIds.has(node.account_id);

          return (
            <AccountNode3D
              key={node.account_id}
              node={node}
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
