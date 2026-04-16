import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix for default marker icon in Leaflet with React
const icon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

interface EquipmentPosition {
    id: string;
    name: string;
    type: string;
    lat: number;
    lng: number;
    status: string;
}

interface Map2DProps {
    equipments: EquipmentPosition[];
}

// Composant pour forcer l'invalidation de la taille
const MapResizer: React.FC = () => {
    const map = useMap();
    
    useEffect(() => {
        // Invalider la taille de la carte après le montage
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 100);
        
        return () => clearTimeout(timer);
    }, [map]);
    
    return null;
};

// Composant pour les marqueurs
const MapMarkers: React.FC<{ equipments: EquipmentPosition[] }> = ({ equipments }) => {
    return (
        <>
            {equipments.map((eq) => (
                <Marker key={eq.id} position={[eq.lat, eq.lng]} icon={icon}>
                    <Popup>
                        <div className="p-2">
                            <h3 className="font-bold text-gray-900">{eq.name}</h3>
                            <p className="text-sm text-gray-500">{eq.type}</p>
                            <div className="mt-2 text-xs font-semibold uppercase">
                                Statut: <span className={eq.status === 'AVAILABLE' ? 'text-green-600' : 'text-orange-600'}>{eq.status}</span>
                            </div>
                        </div>
                    </Popup>
                </Marker>
            ))}
        </>
    );
};

const MapViewportUpdater: React.FC<{ equipments: EquipmentPosition[] }> = ({ equipments }) => {
    const map = useMap();

    useEffect(() => {
        if (!equipments.length) {
            return;
        }

        if (equipments.length === 1) {
            const only = equipments[0];
            map.setView([only.lat, only.lng], 13, { animate: true });
            return;
        }

        const bounds = L.latLngBounds(equipments.map((eq) => [eq.lat, eq.lng] as [number, number]));
        map.fitBounds(bounds.pad(0.25), { animate: true });
    }, [map, equipments]);

    return null;
};

const Map2D: React.FC<Map2DProps> = ({ equipments }) => {
    const center: [number, number] = [48.8566, 2.3522]; // Default center (Paris)
    const [isLoaded, setIsLoaded] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const mapKey = equipments
        .map((eq) => `${eq.id}:${eq.lat.toFixed(5)}:${eq.lng.toFixed(5)}`)
        .join('|');

    useEffect(() => {
        // S'assurer que le conteneur est monté avant d'afficher la carte
        const timer = setTimeout(() => {
            setIsLoaded(true);
        }, 50);
        
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        // Force le recalcul de la taille de la fenêtre
        if (isLoaded) {
            const timer = setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 150);
            
            return () => clearTimeout(timer);
        }
    }, [isLoaded]);

    return (
        <div
            ref={containerRef}
            className="map-shell w-full h-full min-h-[420px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative"
        >
            {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                        <p className="text-gray-500 font-medium">Chargement de la carte...</p>
                    </div>
                </div>
            )}
            {isLoaded && (
                <MapContainer
                    key={mapKey || 'empty-map'}
                    center={center}
                    zoom={13}
                    scrollWheelZoom={true}
                    className="map-canvas h-full w-full z-0"
                    whenReady={() => {
                        // Callback quand la carte est prête
                        setTimeout(() => {
                            window.dispatchEvent(new Event('resize'));
                        }, 100);
                    }}
                >
                    <MapResizer />
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        maxZoom={19}
                    />
                    <MapViewportUpdater equipments={equipments} />
                    <MapMarkers equipments={equipments} />
                </MapContainer>
            )}
        </div>
    );
};

export default Map2D;
