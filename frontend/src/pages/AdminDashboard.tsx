import React, { useState, useEffect } from 'react';
import { 
    LayoutDashboard, 
    Building2, 
    Users, 
    Package, 
    AlertCircle, 
    Plus, 
    TrendingUp, 
    ShieldAlert, 
    Activity,
    Edit2,
    Trash2,
    X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { departmentService } from '../services/departmentService';

// Synchronizing with Sentinel Security Protocols

interface Stats {
    total_departments: number;
    total_users: number;
    total_equipment: number;
    security_alerts: number;
}

interface Department {
    id: string;
    name: string;
    admin_count: number;
    equipment_count: number;
    active_users: number;
}

export const AdminDashboard = () => {
    const [stats, setStats] = useState<Stats>({
        total_departments: 0,
        total_users: 0,
        total_equipment: 0,
        security_alerts: 0
    });
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newDept, setNewDept] = useState({ name: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsRes, deptsRes] = await Promise.all([
                    departmentService.getStats(),
                    departmentService.getAll()
                ]);
                setStats(statsRes.data);
                setDepartments(deptsRes.data);
            } catch (error) {
                console.error('Erreur lors du chargement des données:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const statsDisplay = [
        { label: 'DÉPARTEMENTS', value: stats.total_departments, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
        { label: 'UTILISATEURS', value: stats.total_users, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
        { label: 'ÉQUIPEMENTS', value: stats.total_equipment, icon: Package, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
        { label: 'ALERTES SÉCURITÉ', value: stats.security_alerts, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const handleCreateDepartment = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        
        try {
            if (!newDept.name.trim()) {
                setError('Le nom du département est requis');
                setIsSubmitting(false);
                return;
            }
            
            // Créer le département
            await departmentService.create({ name: newDept.name });
            
            // Recharger les données
            const [statsRes, deptsRes] = await Promise.all([
                departmentService.getStats(),
                departmentService.getAll()
            ]);
            setStats(statsRes.data);
            setDepartments(deptsRes.data);
            
            // Fermer le modal et réinitialiser
            setShowModal(false);
            setNewDept({ name: '' });
        } catch (err: any) {
            setError(err.response?.data?.message || 'Erreur lors de la création du département');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto">
            {/* Header Section */}
            <div className="flex justify-between items-end pb-4 border-b border-white/5">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Dashboard Opérationnel</h2>
                    <p className="text-slate-400 mt-1 uppercase text-[10px] tracking-[0.2em] font-black">Nœud Principal // Système de Surveillance Temps Réel</p>
                </div>
                <div className="flex gap-4">
                    <div className="px-4 py-2 bg-[#0a0f1d] border border-white/5 rounded-lg flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[10px] font-bold tracking-widest text-emerald-400">CONNEXION ÉTABLIE</span>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/40 text-xs font-bold uppercase tracking-widest"
                    >
                        <Plus className="w-4 h-4" />
                        Nouveau Nœud
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statsDisplay.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`pro-card p-6 ${stat.border} relative group overflow-hidden`}
                        >
                            <div className="relative z-10 flex items-center justify-between">
                                <div>
                                    <p className="text-slate-500 text-[10px] font-black tracking-widest mb-1">{stat.label}</p>
                                    <p className="text-3xl font-bold text-white tracking-tighter">{stat.value}</p>
                                </div>
                                <div className={`${stat.bg} ${stat.color} p-4 rounded-xl border ${stat.border} transition-transform group-hover:scale-110`}>
                                    <Icon className="w-6 h-6" />
                                </div>
                            </div>
                            <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: "65%" }}
                                    className={`h-full ${stat.color.replace('text', 'bg')}`}
                                ></motion.div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Main Dashboard Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Departments Monitoring */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="pro-card overflow-hidden">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-blue-400" />
                                Surveillance des Départements
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-white/[0.01]">
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Zone / Identifiant</th>
                                        <th className="px-6 py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Opérateurs</th>
                                        <th className="px-6 py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Actifs</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {departments.map((dept) => (
                                        <tr key={dept.id} className="hover:bg-white/[0.02] transition-colors border-l-2 border-transparent hover:border-blue-600">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-[#161b2e] border border-white/5 rounded flex items-center justify-center text-blue-400 font-bold">
                                                        {dept.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-white tracking-tight uppercase">{dept.name}</p>
                                                        <p className="text-[9px] font-mono text-slate-500">ID://{dept.id.substring(0, 8)}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded border border-blue-500/20">
                                                    {dept.admin_count} ADM
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-sm font-mono text-slate-300">{dept.equipment_count} EQ</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="status-badge status-secure">SÉCURISÉ</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Sidebar Monitoring */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Activity Telemetry */}
                    <div className="pro-card p-6 bg-gradient-to-br from-blue-600/10 to-transparent">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                            Activité Télémétrique
                        </h3>
                        <div className="space-y-4">
                            {[75, 45, 90, 60].map((val, i) => (
                                <div key={i} className="space-y-1.5">
                                    <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                        <span>CANAL_{i + 1}</span>
                                        <span>{val}%</span>
                                    </div>
                                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-600 rounded-full" style={{ width: `${val}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Alert Feed */}
                    <div className="pro-card p-6 border-red-500/20">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                            Flux d'Alertes
                        </h3>
                        <div className="space-y-4">
                            <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                                <p className="text-[10px] font-bold text-red-400 uppercase tracking-tight">Zone Compromise // B-12</p>
                                <p className="text-[9px] text-slate-500 mt-1">Intervention requise immédiate.</p>
                                <p className="text-[8px] font-mono text-red-500/60 mt-2">TIMESTAMP: 2026-04-09 00:12:33</p>
                            </div>
                            <div className="p-3 bg-white/5 border border-white/5 rounded-lg opacity-50">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Sortie Autorisée // A-05</p>
                                <p className="text-[9px] text-slate-500 mt-1">Opération terminée avec succès.</p>
                            </div>
                        </div>
                        <button className="w-full mt-6 py-2 border border-white/5 text-[9px] font-black text-slate-500 uppercase tracking-widest hover:bg-white/5 transition-all">
                            Voir historique complet
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de création de département */}
        <AnimatePresence>
            {showModal && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
                    onClick={() => setShowModal(false)}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="pro-card p-8 max-w-md w-full"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <Plus className="w-5 h-5 text-blue-400" />
                                Nouveau Nœud
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-white/10 rounded transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleCreateDepartment} className="space-y-4">
                            <div>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">
                                    Nom du Département
                                </label>
                                <input
                                    type="text"
                                    value={newDept.name}
                                    onChange={(e) => setNewDept({ name: e.target.value })}
                                    placeholder="Ex: Informatique, Ressources Humaines..."
                                    className="w-full px-4 py-2.5 bg-[#0a0f1d] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-600 text-sm"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-2.5 border border-white/10 text-slate-300 rounded-lg hover:bg-white/5 transition-colors font-bold text-sm uppercase tracking-widest"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold text-sm uppercase tracking-widest"
                                >
                                    {isSubmitting ? 'Création...' : 'Créer'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
        </div>
    );
};
