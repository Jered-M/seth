import React, { useEffect, useRef, useState } from 'react';
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    ZoomControl,
    Circle,
    useMap,
    useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import {
    MAP_STATUS_COLORS,
    MAP_STATUS_LABELS,
} from '../services/trackingService';
import {
    isMapViewportLocked,
    lockMapViewport,
    markInitialAutoFitDone,
    shouldRunInitialAutoFit,
} from '../services/mapViewport';

const DEFAULT_CENTER: [number, number] = [48.8566, 2.3522];
const DEFAULT_ZOOM = 13;

const icon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

export interface EquipmentPosition {
    id: string;
    name: string;
    type: string;
    lat: number;
    lng: number;
    accuracy?: number | null;
    status: string;
    mapStatus?: string;
    zoneStatus?: string;
    department?: string;
    assignedTo?: string;
    serialNumber?: string;
    deviceStatus?: string;
    exitRequestStatus?: string;
}

interface Map2DProps {
    equipments: EquipmentPosition[];
    manualPickEnabled?: boolean;
    onManualPosition?: (lat: number, lng: number) => void;
    focusTarget?: { id: string; lat: number; lng: number; tick: number } | null;
    selectedId?: string | null;
    superAdminPerimeter?: {
        configured: boolean;
        center_lat?: number | null;
        center_lng?: number | null;
        radius_m?: number;
    } | null;
}

const MapUserInteractionLock: React.FC = () => {
    useMapEvents({
        zoomend() {
            lockMapViewport();
        },
        dragend() {
            lockMapViewport();
        },
    });
    return null;
};

const MapClickPicker: React.FC<{
    enabled?: boolean;
    onPick?: (lat: number, lng: number) => void;
}> = ({ enabled, onPick }) => {
    const map = useMap();

    useEffect(() => {
        const container = map.getContainer();
        container.style.cursor = enabled ? 'crosshair' : '';
        return () => {
            container.style.cursor = '';
        };
    }, [map, enabled]);

    useMapEvents({
        click(event) {
            if (!enabled || !onPick) return;
            onPick(event.latlng.lat, event.latlng.lng);
        },
    });

    return null;
};

const MapResizer: React.FC = () => {
    const map = useMap();

    useEffect(() => {
        const timer = setTimeout(() => map.invalidateSize(), 100);
        return () => clearTimeout(timer);
    }, [map]);

    return null;
};

const EquipmentMarker: React.FC<{ equipment: EquipmentPosition; isSelected?: boolean }> = React.memo(
    ({ equipment: eq, isSelected }) => {
        const markerRef = useRef<L.Marker>(null);

        useEffect(() => {
            if (isSelected && markerRef.current) {
                markerRef.current.openPopup();
            }
        }, [isSelected, eq.lat, eq.lng]);

        return (
            <>
                {isSelected ? (
                    <Circle
                        center={[eq.lat, eq.lng]}
                        radius={Math.max(eq.accuracy ?? 0, 40)}
                        pathOptions={{
                            color: '#f59e0b',
                            fillColor: '#f59e0b',
                            fillOpacity: 0.2,
                            weight: 2,
                        }}
                    />
                ) : null}
                {eq.accuracy && eq.accuracy > 0 ? (
                    <Circle
                        center={[eq.lat, eq.lng]}
                        radius={eq.accuracy}
                        pathOptions={{
                            color: '#3b82f6',
                            fillColor: '#3b82f6',
                            fillOpacity: 0.12,
                            weight: 1,
                        }}
                    />
                ) : null}
                <Marker ref={markerRef} position={[eq.lat, eq.lng]} icon={icon}>
                    <Popup>
                        <div className="p-2 min-w-[200px]">
                            <h3 className="font-bold text-gray-900">{eq.name}</h3>
                            {eq.serialNumber ? (
                                <p className="text-[10px] text-gray-500 font-mono">SN: {eq.serialNumber}</p>
                            ) : null}
                            <p className="text-sm text-gray-500">{eq.type}</p>
                            {eq.assignedTo ? (
                                <p className="text-xs text-gray-600 mt-1">Opérateur: {eq.assignedTo}</p>
                            ) : null}
                            {eq.department ? (
                                <p className="text-xs text-gray-600">Département: {eq.department}</p>
                            ) : null}
                            {eq.accuracy ? (
                                <p className="text-xs text-gray-500 mt-1">
                                    Précision: ±{Math.round(eq.accuracy)} m
                                </p>
                            ) : null}
                            <p className="text-xs font-mono text-gray-500 mt-1">
                                {eq.lat.toFixed(6)} / {eq.lng.toFixed(6)}
                            </p>
                            {eq.mapStatus ? (
                                <p className={`mt-2 text-[10px] font-bold uppercase px-2 py-1 rounded inline-block ${MAP_STATUS_COLORS[eq.mapStatus] || ''}`}>
                                    {MAP_STATUS_LABELS[eq.mapStatus] || eq.mapStatus}
                                </p>
                            ) : null}
                            {eq.zoneStatus ? (
                                <p className={`text-[10px] mt-1 ${eq.zoneStatus === 'IN_ZONE' ? 'text-green-600' : 'text-red-600'}`}>
                                    {eq.zoneStatus === 'IN_ZONE' ? 'Dans la zone autorisée' : 'Hors zone'}
                                    {eq.zoneStatus !== 'IN_ZONE' ? ' ⚠️' : ''}
                                </p>
                            ) : null}
                        </div>
                    </Popup>
                </Marker>
            </>
        );
    },
    (prev, next) =>
        prev.equipment.id === next.equipment.id &&
        prev.equipment.lat === next.equipment.lat &&
        prev.equipment.lng === next.equipment.lng &&
        prev.equipment.accuracy === next.equipment.accuracy &&
        prev.equipment.status === next.equipment.status &&
        prev.isSelected === next.isSelected
);

