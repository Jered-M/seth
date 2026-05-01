import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    Lock, 
    Unlock, 
    Mail, 
    Users, 
    Building2, 
    Edit2, 
    Eye, 
    EyeOff, 
    Server, 
    Briefcase, 
    BarChart3, 
    Truck, 
    UserCheck, 
    AlertCircle, 
    Loader2,
    ShieldAlert,
    ShieldCheck,
    Search,
    TrendingUp,
    Plus,
    X
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

interface DepartmentAdmin {
    id: string;
    name: string;
    email: string;
    department: string;
    role: string;
    status: 'active' | 'inactive';
    lastLogin: string;
}

const API_BASE_URL = '/api';

export const AdminDepartments = () => {
    const [admins, setAdmins] = useState<DepartmentAdmin[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingAdmin, setEditingAdmin] = useState<DepartmentAdmin | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [showDeptModal, setShowDeptModal] = useState(false);
    const [newDeptName, setNewDeptName] = useState('');

    const handleAddDepartment = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${API_BASE_URL}/admin/departments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: newDeptName }),
                credentials: 'include'
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Erreur lors de la création');
            }

            setNewDeptName('');
            setShowDeptModal(false);
            // On rafraîchit pour voir si un nouvel admin peut être assigné (optionnel)
            window.location.reload(); 
        } catch (err: any) {
            setError(err.message);
        }
    };

    useEffect(() => {
        const fetchAdmins = async () => {
            try {
                setLoading(true);
                setError(null);
                const token = localStorage.getItem('access_token');
                const headers: HeadersInit = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;
                
                const response = await fetch(`${API_BASE_URL}/admin/departments`, {
                    method: 'GET',
                    headers,
                    credentials: 'include'
                });

                if (!response.ok) throw new Error(`Erreur ${response.status}`);
                const data = await response.json();
                setAdmins(Array.isArray(data) ? data : data.data || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Erreur inconnue');
            } finally {
                setLoading(false);
            }
        };
        fetchAdmins();
    }, []);

    const toggleAdminStatus = async (adminId: string) => {
        try {
            const admin = admins.find(a => a.id === adminId);
            if (!admin) return;
            const newStatus = admin.status === 'active' ? 'inactive' : 'active';
            const response = await fetch(`${API_BASE_URL}/admin/departments/${adminId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!response.ok) throw new Error('Erreur de mise à jour');
            setAdmins(admins.map(a => a.id === adminId ? { ...a, status: newStatus as 'active' | 'inactive' } : a));
        } catch (err) {
            setError('Erreur lors de la mise à jour du statut');
        }
    };

    const departmentMeta: Record<string, { icon: React.ReactNode; color: string }> = {
        'Informatique': { color: 'text-blue-400', icon: <Server className="w-5 h-5" /> },
        'Ressources Humaines': { color: 'text-purple-400', icon: <Users className="w-5 h-5" /> },
        'Finance': { color: 'text-emerald-400', icon: <BarChart3 className="w-5 h-5" /> },
        'Marketing': { color: 'text-amber-400', icon: <Briefcase className="w-5 h-5" /> },
    };

    const getDeptMeta = (name: string) => departmentMeta[name] || { color: 'text-slate-400', icon: <Building2 className="w-5 h-5" /> };

    const statsOverview = [
        { label: 'Départements Gérés', value: admins.length, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'Accès Actifs', value: admins.filter(a => a.status === 'active').length, icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'Alertes Système', value: 0, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
        { label: 'Trafic Nœud', value: '4.2', icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    ];

    const filteredAdmins = admins.filter(a => 
        a.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        a.department?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight uppercase flex items-center gap-3">
                        <Building2 className="w-8 h-8 text-blue-500" />
                        Unités de Commandement
                    </h2>
                    <p className="text-slate-400 mt-1 uppercase text-[10px] tracking-[0.2em] font-black italic">
                        Sentinel Departmental Hub // Gestion des Administrations
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-blue-400" />
                        <input
                            type="text"
                            placeholder="FILTRER..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-[#0a0f1d] border border-white/5 rounded text-[10px] font-mono tracking-widest text-slate-300 focus:outline-none focus:border-blue-600/50 w-48 transition-all"
                        />
                    </div>
                    <button
                        onClick={() => setShowDeptModal(true)}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20 text-[10px] font-black uppercase tracking-widest"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        AJOUTER DÉPARTEMENT
                    </button>
                </div>
            </div>

            {/* Modal Ajout Département */}
            <AnimatePresence>
                {showDeptModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowDeptModal(false)}
                            className="absolute inset-0 bg-black/90 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 30 }}
                            className="relative w-full max-w-md bg-[#0a0f1d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-6 border-b border-white/5 bg-white/[0.03] flex items-center justify-between">
                                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-blue-500" />
                                    Nouveau Département
                                </h3>
                                <button onClick={() => setShowDeptModal(false)} className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <form onSubmit={handleAddDepartment} className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Nom du Département</label>
                                    <input
                                        type="text"
                                        required
                                        autoFocus
                                        value={newDeptName}
                                        onChange={e => setNewDeptName(e.target.value)}
                                        className="w-full px-4 py-3 bg-[#060b18] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-600"
                                        placeholder="EX: LOGISTIQUE, SÉCURITÉ..."
                                    />
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button type="button" onClick={() => setShowDeptModal(false)} className="flex-1 py-3 border border-white/10 text-slate-400 rounded text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">ANNULER</button>
                                    <button type="submit" className="flex-[2] py-3 bg-blue-600 text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-600/20">CRÉER DÉPARTEMENT</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Error */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-xs font-bold uppercase tracking-widest">
                    ERREUR SYSTÈME: {error}
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statsOverview.map((stat, i) => (
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

            {/* Main Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Table View */}
                <div className="lg:col-span-8">
                    <div className="pro-card overflow-hidden">
                        <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                                Registre des Administrateurs
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-[#0d1224] border-b border-white/5">
                                        <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Unité / Admin</th>
                                        <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Contact</th>
                                        <th className="px-6 py-4 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest">Accès</th>
                                        <th className="px-6 py-4 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest">Commandes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredAdmins.map((admin) => (
                                        <tr key={admin.id} className="hover:bg-white/[0.02] transition-colors group border-l-2 border-transparent hover:border-blue-600">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 bg-[#161b2e] border border-white/5 rounded flex items-center justify-center ${getDeptMeta(admin.department).color}`}>
                                                        {getDeptMeta(admin.department).icon}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-white tracking-tight uppercase">{admin.department}</p>
                                                        <p className="text-[9px] font-mono text-slate-500 italic block">{admin.name}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <a href={`mailto:${admin.email}`} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-tight">
                                                    {admin.email}
                                                </a>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`status-badge ${admin.status === 'active' ? 'status-secure' : 'status-danger'}`}>
                                                    {admin.status === 'active' ? 'NODE_ACTIVE' : 'NODE_LOCKED'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => toggleAdminStatus(admin.id)} className={`p-1.5 rounded border border-transparent transition-all ${admin.status === 'active' ? 'text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/20' : 'text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/20'}`}>
                                                        {admin.status === 'active' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                                    </button>
                                                    <button className="p-1.5 text-slate-600 hover:text-white rounded hover:bg-white/5 transition-all"><Edit2 className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Info Sidebar */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="pro-card p-6 bg-gradient-to-br from-blue-600/10 to-transparent border-blue-500/20">
                        <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-blue-400" />
                            Alerte de Contrôle
                        </h4>
                        <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-tighter italic">
                            En tant que Super Administrateur, vous détenez le contrôle cryptographique sur les accès de chaque administrateur. 
                            Toute action de révocation (NODE_LOCKED) déconnecte immédiatement l'opérateur concerné et bloque l'accès aux actifs du département.
                        </p>
                        <div className="mt-4 pt-4 border-t border-white/5">
                            <div className="flex items-center justify-between text-[9px] font-bold text-slate-600 uppercase">
                                <span>Dernier Audit</span>
                                <span>{new Date().toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="pro-card p-6 border-amber-500/20">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Statuts des Nœuds</h4>
                        <div className="space-y-3">
                            {['Apt-1', 'Apt-2', 'Apt-3'].map((node, i) => (
                                <div key={i} className="flex items-center justify-between p-2 bg-[#0a0f1d] rounded border border-white/5">
                                    <span className="text-[9px] font-mono text-slate-400 uppercase">NODE_{node}</span>
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDepartments;
