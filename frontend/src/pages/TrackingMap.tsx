import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    Map as MapIcon,
    Cuboid, 
    LocateFixed, 
    RefreshCcw, 
    Loader2,
    Signal,
    Navigation,
    ShieldAlert,
    Monitor,
    MousePointerClick
} from 'lucide-react';
import Map2D from '../components/Map2D';
import Map3D from '../components/Map3D';
import {
    createManualPosition,
    describeAccuracy,
    fetchLiveTracking,
    fetchTrackedEquipments,
    getBestBrowserLocation,
    getFreshBrowserLocation,
    getLocationProfile,
    hasMovedSignificantly,
    isDesktopDevice,
    isMobileWeb,
    refreshTrackedLocations,
    roundCoordForStability,
    startLocationWatch,
    syncMyDevicePositions,
    SuperAdminPerimeter,
    TrackedEquipment,
} from '../services/locationService';
import { authService } from '../services/authService';
import { MAP_STATUS_COLORS, MAP_STATUS_LABELS } from '../services/trackingService';
import { lockMapViewport, resetMapViewportState } from '../services/mapViewport';

interface EquipmentData {
    id: string;
    name: string;
    email: string;
    role: string;
    lat: number | null;
    lng: number | null;
    accuracy: number | null;
    status: string;
    department: string;
    last_login: string;
    location_source: string;
    has_location?: boolean;
    kind?: string;
    assigned_to?: string;
    map_status?: string;
    zone_status?: string;
    serial_number?: string | null;
}

interface EquipmentPosition {
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
}

const toEquipmentData = (item: TrackedEquipment): EquipmentData => ({
    id: item.id,
    name: item.name,
    email: item.email || '',
    role: item.assignedTo ? 'ASSIGNED_USER' : 'USER',
    lat: item.lat,
    lng: item.lng,
    accuracy: item.accuracy,
    status: item.status,
    department: item.department,
    last_login: item.lastLogin || new Date().toISOString(),
    location_source: item.locationSource,
    has_location: item.hasLocation ?? (Number.isFinite(item.lat) && Number.isFinite(item.lng)),
    kind: item.kind,
    assigned_to: item.assignedTo ?? undefined,
    map_status: item.mapStatus,
    zone_status: item.zoneStatus,
    serial_number: item.serialNumber,
});

