import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Map as MapIcon, 
    Box, 
    Cuboid, 
    LocateFixed, 
    RefreshCcw, 
    Loader2,
    Database,
    Signal,
    Navigation,
    Layers,
    Activity,
    ShieldAlert
} from 'lucide-react';
import Map2D from '../components/Map2D';
import Map3D from '../components/Map3D';
import api from '../services/api';

interface EquipmentData {
    id: string;
    name: string;
    email: string;
    role: string;
    lat: number | null;
    lng: number | null;
    status: string;
    department: string;
    last_login: string;
    location_source: string;
    has_location?: boolean;
}

interface EquipmentApiItem {
    id: string;
    serialNumber?: string;
    type?: string;
    assignedTo?: string | null;
    department?: string | null;
    last_known_lat?: number | null;
    last_known_lng?: number | null;
    status?: string;
}

const getBrowserLocation = async (): Promise<{ lat: number; lng: number } | null> => {
    if (!navigator.geolocation) return null;

    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
            },
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
        );
    });
};

interface EquipmentPosition {
    id: string;
    name: string;
    type: string;
    lat: number;
    lng: number;
    status: string;
}

export const TrackingMap = () => {
    const [view, setView] = useState<'2D' | '3D'>('2D');
    const [equipments, setEquipments] = useState<EquipmentPosition[]>([]);
    const [connectedUsers, setConnectedUsers] = useState<EquipmentData[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchEquipments = async () => {
        try {
            setError(null);
            let data: EquipmentData[] = [];
            const response = await api.get('/equipments/');
            const equipments = Array.isArray(response.data) ? (response.data as EquipmentApiItem[]) : [];

            data = equipments.map((item) => ({
                id: item.id,
                name: item.assignedTo || item.serialNumber || item.id,
                email: '',
                role: item.assignedTo ? 'ASSIGNED_USER' : 'UNASSIGNED',
                lat: item.last_known_lat ?? null,
                lng: item.last_known_lng ?? null,
                status: item.status || 'UNKNOWN',
                department: item.department || 'N/A',
                last_login: new Date().toISOString(),
                location_source: 'device',
                has_location: item.last_known_lat != null && item.last_known_lng != null,
            }));

            const hasAnyLocation = data.some((entry) => Number.isFinite(entry.lat) && Number.isFinite(entry.lng));
            if (!hasAnyLocation) {
                const browserLocation = await getBrowserLocation();
                const currentUserRaw = localStorage.getItem('user');
                const currentUser = currentUserRaw ? JSON.parse(currentUserRaw) : null;

                if (browserLocation) {
                    data.unshift({
                        id: currentUser?.id || 'connected-user',
                        name: currentUser?.name || 'Utilisateur connecté',
                        email: currentUser?.email || '',
                        role: currentUser?.role || 'USER',
                        lat: browserLocation.lat,
                        lng: browserLocation.lng,
                        status: 'ONLINE',
                        department: currentUser?.department || 'N/A',
                        last_login: new Date().toISOString(),
                        location_source: 'browser',
                        has_location: true,
                    });
                }
            }
            
            setConnectedUsers(data);

            const mappedEquipments: EquipmentPosition[] = data
                .filter(eq => Number.isFinite(eq.lat) && Number.isFinite(eq.lng))
                .map(eq => ({
                    id: eq.id,
                    name: eq.name,
                    type: `${eq.role || 'USER'}${eq.department ? ` / ${eq.department}` : ''}`,
                    lat: Number(eq.lat),
                    lng: Number(eq.lng),
                    status: eq.status || 'ONLINE'
                }));
            
            setEquipments(mappedEquipments);
        } catch (err: any) {
            const apiMessage = err?.response?.data?.message;
            setError(apiMessage || err?.message || 'Erreur de télémétrie');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchEquipments();
        const interval = setInterval(fetchEquipments, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchEquipments();
        setTimeout(() => setIsRefreshing(false), 500);
    };

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-white/5">
                <div>
                    <h2 className="text-2xl lg:text-3xl font-bold text-white tracking-tight uppercase flex items-center gap-3">
                        <LocateFixed className="w-8 h-8 text-blue-500" />
                        Surveillance
                    </h2>
                    <p className="text-slate-400 mt-1 uppercase text-[10px] tracking-[0.2em] font-black italic">
                        Sentinel Global Tracking
                    </p>
                </div>

                <div className="flex items-center gap-2 bg-[#0a0f1d] p-1 border border-white/5 rounded-lg w-full lg:w-auto">
                    <button
                        onClick={() => setView('2D')}
                        className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 lg:px-6 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all ${
                            view === '2D' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-500 hover:text-white'
                        }`}
                    >
                        <MapIcon className="w-3.5 h-3.5" />
                        Vue 2D
                    </button>
                    <button
                        onClick={() => setView('3D')}
                        className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 lg:px-6 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all ${
                            view === '3D' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-500 hover:text-white'
                        }`}
                    >
                        <Cuboid className="w-3.5 h-3.5" />
                        Vue 3D
                    </button>
                </div>
            </div>

            {/* Map Monitor Terminal */}
            <div className="relative pro-card overflow-hidden h-[400px] lg:h-[600px] border-blue-900/30 group">
                <div className="absolute inset-0 tactical-grid opacity-10"></div>
                
                {/* Loader Overlay */}
                {isLoading && (
                    <div className="absolute inset-0 bg-[#060b18]/80 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="text-center">
                            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">INITIALISATION_TÉLÉMÉTRIE...</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[2000] px-6 py-3 bg-red-500 text-white rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-2xl">
                        <ShieldAlert className="w-4 h-4" />
                        FLUX_INTERROMPU: {error}
                    </div>
                )}

                <div className="absolute inset-0">
                    <AnimatePresence mode="wait">
                        {view === '2D' ? (
                            <motion.div key="2d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                                <Map2D equipments={equipments} />
                            </motion.div>
                        ) : (
                            <motion.div key="3d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                                <Map3D equipments={equipments} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {!isLoading && equipments.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center p-12 border border-dashed border-white/10 rounded-2xl bg-[#060b18]/65 backdrop-blur-sm">
                            <Signal className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">SIGNAL_ABSENT</p>
                            <p className="text-[9px] text-slate-700 mt-2 uppercase">
                                {connectedUsers.length > 0
                                    ? `${connectedUsers.length} connecté(s), mais GPS indisponible`
                                    : 'Aucun utilisateur connecté et localisable pour le moment'}
                            </p>
                            <p className="text-[8px] text-amber-400 mt-2 uppercase">Source: gps navigateur + équipements</p>
                        </div>
                    </div>
                )}

                {/* Map Controls Overlay */}
                <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-3">
                    <button
                        onClick={handleRefresh}
                        title="Rafraîchir la carte"
                        className={`p-3 bg-[#0a0f1d]/90 backdrop-blur border border-white/10 rounded-lg text-blue-400 hover:text-white transition-all shadow-2xl ${isRefreshing ? 'animate-spin' : ''}`}
                    >
                        <RefreshCcw className="w-4 h-4" />
                    </button>
                    <div className="p-3 bg-[#0a0f1d]/90 backdrop-blur border border-white/10 rounded-lg space-y-3">
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[8px] font-black text-slate-500 tracking-tighter">SIG</span>
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[8px] font-black text-slate-500 tracking-tighter">GPS</span>
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        </div>
                    </div>
                </div>

                {/* Legend/Telemery Overlay */}
                <div className="absolute bottom-6 left-6 z-[1000] p-4 bg-[#0a0f1d]/90 backdrop-blur border border-white/10 rounded-lg hidden lg:block">
                    <h4 className="text-[9px] font-black text-slate-400 border-b border-white/10 pb-2 mb-3 tracking-widest uppercase">Légende Tactique</h4>
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <span className="text-[8px] font-bold text-slate-300">ACTIFS_AUTORISÉS</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                            <span className="text-[8px] font-bold text-slate-300">VALEUR_NOMINALE</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            <span className="text-[8px] font-bold text-slate-300">ANOMALIE_ZONE</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Signals Listing */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                {connectedUsers.map((eq, i) => (
                    <motion.div
                        key={eq.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`pro-card p-4 border-l-4 bg-gradient-to-r to-transparent flex items-center justify-between ${
                            Number.isFinite(eq.lat) && Number.isFinite(eq.lng)
                                ? 'border-l-blue-600/50 from-blue-600/[0.03]'
                                : 'border-l-amber-600/50 from-amber-600/[0.03]'
                        }`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-2.5 rounded border ${Number.isFinite(eq.lat) && Number.isFinite(eq.lng) ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                                <Navigation className="w-4 h-4 rotate-45" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-white uppercase tracking-tight">{eq.name}</p>
                                <p className="text-[8px] font-mono text-slate-500 uppercase tracking-tighter">ID_{eq.id.substring(0,8)}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Coordonnées</p>
                            {Number.isFinite(eq.lat) && Number.isFinite(eq.lng) ? (
                                <p className="text-[10px] font-mono text-blue-400/80">
                                    {Number(eq.lat).toFixed(4)}N / {Number(eq.lng).toFixed(4)}E
                                </p>
                            ) : (
                                <p className="text-[10px] font-mono text-amber-400/80">GPS indisponible</p>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
