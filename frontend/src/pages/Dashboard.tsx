import { useState, useEffect } from 'react';
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
    Monitor,
    ArrowUpRight,
    ArrowDownLeft,
    AlertCircle,
    Package,
    Activity,
    ShieldCheck,
    Loader2,
    Database,
    Zap,
    TrendingUp,
    ShieldAlert,
    Clock,
    LayoutDashboard
} from 'lucide-react'
import { equipmentService, Stats } from '../services/equipmentService';

const API_BASE_URL = '/api';

interface RecentActivity {
    id: string;
    type: 'ASSIGNED' | 'AVAILABLE' | 'MAINTENANCE';
    user: string;
    item: string;
    time: string;
}

interface DepartmentStats {
    name: string;
    count: number;
    percentage: number;
}

export const Dashboard = () => {
    const [stats, setStats] = useState<Stats>({ total: 0, available: 0, busy: 0, maintenance: 0 });
    const [activities, setActivities] = useState<RecentActivity[]>([]);
    const [departments, setDepartments] = useState<DepartmentStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem('access_token');
                const headers: HeadersInit = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;
                
                const statsFromService = await equipmentService.getStats();
                setStats(statsFromService);
                
                const activitiesRes = await fetch(`${API_BASE_URL}/dashboard/recent-activities`, { method: 'GET', headers, credentials: 'include' });
                if (activitiesRes.ok) {
                    const activitiesData = await activitiesRes.json();
                    setActivities(Array.isArray(activitiesData) ? activitiesData : []);
                }
                
                const deptRes = await fetch(`${API_BASE_URL}/dashboard/department-distribution`, { method: 'GET', headers, credentials: 'include' });
                if (deptRes.ok) {
                    const deptData = await deptRes.json();
                    setDepartments(Array.isArray(deptData) ? deptData : []);
                }
            } catch (error) {
                console.error('Error dashboard:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, []);

    const statsDisplay = [
        { label: 'Total Assets', value: stats.total, icon: Database, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'En Usage', value: stats.busy, icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        { label: 'Maintenance', value: stats.maintenance, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
        { label: 'Opérationnels', value: stats.available, icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    ]

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="pb-4 lg:pb-6 border-b border-white/5">
                <h2 className="text-xl lg:text-3xl font-bold text-white tracking-tight uppercase flex items-center gap-3">
                    <LayoutDashboard className="w-6 h-6 lg:w-8 lg:h-8 text-blue-500" />
                    Centre de Contrôle
                </h2>
                <p className="text-slate-400 mt-1 uppercase text-[9px] lg:text-[10px] tracking-[0.2em] font-black italic">
                    Sentinel Core OS
                </p>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {loading ? (
                    Array(4).fill(0).map((_, i) => (
                        <div key={i} className="pro-card h-32 bg-white/5 animate-pulse" />
                    ))
                ) : (
                    statsDisplay.map((stat, i) => (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            key={stat.label}
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
                    ))
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Recent Activities */}
                <div className="lg:col-span-8">
                    <div className="pro-card overflow-hidden">
                        <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Activity className="w-4 h-4 text-blue-400" />
                                Journal des Activités_Flux
                            </h3>
                            <Link to="/tracking" className="text-[9px] font-bold text-blue-400 hover:text-white uppercase">Explorer_Tout</Link>
                        </div>
                        <div className="p-4 space-y-3">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                                </div>
                            ) : activities.length > 0 ? (
                                activities.map((activity, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-[#0a0f1d] border border-white/5 rounded-lg group hover:border-blue-600/20 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-8 h-8 rounded border flex items-center justify-center ${
                                                activity.type === 'ASSIGNED' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                activity.type === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                                                'bg-red-500/10 text-red-500 border-red-500/20'
                                            }`}>
                                                {activity.type === 'ASSIGNED' ? <ArrowUpRight className="w-4 h-4" /> :
                                                 activity.type === 'AVAILABLE' ? <ArrowDownLeft className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-bold text-white uppercase tracking-tight">{activity.item}</p>
                                                <p className="text-[9px] text-slate-500 uppercase font-mono tracking-tighter">OPÉRATEUR : {activity.user.toUpperCase()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[9px] text-slate-600 font-mono uppercase italic">{activity.time}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-20 text-center opacity-20">
                                    <Clock className="w-12 h-12 mx-auto mb-4" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">AUCUN ÉVÉNEMENT RÉPERTORIÉ</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Distribution & Security */}
                <div className="lg:col-span-4 space-y-8">
                    {/* Department Distribution */}
                    <div className="pro-card p-6">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-500" />
                            Répartition_Service
                        </h3>
                        <div className="space-y-6">
                            {loading ? (
                                <div className="space-y-4">
                                    {Array(3).fill(0).map((_, i) => <div key={i} className="h-4 bg-white/5 rounded" />)}
                                </div>
                            ) : departments.length > 0 ? (
                                departments.map((dep) => (
                                    <div key={dep.name} className="space-y-2">
                                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                                            <span className="text-slate-500">{dep.name}</span>
                                            <span className="text-white">{Math.round(dep.percentage)}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-[#0a0f1d] rounded-full overflow-hidden border border-white/5">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${dep.percentage}%` }}
                                                className="h-full bg-blue-600 shadow-[0_0_10px_#2563eb]"
                                            ></motion.div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-[9px] font-black text-slate-700 uppercase">DONNÉES_ABSENTES</p>
                            )}
                        </div>
                    </div>

                    {/* Security Status Panel */}
                    <div className="pro-card p-6 relative overflow-hidden bg-gradient-to-br from-blue-600/20 to-transparent border-blue-500/20">
                        <div className="absolute inset-0 tactical-grid opacity-10 pointer-events-none"></div>
                        <div className="relative z-10 space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[11px] font-black text-white uppercase tracking-widest">État de Sécurité</h3>
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full border-2 border-emerald-500 flex items-center justify-center font-black text-white text-lg shadow-[0_0_15px_#10b98120]">
                                    98%
                                </div>
                                <div>
                                    <p className="font-black text-white text-[11px] uppercase tracking-widest">Système Protégé</p>
                                    <p className="text-[9px] text-slate-400 uppercase italic">Protocole d'audit opérationnel</p>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                                    <span className="text-slate-500">Dernier Scan</span>
                                    <span className="text-emerald-500">OK // 10:45</span>
                                </div>
                                <Link to="/security" className="block w-full py-3 bg-blue-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded text-center hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-900/40">
                                    Accéder_Journal_Alertes
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