const MapMarkers: React.FC<{ equipments: EquipmentPosition[]; selectedId?: string | null }> = ({
    equipments,
    selectedId,
}) => (
    <>
        {equipments.map((eq) => (
            <EquipmentMarker key={eq.id} equipment={eq} isSelected={eq.id === selectedId} />
        ))}
    </>
);

/** Centre la carte sur un matériel sélectionné depuis la liste. */
const MapFocusController: React.FC<{
    focusTarget?: { id: string; lat: number; lng: number; tick: number } | null;
}> = ({ focusTarget }) => {
    const map = useMap();

    useEffect(() => {
        if (!focusTarget) return;
        lockMapViewport();
        map.flyTo([focusTarget.lat, focusTarget.lng], 16, { duration: 0.7 });
    }, [focusTarget?.tick, focusTarget?.lat, focusTarget?.lng, map]);

    return null;
};

/** Un seul centrage au premier chargement avec données — jamais après. */
const MapInitialFit: React.FC<{ equipments: EquipmentPosition[] }> = ({ equipments }) => {
    const map = useMap();
    const didFitRef = useRef(false);

    useEffect(() => {
        if (didFitRef.current || !equipments.length || isMapViewportLocked() || !shouldRunInitialAutoFit()) {
            return;
        }

        didFitRef.current = true;
        markInitialAutoFitDone();

        if (equipments.length === 1) {
            const only = equipments[0];
            map.setView([only.lat, only.lng], 15, { animate: false });
            return;
        }

        const bounds = L.latLngBounds(
            equipments.map((eq) => [eq.lat, eq.lng] as [number, number])
        );
        map.fitBounds(bounds.pad(0.25), { animate: false, maxZoom: 16 });
    }, [map, equipments]);

    return null;
};

const Map2D: React.FC<Map2DProps> = ({
    equipments,
    manualPickEnabled,
    onManualPosition,
    focusTarget,
    selectedId,
    superAdminPerimeter,
}) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const mapInstanceKey = useRef(`map-${Date.now()}`).current;

    useEffect(() => {
        const timer = setTimeout(() => setIsLoaded(true), 50);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="map-shell w-full h-full min-h-[420px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative">
            {!isLoaded ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
                        <p className="text-gray-500 font-medium">Chargement de la carte...</p>
                    </div>
                </div>
            ) : null}
            {isLoaded ? (
                <MapContainer
                    key={mapInstanceKey}
                    center={DEFAULT_CENTER}
                    zoom={DEFAULT_ZOOM}
                    minZoom={3}
                    maxZoom={19}
                    scrollWheelZoom
                    touchZoom
                    doubleClickZoom
                    boxZoom
                    keyboard
                    zoomControl={false}
                    className="map-canvas h-full w-full z-0"
                >
                    <MapResizer />
                    <MapUserInteractionLock />
                    <ZoomControl position="bottomright" />
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        maxZoom={19}
                    />
                    <MapInitialFit equipments={equipments} />
                    <MapFocusController focusTarget={focusTarget} />
                    <MapClickPicker enabled={manualPickEnabled} onPick={onManualPosition} />
                    {superAdminPerimeter?.configured &&
                    Number.isFinite(superAdminPerimeter.center_lat) &&
                    Number.isFinite(superAdminPerimeter.center_lng) ? (
                        <Circle
                            center={[superAdminPerimeter.center_lat!, superAdminPerimeter.center_lng!]}
                            radius={superAdminPerimeter.radius_m ?? 10}
                            pathOptions={{
                                color: '#3b82f6',
                                fillColor: '#3b82f6',
                                fillOpacity: 0.12,
                                weight: 2,
                                dashArray: '8 6',
                            }}
                        />
                    ) : null}
                    <MapMarkers equipments={equipments} selectedId={selectedId} />
                </MapContainer>
            ) : null}
        </div>
    );
};

export default React.memo(Map2D);
