import { useState, useEffect } from 'react';
import { motion } from 'framer-motion'
import api from '../services/api';
import {
    Monitor,
    Clock,
    CheckCircle,
    AlertCircle,
    Package,
    Loader2,
    User,
    LogOut,
    QrCode,
    Activity,
    ShieldCheck,
    Navigation,
    Key,
    UserCircle,
    Smartphone,
    Cpu
} from 'lucide-react'

interface UserStats {
    equipment_assigned: number;
    recent_requests: number;
    pending_approvals: number;
}

interface Equipment {
    id: string;
    name: string;
    status: 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE';
    assignedTo?: string;
    assigned_to?: string;
}

export const UserDashboard = () => {
    const [stats, setStats] = useState<UserStats>({
        equipment_assigned: 0,
        recent_requests: 0,
        pending_approvals: 0
    });
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);

    const currentUser = (() => {
        try {
            const raw = localStorage.getItem('user');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    })();

    const pushCurrentPosition = async (deviceId: string) => {
        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    await api.post('/user/devices/position', {
                        device_id: deviceId,
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                } catch (err) {
                    console.error('Erreur sync GPS:', err);
                }
            },
            () => {
                // Permission refusée ou indisponible: on ne bloque pas l'UI.
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
        );
    };

    useEffect(() => {
        fetchUserData();
    }, []);

    const fetchUserData = async () => {
        try {
            const equipRes = await api.get('/equipments/');
            const equipData = Array.isArray(equipRes.data) ? equipRes.data : [];

            setEquipment(equipData);

            const myAssignedDevices = equipData.filter((e: Equipment) =>
                e.status === 'ASSIGNED' &&
                (e.assignedTo === currentUser?.name || e.assigned_to === currentUser?.name)
            );

            for (const device of myAssignedDevices) {
                pushCurrentPosition(device.id);
            }

            const assigned = (equipData as Equipment[]).filter((e: Equipment) => e.status === 'ASSIGNED').length;
            setStats({
                equipment_assigned: assigned,
                recent_requests: 0,
                pending_approvals: 0
            });
        } catch (error) {
            console.error('Error user dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const interval = setInterval(fetchUserData, 30000);
        return () => clearInterval(interval);
    }, []);

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'AVAILABLE': return 'status-secure';
            case 'ASSIGNED': return 'status-info';
            case 'MAINTENANCE': return 'status-danger';
            default: return 'status-info';
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight uppercase flex items-center gap-3">
                        <UserCircle className="w-8 h-8 text-blue-500" />
                        Terminal Opérateur
                    </h2>
                    <p className="text-slate-400 mt-1 uppercase text-[10px] tracking-[0.2em] font-black italic">
                        Sentinel Personnel Access // Zone_Utilisateur_Active
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-3 py-1.5 border border-emerald-500/20 rounded-full flex items-center gap-2">
                        <Activity className="w-3 h-3" /> Connecté_Sécurisé
                    </span>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Matériels Assignés', value: stats.equipment_assigned, icon: Cpu, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { label: 'Logs Récents', value: stats.recent_requests, icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/10' },
                    { label: 'Attente Validation', value: stats.pending_approvals, icon: ShieldAlert, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="pro-card p-6 flex items-center justify-between"
                    >
                        <div>
                            <p className="text-slate-500 text-[9px] font-black tracking-[0.2em] uppercase mb-1">{stat.label}</p>
                            <p className="text-2xl font-bold text-white tracking-tighter">{stat.value}</p>
                        </div>
                        <div className={`${stat.bg} ${stat.color} p-3 rounded-lg border border-white/5`}>
                            <stat.icon className="w-5 h-5" />
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Assets Grid */}
            <div className="pro-card overflow-hidden">
                <div className="p-6 border-b border-white/5 bg-white/[0.01]">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-blue-400" />
                        Mes Modules Actifs
                    </h3>
                </div>

                <div className="p-6">
                    {equipment.length === 0 ? (
                        <div className="p-20 text-center opacity-20">
                            <Monitor className="w-12 h-12 mx-auto mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">AUCUN MATÉRIEL LIÉ À CE COMPTE</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {equipment.map((item, i) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="bg-[#0a0f1d] border border-white/5 rounded-xl p-5 hover:border-blue-600/30 transition-all group relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                                        <Monitor className="w-16 h-16" />
                                    </div>
                                    <div className="relative z-10">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="p-2.5 bg-blue-600/10 border border-blue-500/20 rounded text-blue-400">
                                                <Smartphone className="w-5 h-5" />
                                            </div>
                                            <span className={`status-badge ${getStatusStyles(item.status)}`}>
                                                {item.status}
                                            </span>
                                        </div>
                                        <h4 className="font-black text-white text-[11px] uppercase tracking-widest mb-1">{item.name}</h4>
                                        <p className="text-[9px] font-mono text-slate-500 uppercase tracking-tighter">NODE_ID_{item.id.substring(0,8)}</p>
                                        
                                        <button className="mt-6 w-full py-2.5 bg-white/5 border border-white/10 rounded text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2">
                                            <QrCode className="w-3.5 h-3.5" />
                                            Scanner_Détails
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Tactical Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <motion.button
                    whileHover={{ scale: 1.01, backgroundColor: 'rgba(37, 99, 235, 1)' }}
                    whileTap={{ scale: 0.99 }}
                    className="flex items-center justify-center gap-4 py-6 px-8 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-900/40 text-[10px] font-black uppercase tracking-[0.3em] transition-all"
                >
                    <LogOut className="w-5 h-5" />
                    Requête_Autorisation_Sortie
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.01, backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
                    whileTap={{ scale: 0.99 }}
                    className="flex items-center justify-center gap-4 py-6 px-8 bg-white/5 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.3em] transition-all"
                >
                    <Key className="w-5 h-5 text-blue-400" />
                    Paramètres_Accès_Profil
                </motion.button>
            </div>
        </div>
    );
};

const ShieldAlert = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
);