export const TrackingMap = () => {
    const [view, setView] = useState<'2D' | '3D'>('2D');
    const [equipments, setEquipments] = useState<EquipmentPosition[]>([]);
    const [connectedUsers, setConnectedUsers] = useState<EquipmentData[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
    const [gpsFixing, setGpsFixing] = useState(false);
    const [manualPickMode, setManualPickMode] = useState(isDesktopDevice());
    const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
    const [focusTarget, setFocusTarget] = useState<{ id: string; lat: number; lng: number; tick: number } | null>(null);
    const [gpsUnavailableHint, setGpsUnavailableHint] = useState<string | null>(null);
    const [liveStats, setLiveStats] = useState({ online: 0, located: 0 });
    const [superAdminPerimeter, setSuperAdminPerimeter] = useState<SuperAdminPerimeter | null>(null);
    const mapSectionRef = useRef<HTMLDivElement>(null);
    const isDesktop = isDesktopDevice();
    const locationProfile = getLocationProfile();
    const lastSyncedPositionRef = useRef<{ lat: number; lng: number } | null>(null);

    const handleEquipmentCardClick = (eq: EquipmentData) => {
        setGpsUnavailableHint(null);
        if (!Number.isFinite(eq.lat) || !Number.isFinite(eq.lng)) {
            setGpsUnavailableHint(`${eq.name} — GPS indisponible, position non affichable sur la carte.`);
            return;
        }
        setSelectedEquipmentId(eq.id);
        setFocusTarget({
            id: eq.id,
            lat: Number(eq.lat),
            lng: Number(eq.lng),
            tick: Date.now(),
        });
        setView('2D');
        mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const buildPositionSignature = (items: Array<{ id: string; lat: number; lng: number; accuracy?: number | null; status?: string }>) =>
        items
            .map((eq) =>
                `${eq.id}|${roundCoordForStability(eq.lat)}|${roundCoordForStability(eq.lng)}|${eq.accuracy ?? ''}|${eq.status ?? ''}`
            )
            .join(';;');

    const applyTrackedData = (tracked: TrackedEquipment[]) => {
        const data = tracked.map(toEquipmentData);

        const mappedEquipments: EquipmentPosition[] = data
            .filter(eq => Number.isFinite(eq.lat) && Number.isFinite(eq.lng))
            .map(eq => ({
                id: eq.id,
                name: eq.name,
                type: `${eq.role || 'USER'}${eq.department ? ` / ${eq.department}` : ''}`,
                lat: Number(eq.lat),
                lng: Number(eq.lng),
                accuracy: eq.accuracy,
                status: eq.status || 'ONLINE',
                mapStatus: eq.map_status,
                zoneStatus: eq.zone_status,
                department: eq.department,
                assignedTo: eq.assigned_to,
                serialNumber: eq.serial_number ?? undefined,
            }));

        const signature = buildPositionSignature(mappedEquipments);

        setEquipments((prev) => {
            const prevSignature = buildPositionSignature(prev);
            return prevSignature === signature ? prev : mappedEquipments;
        });

        setConnectedUsers((prev) => {
            const nextSignature = data
                .map((eq) =>
                    `${eq.id}|${roundCoordForStability(eq.lat)}|${roundCoordForStability(eq.lng)}|${eq.accuracy ?? ''}`
                )
                .join(';;');
            const prevSignature = prev
                .map((eq) =>
                    `${eq.id}|${roundCoordForStability(eq.lat)}|${roundCoordForStability(eq.lng)}|${eq.accuracy ?? ''}`
                )
                .join(';;');
            return prevSignature === nextSignature ? prev : data;
        });

        const bestAccuracy = data
            .map((entry) => entry.accuracy)
            .filter((value): value is number => Number.isFinite(value))
            .sort((a, b) => a - b)[0];
        if (bestAccuracy !== undefined) {
            setGpsAccuracy((current) => (current === bestAccuracy ? current : bestAccuracy));
        }
    };

    const fetchEquipments = async (withGpsSync = true) => {
        try {
            setError(null);
            const role = authService.getCurrentUser()?.role;
            const normalizedRole =
                role === 'ADMIN_GENERAL' ? 'SUPER_ADMIN'
                : role === 'ADMIN_DEPT' ? 'DEPT_ADMIN'
                : role === 'SECURITY_AGENT' ? 'GARDIEN'
                : role;

            const isLiveViewer = ['SUPER_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR', 'GARDIEN'].includes(normalizedRole || '');

            if (withGpsSync && !isLiveViewer) {
                await refreshTrackedLocations().then(applyTrackedData);
                return;
            }

            if (withGpsSync) {
                await syncMyDevicePositions().catch(() => undefined);
            }

            if (isLiveViewer) {
                const live = await fetchLiveTracking();
                setLiveStats({ online: live.onlineCount, located: live.locatedCount });
                setSuperAdminPerimeter(live.superAdminPerimeter ?? null);
                applyTrackedData(live.items);
            } else {
                const tracked = await fetchTrackedEquipments();
                applyTrackedData(tracked);
            }
        } catch (err: any) {
            const apiMessage = err?.response?.data?.message;
            setError(apiMessage || err?.message || 'Erreur de télémétrie');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        let syncTimer: ReturnType<typeof setTimeout> | null = null;

        const bootstrap = async () => {
            const initial = await getBestBrowserLocation();
            if (initial?.accuracy) {
                setGpsAccuracy(initial.accuracy);
            }
            await fetchEquipments(true);
        };

        bootstrap();

        const stopWatch = startLocationWatch((position) => {
            if (position.accuracy) {
                setGpsAccuracy((current) =>
                    current === position.accuracy ? current : position.accuracy ?? current
                );
            }
            if (syncTimer) clearTimeout(syncTimer);
            syncTimer = setTimeout(async () => {
                const last = lastSyncedPositionRef.current;
                if (last && !hasMovedSignificantly(position, last, locationProfile.syncMinMoveM)) {
                    return;
                }

                lastSyncedPositionRef.current = { lat: position.lat, lng: position.lng };
                await syncMyDevicePositions(position);
                const live = await fetchLiveTracking();
                setLiveStats({ online: live.onlineCount, located: live.locatedCount });
                setSuperAdminPerimeter(live.superAdminPerimeter ?? null);
                applyTrackedData(live.items);
            }, 5000);
        }, {
            minAccuracyM: locationProfile.watchMinAccuracyM,
            minMoveM: locationProfile.syncMinMoveM,
        });

        const interval = setInterval(() => fetchEquipments(false), 15000);

        return () => {
            stopWatch();
            if (syncTimer) clearTimeout(syncTimer);
            clearInterval(interval);
            resetMapViewportState();
        };
    }, []);

    const handleManualPosition = async (lat: number, lng: number) => {
        lockMapViewport();
        const manual = createManualPosition(lat, lng);
        setGpsAccuracy(manual.accuracy ?? 5);
        await syncMyDevicePositions(manual);
        await fetchEquipments(false);
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchEquipments(true);
        setTimeout(() => setIsRefreshing(false), 500);
    };

    const handleMyGpsPosition = async () => {
        setGpsFixing(true);
        setGpsUnavailableHint(null);
        try {
            const position = await getFreshBrowserLocation();
            if (!position) {
                setGpsUnavailableHint('GPS indisponible — autorisez la localisation dans le navigateur.');
                return;
            }
            setGpsAccuracy(position.accuracy ?? null);
            await syncMyDevicePositions(position);
            const live = await fetchLiveTracking();
            setLiveStats({ online: live.onlineCount, located: live.locatedCount });
            setSuperAdminPerimeter(live.superAdminPerimeter ?? null);
            applyTrackedData(live.items);
            if ((position.accuracy ?? 999) > 80 && isMobileWeb()) {
                setGpsUnavailableHint(
                    `Position enregistrée (${describeAccuracy(position.accuracy)}). Sortez à l'extérieur pour améliorer le signal.`
                );
            }
        } finally {
            setGpsFixing(false);
        }
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
                        Appareils connectés — positions en temps réel
                    </p>
                    {liveStats.online > 0 ? (
                        <p className="text-[10px] text-emerald-400 mt-2 font-bold uppercase tracking-widest">
                            {liveStats.located} / {liveStats.online} connecté(s) localisé(s) sur la carte
                        </p>
                    ) : null}
                    {superAdminPerimeter?.configured ? (
                        <p className="text-[10px] text-blue-400 mt-1 font-bold uppercase tracking-widest">
                            Périmètre fixe 10 m — {superAdminPerimeter.center_lat?.toFixed(6)} / {superAdminPerimeter.center_lng?.toFixed(5)}
                        </p>
                    ) : null}
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

            {isDesktop && (
                <div className="pro-card p-4 border-amber-500/30 bg-amber-500/[0.04] flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-start gap-3 flex-1">
                        <Monitor className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-[11px] font-black text-amber-300 uppercase tracking-widest">
                                Mode PC détecté
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                                Sur ordinateur, le navigateur utilise souvent le WiFi ou l&apos;adresse IP
                                (précision typique : 50 m à 2 km). Activez la localisation Windows, puis
                                cliquez sur la carte pour placer manuellement la position exacte.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setManualPickMode((value) => !value)}
                        className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all ${
                            manualPickMode
                                ? 'bg-amber-500 text-black'
                                : 'bg-[#0a0f1d] text-amber-400 border border-amber-500/30'
                        }`}
                    >
                        <MousePointerClick className="w-3.5 h-3.5" />
                        {manualPickMode ? 'Clic carte actif' : 'Placer sur la carte'}
                    </button>
                </div>
            )}

            {isMobileWeb() && (
                <div className="pro-card p-4 border-blue-500/30 bg-blue-500/[0.04] flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-start gap-3 flex-1">
                        <Navigation className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-[11px] font-black text-blue-300 uppercase tracking-widest">
                                GPS mobile — haute précision
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                                Autorisez la localisation, activez le GPS du téléphone et utilisez Chrome/Safari.
                                {gpsAccuracy ? ` Précision actuelle : ${describeAccuracy(gpsAccuracy)}.` : ''}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleMyGpsPosition}
                        disabled={gpsFixing}
                        className="shrink-0 flex items-center gap-2 px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                        {gpsFixing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
                        Ma position GPS
                    </button>
                </div>
            )}

            {/* Map Monitor Terminal */}
            <div
                ref={mapSectionRef}
                className="relative pro-card overflow-hidden h-[400px] lg:h-[600px] border-blue-900/30 group"
            >
                <div className="absolute inset-0 tactical-grid opacity-10 pointer-events-none"></div>
                
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
                    {view === '2D' ? (
                        <div className="h-full">
                            <Map2D
                                equipments={equipments}
                                manualPickEnabled={manualPickMode}
                                onManualPosition={handleManualPosition}
                                focusTarget={focusTarget}
                                selectedId={selectedEquipmentId}
                                superAdminPerimeter={superAdminPerimeter}
                            />
                        </div>
                    ) : (
                        <div className="h-full">
                            <Map3D
                                equipments={equipments}
                                focusTarget={focusTarget}
                                selectedId={selectedEquipmentId}
                            />
                        </div>
                    )}
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
                            {gpsAccuracy ? (
                                <span className="text-[7px] font-mono text-blue-400 text-center leading-tight">
                                    {describeAccuracy(gpsAccuracy)}
                                </span>
                            ) : null}
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
            {gpsUnavailableHint && (
                <div className="pro-card p-3 border border-amber-500/30 bg-amber-500/5 text-[10px] font-bold uppercase text-amber-300 tracking-wide">
                    {gpsUnavailableHint}
                </div>
            )}
            <p className="text-[9px] text-slate-500 uppercase tracking-widest">
                Cliquez sur un matériel avec GPS pour afficher sa position sur la carte
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                {connectedUsers.length === 0 && !isLoading ? (
                    <div className="col-span-full pro-card p-6 text-center text-slate-500 text-[10px] uppercase tracking-widest">
                        Aucun appareil connecté dans les dernières 8 heures
                    </div>
                ) : null}
                {connectedUsers.map((eq, i) => {
                    const hasGps = Number.isFinite(eq.lat) && Number.isFinite(eq.lng);
                    const isSelected = selectedEquipmentId === eq.id;
                    return (
                    <motion.button
                        type="button"
                        key={eq.id}
                        onClick={() => handleEquipmentCardClick(eq)}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`pro-card p-4 border-l-4 bg-gradient-to-r to-transparent flex items-center justify-between text-left w-full transition-all ${
                            isSelected
                                ? 'border-l-amber-400 from-amber-500/10 ring-2 ring-amber-500/40'
                                : hasGps
                                  ? 'border-l-blue-600/50 from-blue-600/[0.03] hover:ring-1 hover:ring-blue-500/30 cursor-pointer'
                                  : 'border-l-amber-600/50 from-amber-600/[0.03] opacity-80 cursor-not-allowed'
                        }`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-2.5 rounded border ${Number.isFinite(eq.lat) && Number.isFinite(eq.lng) ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                                <Navigation className="w-4 h-4 rotate-45" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-white uppercase tracking-tight">{eq.name}</p>
                                <p className="text-[8px] font-mono text-slate-500 uppercase tracking-tighter">
                                    {eq.kind === 'device' && eq.assigned_to
                                        ? `Opérateur: ${eq.assigned_to}`
                                        : `ID_${eq.id.substring(0, 8)}`}
                                </p>
                                <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[7px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Connecté
                                </span>
                                {eq.map_status ? (
                                    <span className={`inline-block mt-1 ml-1 px-1.5 py-0.5 rounded text-[7px] font-black uppercase border ${MAP_STATUS_COLORS[eq.map_status] || ''}`}>
                                        {MAP_STATUS_LABELS[eq.map_status] || eq.map_status}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Coordonnées</p>
                            {Number.isFinite(eq.lat) && Number.isFinite(eq.lng) ? (
                                <>
                                    <p className="text-[10px] font-mono text-blue-400/80">
                                        {Number(eq.lat).toFixed(6)}N / {Number(eq.lng).toFixed(6)}E
                                    </p>
                                    {eq.accuracy ? (
                                        <p className="text-[8px] font-mono text-slate-500 mt-1">
                                            ±{Math.round(eq.accuracy)} m
                                        </p>
                                    ) : null}
                                </>
                            ) : (
                                <p className="text-[10px] font-mono text-amber-400/80">GPS indisponible</p>
                            )}
                        </div>
                    </motion.button>
                    );
                })}
            </div>
        </div>
    );
};
