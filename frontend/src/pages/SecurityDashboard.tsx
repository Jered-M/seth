import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
    Shield, 
    AlertTriangle, 
    ShieldCheck, 
    Clock, 
    ShieldAlert, 
    Activity, 
    MapPin, 
    Search, 
    Filter,
    Radar,
    Zap,
    Loader2
} from 'lucide-react';
import api from '../services/api';
import Map2D from '../components/Map2D';

interface SecurityAlert {
    id: string;
    type: string;
    message: string;
    severity: string;
    status: string;
    createdAt: string;
}

interface SecurityStats {
    total_alerts: number;
    pending_alerts: number;
    failed_logins_24h: number;
    system_risk_score: number;
}

interface EquipmentPosition {
    id: string;
    name: string;
    type: string;
    lat: number;
    lng: number;
    status: string;
}

export const SecurityDashboard = () => {
    const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
    const [stats, setStats] = useState<SecurityStats | null>(null);
    const [equipments, setEquipments] = useState<EquipmentPosition[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSecurityData = async () => {
        try {
            const [alertsRes, statsRes, equipRes] = await Promise.all([
                api.get('/security/alerts'),
                api.get('/security/stats'),
                api.get('/equipments/')
            ]);
            setAlerts(alertsRes.data);
            setStats(statsRes.data);
            
            const mappedEquip = (Array.isArray(equipRes.data) ? equipRes.data : [])
                .map((e: any) => ({
                    id: e.id,
                    name: e.serialNumber || e.serial_number || e.id,
                    type: e.type,
                    lat: Number(e.last_known_lat),
                    lng: Number(e.last_known_lng),
                    status: e.status,
                    assignedTo: e.assignedTo,
                }))
                .filter((e: any) => Number.isFinite(e.lat) && Number.isFinite(e.lng) && !!e.assignedTo);
            
            setEquipments(mappedEquip);
        } catch (error) {
            console.error('Error fetching security data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSecurityData();
        const interval = setInterval(fetchSecurityData, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return (
        <div className="flex h-96 items-center justify-center">
            <div className="text-center">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">SYNCHRONISATION_SENTINEL...</p>
            </div>
        </div>
    );

    const getRiskStyles = (score: number) => {
        if (score > 70) return { text: 'text-red-500', bar: 'bg-red-500', border: 'border-red-500/20', bg: 'bg-red-500/5', label: 'CRITIQUE' };
        if (score > 40) return { text: 'text-amber-500', bar: 'bg-amber-500', border: 'border-amber-500/20', bg: 'bg-amber-500/5', label: 'ÉLEVÉ' };
        return { text: 'text-emerald-500', bar: 'bg-emerald-500', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', label: 'SÉCURISÉ' };
    };

    const risk = getRiskStyles(stats?.system_risk_score || 0);

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* Header & Risk Gauge */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8 border-b border-white/5">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight uppercase flex items-center gap-3">
                        <Radar className="w-8 h-8 text-blue-500" />
                        Commandement Sécurité
                    </h2>
                    <p className="text-slate-400 mt-1 uppercase text-[10px] tracking-[0.2em] font-black italic">
                        Sentinel Network Defense // Analyse de Risque Heuristique
                    </p>
                </div>
                
                <div className={`flex items-center gap-6 px-8 py-4 rounded-xl border ${risk.border} ${risk.bg} backdrop-blur-md`}>
                    <div className="text-right">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Impact Risque Global</p>
                        <h2 className={`text-2xl font-black ${risk.text} tracking-tighter`}>{stats?.system_risk_score || 0}% - {risk.label}</h2>
                    </div>
                    <div className="w-4 h-14 bg-white/5 rounded-full overflow-hidden flex items-end border border-white/5">
                        <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${stats?.system_risk_score || 0}%` }}
                            className={`w-full ${risk.bar} transition-all duration-1000 shadow-[0_0_15px_rgba(255,255,255,0.2)]`} 
                        />
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="pro-card p-6 border-white/5 group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Alertes Détectées</p>
                            <h3 className="text-3xl font-bold text-white tracking-tighter mt-1">{stats?.total_alerts || 0}</h3>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-lg group-hover:scale-110 transition-transform border border-blue-500/10">
                            <Shield className="w-5 h-5 text-blue-400" />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-[9px] font-bold text-emerald-500 uppercase">
                        <Zap className="w-3 h-3" /> Système Nominal
                    </div>
                </div>

                <div className="pro-card p-6 border-red-500/20 group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">En Attente</p>
                            <h3 className="text-3xl font-bold text-red-500 tracking-tighter mt-1">{stats?.pending_alerts || 0}</h3>
                        </div>
                        <div className="p-3 bg-red-500/10 rounded-lg group-hover:scale-110 transition-transform border border-red-500/10">
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-[9px] font-bold text-red-400 uppercase animate-pulse">
                        <ShieldAlert className="w-3 h-3" /> Intervention Requise
                    </div>
                </div>

                <div className="pro-card p-6 border-amber-500/20 group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Échecs Intrusion</p>
                            <h3 className="text-3xl font-bold text-amber-500 tracking-tighter mt-1">{stats?.failed_logins_24h || 0}</h3>
                        </div>
                        <div className="p-3 bg-amber-500/10 rounded-lg group-hover:scale-110 transition-transform border border-amber-500/10">
                            <ShieldAlert className="w-5 h-5 text-amber-400" />
                        </div>
                    </div>
                    <div className="mt-4 text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Tentatives / 24h</div>
                </div>

                <div className="pro-card p-6 border-emerald-500/20 group">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Nœuds Sécurisés</p>
                            <h3 className="text-3xl font-bold text-emerald-500 tracking-tighter mt-1">{equipments.length}</h3>
                        </div>
                        <div className="p-3 bg-emerald-500/10 rounded-lg group-hover:scale-110 transition-transform border border-emerald-500/10">
                            <MapPin className="w-5 h-5 text-emerald-400" />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase">
                        <CheckIcon className="w-3 h-3 text-emerald-500" /> Geofencing Actif
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Surveillance Monitor */}
                <div className="xl:col-span-2">
                    <div className="pro-card overflow-hidden h-[600px] relative border-white/5">
                        <div className="absolute inset-0 tactical-grid opacity-10 pointer-events-none"></div>
                        <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between relative z-10">
                            <div>
                                <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Moniteur de Zone</h3>
                                <p className="text-[8px] text-slate-500 uppercase italic">Détection de mouvements & Anomalies GPS</p>
                            </div>
                            <div className="flex gap-2">
                                <button title="Rechercher" className="p-2 text-slate-500 hover:text-white bg-white/5 rounded border border-white/5"><Search className="w-3.5 h-3.5"/></button>
                                <button title="Filtrer" className="p-2 text-slate-500 hover:text-white bg-white/5 rounded border border-white/5"><Filter className="w-3.5 h-3.5"/></button>
                            </div>
                        </div>
                        <div className="h-full bg-[#0d1224]">
                            <Map2D equipments={equipments} />
                        </div>
                    </div>
                </div>

                {/* Alert Feed */}
                <div className="pro-card overflow-hidden flex flex-col border-white/5">
                    <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-500" />
                            Journal des Signaux
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[500px] custom-scrollbar">
                        {alerts.map((alert) => (
                            <motion.div 
                                key={alert.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="p-4 bg-[#0a0f1d] border border-white/5 rounded-lg group hover:border-blue-600/30 transition-all"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                        alert.severity === 'CRITICAL' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                        alert.severity === 'HIGH' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                        'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                    }`}>
                                        {alert.severity}
                                    </span>
                                    <span className="text-[8px] font-mono text-slate-600 uppercase">{new Date(alert.createdAt).toLocaleTimeString()}</span>
                                </div>
                                <h4 className="font-bold text-slate-300 uppercase text-[10px] tracking-tight mb-1">{alert.type.replace('_', ' ')}</h4>
                                <p className="text-[10px] text-slate-500 line-clamp-2 italic tracking-tighter">"{alert.message}"</p>
                                <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${alert.status === 'PENDING' ? 'text-amber-500' : 'text-emerald-500'}`}>
                                        ● {alert.status === 'PENDING' ? 'EN_COURS' : 'TRAITÉ'}
                                    </span>
                                    <button className="text-[8px] font-black text-blue-400 hover:text-white transition-colors uppercase tracking-widest">Analyser_Signal</button>
                                </div>
                            </motion.div>
                        ))}
                        {alerts.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-20">
                                <ShieldCheck className="w-12 h-12 mb-4" />
                                <p className="font-black uppercase tracking-[0.2em] text-[10px]">SILENCE_OPÉRATIONNEL</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const CheckIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
);
