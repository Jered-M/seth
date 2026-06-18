import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import Map, { Marker, NavigationControl, type MapRef } from 'react-map-gl/maplibre';
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface EquipmentPosition3D {
    id: string;
    name: string;
    type: string;
    lat: number;
    lng: number;
    status: string;
    accuracy?: number | null;
}

interface Map3DProps {
    equipments: EquipmentPosition3D[];
    focusTarget?: { id: string; lat: number; lng: number; tick: number } | null;
    selectedId?: string | null;
}

const DEFAULT_CENTER = { lat: -11.6667, lng: 27.4833 };

/** Tuiles vectorielles OpenFreeMap — gratuit, sans clé API */
const MAP_STYLE: StyleSpecification = {
    version: 8,
    sources: {
        openmaptiles: {
            type: 'vector',
            url: 'https://tiles.openfreemap.org/planet',
        },
        terrain: {
            type: 'raster-dem',
            url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
            tileSize: 256,
        },
    },
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    layers: [
        {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#0a0f1d' },
        },
        {
            id: 'landuse',
            type: 'fill',
            source: 'openmaptiles',
            'source-layer': 'landuse',
            paint: { 'fill-color': '#0d1321', 'fill-opacity': 0.55 },
        },
        {
            id: 'water',
            type: 'fill',
            source: 'openmaptiles',
            'source-layer': 'water',
            paint: { 'fill-color': '#0c1929' },
        },
        {
            id: 'road-casing',
            type: 'line',
            source: 'openmaptiles',
            'source-layer': 'transportation',
            filter: ['==', ['geometry-type'], 'LineString'],
            paint: {
                'line-color': '#0f172a',
                'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 7],
            },
        },
        {
            id: 'roads',
            type: 'line',
            source: 'openmaptiles',
            'source-layer': 'transportation',
            filter: ['==', ['geometry-type'], 'LineString'],
            paint: {
                'line-color': [
                    'match',
                    ['get', 'class'],
                    'motorway',
                    '#475569',
                    'trunk',
                    '#475569',
                    'primary',
                    '#334155',
                    'secondary',
                    '#1e293b',
                    '#1e293b',
                ],
                'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 16, 5],
            },
        },
        {
            id: 'building-3d',
            type: 'fill-extrusion',
            source: 'openmaptiles',
            'source-layer': 'building',
            minzoom: 13,
            paint: {
                'fill-extrusion-color': [
                    'interpolate',
                    ['linear'],
                    ['coalesce', ['get', 'render_height'], ['get', 'height'], 12],
                    0,
                    '#1e3a5f',
                    20,
                    '#2563eb',
                    60,
                    '#4299e1',
                ],
                'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 12],
                'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
                'fill-extrusion-opacity': 0.78,
            },
        },
    ],
};

function statusColor(status: string): string {
    if (status === 'AVAILABLE' || status === 'ONLINE') return '#10b981';
    if (status === 'ASSIGNED' || status === 'BUSY' || status === 'IN_USE') return '#3b82f6';
    if (status === 'MAINTENANCE' || status === 'OUT') return '#f59e0b';
    return '#ef4444';
}

function setupMapLibre3DScene(map: MapLibreMap) {
    map.setTerrain({ source: 'terrain', exaggeration: 1.25 });

    if (!map.getLayer('seth-sky')) {
        map.addLayer({
            id: 'seth-sky',
            type: 'sky',
            paint: {
                'sky-type': 'atmosphere',
                'sky-atmosphere-sun': [0.0, 90.0],
                'sky-atmosphere-sun-intensity': 10,
            },
        } as unknown as Parameters<MapLibreMap['addLayer']>[0]);
    }
}

const Map3D: React.FC<Map3DProps> = ({ equipments, focusTarget, selectedId }) => {
    const mapRef = useRef<MapRef>(null);

    const center = useMemo(() => {
        if (!equipments.length) return DEFAULT_CENTER;
        const lat = equipments.reduce((a, e) => a + e.lat, 0) / equipments.length;
        const lng = equipments.reduce((a, e) => a + e.lng, 0) / equipments.length;
        return { lat, lng };
    }, [equipments]);

    const initialViewState = useMemo(
        () => ({
            latitude: center.lat,
            longitude: center.lng,
            zoom: 16,
            pitch: 58,
            bearing: -24,
        }),
        [center.lat, center.lng]
    );

    const onLoad = useCallback((event: { target: MapLibreMap }) => {
        const map = event.target;
        if (map.isStyleLoaded()) {
            setupMapLibre3DScene(map);
        } else {
            map.once('style.load', () => setupMapLibre3DScene(map));
        }
    }, []);

    useEffect(() => {
        if (!focusTarget) return;
        const map = mapRef.current?.getMap();
        if (!map) return;
        map.flyTo({
            center: [focusTarget.lng, focusTarget.lat],
            zoom: 17.5,
            pitch: 62,
            bearing: -20,
            duration: 1400,
            essential: true,
        });
    }, [focusTarget?.tick, focusTarget?.lat, focusTarget?.lng]);

    const selected = equipments.find((e) => e.id === selectedId);

    return (
        <div className="w-full h-full min-h-[400px] rounded-2xl overflow-hidden border border-white/10 relative">
            <Map
                ref={mapRef}
                initialViewState={initialViewState}
                style={{ width: '100%', height: '100%' }}
                mapStyle={MAP_STYLE}
                onLoad={onLoad}
            >
                <NavigationControl position="top-right" visualizePitch />

                {equipments.map((eq) => {
                    const isSelected = eq.id === selectedId;
                    const color = statusColor(eq.status);
                    return (
                        <Marker
                            key={eq.id}
                            latitude={eq.lat}
                            longitude={eq.lng}
                            anchor="bottom"
                        >
                            <div className="flex flex-col items-center pointer-events-none">
                                <div
                                    className={`px-2 py-0.5 rounded text-[8px] font-black uppercase whitespace-nowrap mb-1 ${
                                        isSelected ? 'bg-amber-500 text-black' : 'bg-[#0a0f1d]/90 text-white border border-white/20'
                                    }`}
                                >
                                    {eq.name.substring(0, 14)}
                                </div>
                                <div
                                    className={`rounded-full border-2 border-white shadow-lg ${
                                        isSelected ? 'w-5 h-5 animate-pulse' : 'w-3.5 h-3.5'
                                    }`}
                                    style={{ backgroundColor: color }}
                                />
                                <div className="w-0.5 h-3" style={{ backgroundColor: color }} />
                            </div>
                        </Marker>
                    );
                })}
            </Map>

            <div className="absolute bottom-4 left-4 z-10 bg-[#0a0f1d]/90 backdrop-blur border border-white/10 text-white px-4 py-3 rounded-lg text-[10px] space-y-1 max-w-sm pointer-events-none">
                <p className="font-black uppercase tracking-widest text-blue-400">
                    Carte 3D gratuite — bâtiments · routes · relief
                </p>
                <p className="text-slate-400">
                    {equipments.length} signal(aux) · OpenFreeMap · inclinez (Ctrl + glisser)
                </p>
                {selected ? (
                    <p className="text-amber-300 font-mono pt-1 border-t border-white/10 mt-1">
                        {selected.name} · {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
                    </p>
                ) : null}
            </div>
        </div>
    );
};

export default Map3D;
