import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    LocateFixed, 
    RefreshCcw, 
    Loader2, 
    AlertCircle, 
    MapPin,
    Signal,
    Navigation,
    ShieldCheck,
    Radar,
    Search,
    Satellite,
    Wifi
} from 'lucide-react';
import Map2D from '../components/Map2D';

const API_BASE_URL = '/api';

interface EquipmentData {
    id: string;
    name: string;
    serial_number: string;
    latitude: number;
    longitude: number;
    status: string;
    assigned_to: string;
    department: string;
}

interface EquipmentPosition {
    id: string;
    name: string;
    type: string;
    lat: number;
    lng: number;
    status: string;
}

export const DepartmentEquipmentMap = () => {
    const [equipments, setEquipments] = useState<EquipmentPosition[]>([]);
    const [allEquipments, setAllEquipments] = useState<EquipmentData[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedEquipment, setSelectedEquipment] = useState<EquipmentData | null>(null);

    const fetchDepartmentEquipments = async () => {
        try {
            setError(null);
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${API_BASE_URL}/user/department/devices-map`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!response.ok) throw new Error(`Erreur API ${response.status}: ${response.statusText}`);
            const rawData = await response.json();
            
            // GPS field mapping fix - backend sends last_known_lat/lng (TS/Babel safe)
            const data = Array.isArray(rawData) ? rawData : [];
            const mappedData = data.map((item: any) => ({
                ...item,
                latitude: (item.last_known_lat ?? item.latitude) ?? null,
                longitude: (item.last_known_lng ?? item.longitude) ?? null,
                name: item.name || item.serial_number || item.id,
                serial_number: item.serial_number || (item as any).serialNumber,
                assigned_to: item.assigned_to || (item as any).assignedTo || 'Non assigné',
                department: item.department || 'N/A'
            })) as EquipmentData[];


            
            setAllEquipments(mappedData);
            
            const mappedEquipments: EquipmentPosition[] = mappedData
                .filter(eq => eq.latitude != null && eq.longitude != null && Number.isFinite(eq.latitude) && Number.isFinite(eq.longitude))
                .map(eq => ({
                    id: eq.id,
                    name: eq.name,
                    type: `${eq.serial_number} / ${eq.assigned_to}`,
                    lat: Number(eq.latitude),
                    lng: Number(eq.longitude),
                    status: eq.status || 'UNKNOWN'
                }));
            
            setEquipments(mappedEquipments);
        } catch (err) {
            console.error('Dept map fetch error:', err);
            setError(err instanceof Error ? err.message : 'Défaut de télémétrie départementale');
        } finally {
            setIsLoading(false);
        }
    };


    useEffect(() => {
        fetchDepartmentEquipments();
        const interval = setInterval(fetchDepartmentEquipments, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchDepartmentEquipments();
        setTimeout(() => setIsRefreshing(false), 500);
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'AVAILABLE': return 'status-secure';
            case 'IN_USE': return 'status-info';
            case 'MAINTENANCE': return 'status-warning';
            case 'OUT_OF_ZONES': return 'status-danger';
            default: return 'status-info';
        }
    };

    const equipmentsWithLocation = allEquipments.filter(eq => eq.latitude && eq.longitude);
    const equipmentsWithoutLocation = allEquipments.filter(eq => !eq.latitude || !eq.longitude);

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col justify-between gap-6 pb-6 border-b md:flex-row md:items-end border-white/5">
                <div>
                    <h2 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-white uppercase">
                        <Radar className="w-8 h-8 text-blue-500" />
                        Relais de Zone Départemental
                    </h2>
                    <p className="text-slate-400 mt-1 uppercase text-[10px] tracking-[0.2em] font-black italic">
                        Sentinel Network // Node_Map_Terminal_S4
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                    >
                        <RefreshCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Rafraîchir_Flux
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
                    <AlertCircle className="w-4 h-4" />
                    ERREUR_SÉCURITÉ : {error}
                </div>
            )}

            {/* Map Terminal */}
            <div className="relative pro-card overflow-hidden h-[600px] border-blue-900/30">
                <div className="absolute inset-0 pointer-events-none tactical-grid opacity-10"></div>
                
                {isLoading ? (
                    <div className="absolute inset-0 bg-[#060b18]/80 backdrop-blur-md z-50 flex items-center justify-center">
                        <div className="text-center">
                            <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-600 animate-spin" />
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">SYNCHRONISATION_MAP...</p>
                        </div>
                    </div>
                ) : equipments.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="p-12 text-center border border-dashed border-white/10 rounded-2xl">
                            <Satellite className="w-12 h-12 mx-auto mb-4 text-slate-800" />
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">SIGNAL_INCONNU</p>
                            <p className="text-[9px] text-slate-700 mt-2 uppercase">Aucune coordonnée ACTIVE détectée dans le terminal courant</p>
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full bg-[#0d1224]">
                        <Map2D equipments={equipments} />
                    </div>
                )}

                {/* Tactical Overlays */}
                <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-3">
                    <div className="p-4 bg-[#0a0f1d]/90 backdrop-blur border border-white/10 rounded-lg space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">GPS_SIGNAL_LOCK</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">WIFI_TRIANGULATION</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Signal Listing */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {equipmentsWithLocation.map((eq) => (
                    <motion.div
                        key={eq.id}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={() => setSelectedEquipment(eq)}
                        className={`p-5 pro-card cursor-pointer transition-all border-l-4 ${
                            selectedEquipment?.id === eq.id
                                ? 'border-l-blue-600 bg-blue-600/[0.05] border-white/20'
                                : 'border-l-slate-800 border-white/5 hover:border-white/10'
                        }`}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h4 className="text-[11px] font-black text-white uppercase tracking-widest">{eq.name}</h4>
                                <p className="text-[9px] font-mono text-slate-500 uppercase tracking-tighter">SN_{eq.serial_number}</p>
                            </div>
                            <span className={`status-badge ${getStatusStyles(eq.status)}`}>
                                {eq.status}
                            </span>
                        </div>
                        <div className="pt-4 space-y-3 border-t border-white/5">
                            <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase italic">
                                <div className="flex items-center gap-2">
                                    <Navigation className="w-3 h-3 text-blue-500" />
                                    <span>{eq.latitude.toFixed(6)}N / {eq.longitude.toFixed(6)}E</span>
                                </div>
                                <span>{eq.assigned_to.toUpperCase()}</span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Offline Assets */}
            {equipmentsWithoutLocation.length > 0 && (
                <div className="pro-card p-6 border-amber-500/20 bg-amber-500/[0.02]">
                    <h3 className="text-[10px] font-black text-amber-500 mb-6 flex items-center gap-2 uppercase tracking-[0.2em]">
                        <Wifi className="w-4 h-4" />
                        Signaux_Hors_Ligne ({equipmentsWithoutLocation.length})
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {equipmentsWithoutLocation.map((eq) => (
                            <div key={eq.id} className="p-3 border rounded-lg bg-white/5 border-white/5">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{eq.name}</p>
                                <p className="text-[8px] text-slate-600 uppercase mt-1">Opérateur: {eq.assigned_to}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DepartmentEquipmentMap;
