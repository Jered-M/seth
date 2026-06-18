import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Lock,
    Unlock,
    Building2,
    Edit2,
    Server,
    Briefcase,
    BarChart3,
    AlertCircle,
    Loader2,
    ShieldAlert,
    ShieldCheck,
    Search,
    TrendingUp,
    Plus,
    X,
    Users,
    Trash2,
    UserPlus,
} from 'lucide-react';
import api from '../services/api';

interface DepartmentAdmin {
    id: string;
    dept_id: string;
    name: string;
    email: string;
    department: string;
    role: string;
    status: 'active' | 'inactive';
    lastLogin: string | null;
    is_empty?: boolean;
}

interface UnassignedDeptAdmin {
    id: string;
    name: string;
    email: string;
}


export const AdminDepartments = () => {
    const [admins, setAdmins] = useState<DepartmentAdmin[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    const [showDeptModal, setShowDeptModal] = useState(false);
    const [newDeptName, setNewDeptName] = useState('');

    const [showAdminModal, setShowAdminModal] = useState(false);
    const [showAssignPicker, setShowAssignPicker] = useState(false);
    const [unassignedCache, setUnassignedCache] = useState<UnassignedDeptAdmin[]>([]);
    const [unassignedAdmins, setUnassignedAdmins] = useState<UnassignedDeptAdmin[]>([]);
    const [loadingUnassigned, setLoadingUnassigned] = useState(false);
    const [selectedRow, setSelectedRow] = useState<DepartmentAdmin | null>(null);
    const [formUsername, setFormUsername] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [formSubmitting, setFormSubmitting] = useState(false);

    const flash = (message: string, isError = false) => {
        if (isError) {
            setError(message);
            setSuccess(null);
        } else {
            setSuccess(message);
            setError(null);
        }
        setTimeout(() => {
            if (isError) setError(null);
            else setSuccess(null);
        }, 4000);
    };

    const fetchUnassignedAdmins = async (): Promise<UnassignedDeptAdmin[]> => {
        if (unassignedCache.length > 0) {
            return unassignedCache;
        }

        const response = await api.get<Array<{ id: string; name: string; email: string; role: string; department_id?: string | null }>>('/admin/users');
        const users = Array.isArray(response.data) ? response.data : [];
        const list = users
            .filter((u) => (u.role === 'ADMIN_DEPT' || u.role === 'DEPT_ADMIN') && !u.department_id)
            .map((u) => ({ id: u.id, name: u.name, email: u.email }));
        setUnassignedCache(list);
        return list;
    };

    const fetchAdmins = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get('/admin/departments');
            const data = response.data;

            if (Array.isArray(data)) {
                setAdmins(data);
            } else {
                setAdmins(data.departments || data.data || []);
                if (Array.isArray(data.unassignedAdmins)) {
                    setUnassignedCache(data.unassignedAdmins);
                }
            }
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { message?: string; error?: string } } };
            flash(ax.response?.data?.message || ax.response?.data?.error || 'Erreur de chargement', true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAdmins();
    }, []);

    const handleAddDepartment = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/admin/departments', { name: newDeptName.trim() });
            setNewDeptName('');
            setShowDeptModal(false);
            flash(`Département « ${newDeptName.trim()} » créé`);
            fetchAdmins();
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { message?: string; error?: string } } };
            flash(ax.response?.data?.message || ax.response?.data?.error || 'Erreur lors de la création', true);
        }
    };

    const toggleAdminStatus = async (row: DepartmentAdmin) => {
        if (row.is_empty) {
            openAssignModal(row);
            return;
        }

        const newStatus = row.status === 'active' ? 'inactive' : 'active';
        setActionLoadingId(row.id);
        try {
            await api.put(`/admin/departments/${row.id}/status`, { status: newStatus });
            setAdmins((prev) =>
                prev.map((a) => (a.id === row.id ? { ...a, status: newStatus as 'active' | 'inactive' } : a))
            );
            flash(
                newStatus === 'inactive'
                    ? `Nœud ${row.department} verrouillé (NODE_LOCKED)`
                    : `Nœud ${row.department} activé (NODE_ACTIVE)`
            );
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { message?: string; error?: string } } };
            flash(ax.response?.data?.message || ax.response?.data?.error || 'Erreur lors du changement de statut', true);
        } finally {
            setActionLoadingId(null);
        }
    };

    const openEditModal = (row: DepartmentAdmin) => {
        if (row.is_empty) {
            openAssignModal(row);
            return;
        }
        setSelectedRow(row);
        setFormUsername(row.name);
        setFormEmail(row.email === 'N/A' ? '' : row.email);
        setFormPassword('');
        setShowAdminModal(true);
    };

    const openAssignModal = async (row: DepartmentAdmin) => {
        setSelectedRow(row);
        setShowAssignPicker(true);
        setLoadingUnassigned(true);
        setUnassignedAdmins([]);
        try {
            const list = await fetchUnassignedAdmins();
            setUnassignedAdmins(list);
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { message?: string; error?: string } } };
            flash(ax.response?.data?.message || ax.response?.data?.error || 'Impossible de charger les administrateurs', true);
            setShowAssignPicker(false);
        } finally {
            setLoadingUnassigned(false);
        }
    };

    const assignExistingAdmin = async (admin: UnassignedDeptAdmin) => {
        if (!selectedRow) return;
        setFormSubmitting(true);
        try {
            await api.put(`/admin/users/${admin.id}/role`, {
                role: 'ADMIN_DEPT',
                department_id: selectedRow.dept_id,
            });
            setShowAssignPicker(false);
            setUnassignedCache([]);
            flash(`${admin.name} assigné à ${selectedRow.department} — activez le nœud pour l'accès`);
            fetchAdmins();
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { message?: string; error?: string } } };
            flash(ax.response?.data?.message || ax.response?.data?.error || 'Assignation impossible', true);
        } finally {
            setFormSubmitting(false);
        }
    };

    const handleAdminFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRow) return;

        setFormSubmitting(true);
        try {
            await api.put(`/admin/departments/${selectedRow.id}`, {
                username: formUsername.trim(),
                email: formEmail.trim(),
                ...(formPassword ? { password: formPassword } : {}),
            });
            flash(`Administrateur ${selectedRow.department} mis à jour`);
            setShowAdminModal(false);
            fetchAdmins();
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { message?: string; error?: string } } };
            flash(ax.response?.data?.message || ax.response?.data?.error || 'Erreur lors de l\'enregistrement', true);
        } finally {
            setFormSubmitting(false);
        }
    };

    const deleteDepartment = async (row: DepartmentAdmin) => {
        if (!row.is_empty) {
            flash('Retirez d\'abord l\'administrateur ou les utilisateurs du département', true);
            return;
        }
        if (!window.confirm(`Supprimer le département « ${row.department} » ?`)) return;

        setActionLoadingId(row.dept_id);
        try {
            await api.delete(`/admin/departments/${row.dept_id}`);
            flash(`Département ${row.department} supprimé`);
            fetchAdmins();
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { message?: string; error?: string } } };
            flash(ax.response?.data?.message || ax.response?.data?.error || 'Suppression impossible', true);
        } finally {
            setActionLoadingId(null);
        }
    };

    const departmentMeta: Record<string, { icon: React.ReactNode; color: string }> = {
        Informatique: { color: 'text-blue-400', icon: <Server className="w-5 h-5" /> },
        'Ressources Humaines': { color: 'text-purple-400', icon: <Users className="w-5 h-5" /> },
        Finance: { color: 'text-emerald-400', icon: <BarChart3 className="w-5 h-5" /> },
        Marketing: { color: 'text-amber-400', icon: <Briefcase className="w-5 h-5" /> },
    };

    const getDeptMeta = (name: string) =>
        departmentMeta[name] || { color: 'text-slate-400', icon: <Building2 className="w-5 h-5" /> };

    const filteredAdmins = admins.filter(
        (a) =>
            a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const statsOverview = [
        { label: 'Départements Gérés', value: admins.length, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        {
            label: 'Accès Actifs',
            value: admins.filter((a) => !a.is_empty && a.status === 'active').length,
            icon: ShieldCheck,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
        },
        { label: 'Alertes Système', value: 0, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
        { label: 'Trafic Nœud', value: '4.2', icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
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

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs font-bold uppercase tracking-widest">
                    {error}
                </div>
            )}
            {success && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs font-bold uppercase tracking-widest">
                    {success}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statsOverview.map((stat, i) => (
                    <motion.div
                        key={stat.label}
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8">
                    <div className="pro-card overflow-hidden">
                        <div className="p-6 border-b border-white/5 bg-white/[0.01]">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                                Registre des Administrateurs
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[720px] table-fixed">
                                <colgroup>
                                    <col className="w-[34%]" />
                                    <col className="w-[26%]" />
                                    <col className="w-[16%]" />
                                    <col className="w-[24%]" />
                                </colgroup>
                                <thead>
                                    <tr className="bg-[#0d1224] border-b border-white/5">
                                        <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Unité / Admin</th>
                                        <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Contact</th>
                                        <th className="px-6 py-4 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest">Accès</th>
                                        <th className="px-6 py-4 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest">Commandes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredAdmins.map((admin) => {
                                        const busy = actionLoadingId === admin.id || actionLoadingId === admin.dept_id;
                                        return (
                                            <tr
                                                key={admin.dept_id}
                                                className="hover:bg-white/[0.02] transition-colors group border-l-2 border-transparent hover:border-blue-600"
                                            >
                                                <td className="px-6 py-4 align-middle">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div
                                                            className={`shrink-0 w-9 h-9 bg-[#161b2e] border border-white/5 rounded flex items-center justify-center ${getDeptMeta(admin.department).color}`}
                                                        >
                                                            {getDeptMeta(admin.department).icon}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-white tracking-tight uppercase truncate">{admin.department}</p>
                                                            <p className="text-[9px] font-mono text-slate-500 italic truncate">
                                                                {admin.is_empty ? 'Aucun Administrateur' : admin.name}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 align-middle">
                                                    {admin.is_empty ? (
                                                        <span className="text-[10px] text-slate-600 uppercase">N/A</span>
                                                    ) : (
                                                        <a
                                                            href={`mailto:${admin.email}`}
                                                            className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-tight truncate block"
                                                        >
                                                            {admin.email}
                                                        </a>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center align-middle">
                                                    <span
                                                        className={`status-badge whitespace-nowrap ${
                                                            admin.status === 'active' && !admin.is_empty
                                                                ? 'status-secure'
                                                                : 'status-danger'
                                                        }`}
                                                    >
                                                        {admin.status === 'active' && !admin.is_empty ? 'NODE_ACTIVE' : 'NODE_LOCKED'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 align-middle">
                                                    <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                                                        {admin.is_empty ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => openAssignModal(admin)}
                                                                title="Assigner un administrateur"
                                                                className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded border border-transparent hover:border-blue-500/20 transition-all"
                                                            >
                                                                <UserPlus className="w-4 h-4" />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleAdminStatus(admin)}
                                                                disabled={busy}
                                                                title={
                                                                    admin.status === 'active'
                                                                        ? 'Verrouiller le nœud (NODE_LOCKED)'
                                                                        : 'Activer le nœud (NODE_ACTIVE)'
                                                                }
                                                                className={`p-1.5 rounded border border-transparent transition-all disabled:opacity-40 ${
                                                                    admin.status === 'active'
                                                                        ? 'text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/20'
                                                                        : 'text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/20'
                                                                }`}
                                                            >
                                                                {busy ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : admin.status === 'active' ? (
                                                                    <Lock className="w-4 h-4" />
                                                                ) : (
                                                                    <Unlock className="w-4 h-4" />
                                                                )}
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => openEditModal(admin)}
                                                            title={admin.is_empty ? 'Assigner administrateur' : 'Modifier administrateur'}
                                                            className="p-1.5 text-slate-500 hover:text-white rounded hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        {admin.is_empty ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => deleteDepartment(admin)}
                                                                disabled={busy}
                                                                title="Supprimer le département vide"
                                                                className="p-1.5 text-red-400 hover:bg-red-500/10 rounded border border-transparent hover:border-red-500/20 transition-all disabled:opacity-40"
                                                            >
                                                                {busy ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="w-4 h-4" />
                                                                )}
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

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
                        <div className="mt-4 pt-4 border-t border-white/5 space-y-2 text-[9px] text-slate-500 uppercase">
                            <div className="flex justify-between"><span>Verrouiller</span><span className="text-amber-400">NODE_LOCKED</span></div>
                            <div className="flex justify-between"><span>Activer</span><span className="text-emerald-400">NODE_ACTIVE</span></div>
                            <div className="flex justify-between"><span>+ Assigner admin</span><span className="text-blue-400">Dépt. vide</span></div>
                        </div>
                    </div>
                </div>
            </div>

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
                                <button type="button" onClick={() => setShowDeptModal(false)} className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white">
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
                                        onChange={(e) => setNewDeptName(e.target.value)}
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

            <AnimatePresence>
                {showAssignPicker && selectedRow && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAssignPicker(false)}
                            className="absolute inset-0 bg-black/90 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 30 }}
                            className="relative w-full max-w-md bg-[#0a0f1d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-6 border-b border-white/5 bg-white/[0.03] flex items-center justify-between">
                                <div>
                                    <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">
                                        Assigner un chef — {selectedRow.department}
                                    </h3>
                                    <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest">
                                        Cliquez sur un administrateur sans département
                                    </p>
                                </div>
                                <button type="button" onClick={() => setShowAssignPicker(false)} className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-4 max-h-[360px] overflow-y-auto">
                                {loadingUnassigned ? (
                                    <div className="flex justify-center py-10">
                                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                    </div>
                                ) : unassignedAdmins.length === 0 ? (
                                    <div className="text-center py-10 px-4 space-y-2">
                                        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">
                                            Aucun chef de département disponible
                                        </p>
                                        <p className="text-[10px] text-slate-600 leading-relaxed">
                                            Créez d&apos;abord un compte « Admin Dept » sans département dans Gestion des utilisateurs.
                                        </p>
                                    </div>
                                ) : (
                                    <ul className="space-y-2">
                                        {unassignedAdmins.map((admin) => (
                                            <li key={admin.id}>
                                                <button
                                                    type="button"
                                                    disabled={formSubmitting}
                                                    onClick={() => assignExistingAdmin(admin)}
                                                    className="w-full text-left px-4 py-3 rounded-lg border border-white/10 bg-[#060b18] hover:border-blue-500/40 hover:bg-blue-500/5 transition-all disabled:opacity-50 group"
                                                >
                                                    <p className="text-sm font-bold text-white group-hover:text-blue-300 uppercase tracking-tight">
                                                        {admin.name}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{admin.email}</p>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showAdminModal && selectedRow && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAdminModal(false)}
                            className="absolute inset-0 bg-black/90 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 30 }}
                            className="relative w-full max-w-md bg-[#0a0f1d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-6 border-b border-white/5 bg-white/[0.03] flex items-center justify-between">
                                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">
                                    Modifier Admin — {selectedRow.department}
                                </h3>
                                <button type="button" onClick={() => setShowAdminModal(false)} className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <form onSubmit={handleAdminFormSubmit} className="p-8 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Identifiant</label>
                                    <input
                                        type="text"
                                        required
                                        value={formUsername}
                                        onChange={(e) => setFormUsername(e.target.value)}
                                        className="w-full px-4 py-3 bg-[#060b18] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-600"
                                        placeholder="admin_logistique"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={formEmail}
                                        onChange={(e) => setFormEmail(e.target.value)}
                                        className="w-full px-4 py-3 bg-[#060b18] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-600"
                                        placeholder="admin@seth.com"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                        Nouveau mot de passe (optionnel)
                                    </label>
                                    <input
                                        type="password"
                                        value={formPassword}
                                        onChange={(e) => setFormPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-[#060b18] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-600"
                                        placeholder="Laisser vide pour ne pas changer"
                                    />
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button type="button" onClick={() => setShowAdminModal(false)} className="flex-1 py-3 border border-white/10 text-slate-400 rounded text-[10px] font-black uppercase tracking-widest hover:bg-white/5">ANNULER</button>
                                    <button type="submit" disabled={formSubmitting} className="flex-[2] py-3 bg-blue-600 text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50">
                                        {formSubmitting ? 'ENREGISTREMENT...' : 'ENREGISTRER'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminDepartments;
