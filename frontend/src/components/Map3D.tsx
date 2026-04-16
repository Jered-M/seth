import React, { useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Text } from '@react-three/drei';
import * as THREE from 'three';

interface EquipmentPosition {
    id: string;
    name: string;
    type: string;
    lat: number;
    lng: number;
    status: string;
}

interface Map3DProps {
    equipments: EquipmentPosition[];
}

// Equipment Marker Cube
const EquipmentCube: React.FC<{
    equipment: EquipmentPosition;
    position: [number, number, number];
}> = ({ equipment, position }) => {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame(() => {
        if (meshRef.current) {
            meshRef.current.rotation.y += 0.01;
            meshRef.current.position.y = Math.sin(Date.now() * 0.002) * 0.2 + 0.3;
        }
    });

    const statusColor =
        equipment.status === 'AVAILABLE'
            ? '#10b981'
            : equipment.status === 'BUSY'
                ? '#f59e0b'
                : '#ef4444';

    return (
        <group position={position}>
            {/* Main cube */}
            <mesh ref={meshRef}>
                <boxGeometry args={[0.3, 0.3, 0.3]} />
                <meshStandardMaterial
                    color={statusColor}
                    metalness={0.7}
                    roughness={0.2}
                />
            </mesh>

            {/* Glow sphere */}
            <mesh>
                <sphereGeometry args={[0.5, 16, 16]} />
                <meshStandardMaterial
                    color={statusColor}
                    transparent
                    opacity={0.1}
                />
            </mesh>

            {/* Point light */}
            <pointLight intensity={0.8} color={statusColor} distance={2} />

            {/* Connector to ground */}
            <mesh position={[0, -0.3, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 0.6]} />
                <meshBasicMaterial color={statusColor} transparent opacity={0.5} />
            </mesh>

            {/* Label */}
            <Text
                position={[0, 0.8, 0]}
                fontSize={0.12}
                color="white"
                anchorX="center"
                anchorY="bottom"
                maxWidth={0.6}
            >
                {equipment.name.substring(0, 12)}
            </Text>
        </group>
    );
};

// 3D Scene Content
const Scene3DContent: React.FC<Map3DProps> = ({ equipments }) => {
    const referenceCenter = React.useMemo(() => {
        if (!equipments.length) {
            return { lat: 48.8566, lng: 2.3522 };
        }

        const latSum = equipments.reduce((acc, eq) => acc + eq.lat, 0);
        const lngSum = equipments.reduce((acc, eq) => acc + eq.lng, 0);
        return {
            lat: latSum / equipments.length,
            lng: lngSum / equipments.length,
        };
    }, [equipments]);

    const getPosition = (lat: number, lng: number): [number, number, number] => {
        const scale = 50;
        const x = (lng - referenceCenter.lng) * scale;
        const z = (lat - referenceCenter.lat) * scale;
        return [x, 0, z];
    };

    return (
        <>
            <color attach="background" args={['#0f172a']} />

            {/* Lighting */}
            <ambientLight intensity={0.7} />
            <directionalLight
                position={[15, 20, 10]}
                intensity={1.2}
                castShadow
            />
            <pointLight position={[-10, 5, -10]} intensity={0.6} />

            {/* Environment */}
            <Environment preset="night" />

            {/* Controls */}
            <OrbitControls autoRotate autoRotateSpeed={1.5} />

            {/* Ground plane */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
                <planeGeometry args={[100, 100]} />
                <meshStandardMaterial color="#1e293b" metalness={0.1} roughness={0.8} />
            </mesh>

            {/* Ground grid */}
            <gridHelper args={[100, 40]} position={[0, -0.49, 0]} />

            {/* Equipments */}
            {equipments.map((eq) => (
                <EquipmentCube
                    key={eq.id}
                    equipment={eq}
                    position={getPosition(eq.lat, eq.lng)}
                />
            ))}
        </>
    );
};

const LoadingFallback = () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-white font-medium">Chargement de la vue 3D...</p>
        </div>
    </div>
);

const Map3D: React.FC<Map3DProps> = ({ equipments }) => {
    return (
        <div className="w-full h-[600px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-slate-900 relative">
            <Suspense fallback={<LoadingFallback />}>
                <Canvas
                    camera={{ position: [20, 15, 20], fov: 50 }}
                    gl={{ antialias: true }}
                >
                    <Scene3DContent equipments={equipments} />
                </Canvas>
            </Suspense>

            {/* Info badge */}
            <div className="absolute bottom-4 right-4 z-10 bg-black/60 backdrop-blur-sm text-white px-4 py-3 rounded-lg text-xs border border-gray-700">
                <p className="font-semibold text-blue-400">{equipments.length} équipements</p>
                <p className="text-gray-300 text-[10px]">Souris: rotation | Scroll: zoom</p>
            </div>
        </div>
    );
};

export default Map3D;
