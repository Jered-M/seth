import React, { useEffect, useMemo, useState } from 'react';
import { 
    UserPlus, 
    ShieldCheck, 
    Search, 
    MoreVertical, 
    Users, 
    UserCheck, 
    UserX, 
    ShieldAlert,
    LayoutDashboard,
    Trash2,
    ToggleLeft,
    ToggleRight,
    MapPin,
    Monitor,
    Plus,
    Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

type ApiUser = {
    id: string;
    email: string;
    name: string;
    role?: string;
    createdAt?: string;
    status?: string;
    department?: string;
    assigned_device?: {
        id: string;
        name: string;
        serial: string;
    } | null;
};

type Department = {
    id: string;
    name: string;
};

type DeviceOption = {
    id: string;
    name: string;
    serial: string;
    status: string;
    assigned_to?: string | null;
};

type UserLocation = {
    user_id: string;
    last_login?: string | null;
    location?: {
        lat?: number;
        lng?: number;
        accuracy?: number;
    } | null;
};

const normalizeRole = (role?: string): string => {
    if (!role) return '';
    const map: Record<string, string> = {
        ADMIN_GENERAL: 'SUPER_ADMIN',
        ADMIN_DEPT: 'DEPT_ADMIN',
        SECURITY_AGENT: 'GARDIEN'
    };
    return map[role] || role;
};

export const UserManagement = () => {
    const [users, setUsers] = useState<ApiUser[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [devices, setDevices] = useState<DeviceOption[]>([]);
    const [locations, setLocations] = useState<Record<string, UserLocation>>({});
    const [selectedDeviceByUser, setSelectedDeviceByUser] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [newUser, setNewUser] = useState({
        name: '',
        email: '',
        role: 'USER',
        password: '',
        department_id: ''
    });

    const currentUser = useMemo(() => {
        try {
            const userStr = localStorage.getItem('user');
            return userStr ? JSON.parse(userStr) : null;
        } catch {
            return null;
        }
    }, []);

    const normalizedRole = normalizeRole(currentUser?.role);
    const isSupervisor = normalizedRole === 'SUPERVISOR';
    const isSuperAdmin = normalizedRole === 'SUPER_ADMIN';
    const isDeptAdmin = normalizedRole === 'DEPT_ADMIN';

    const fetchUsers = async () => {
        try {
            const endpoint = isSupervisor ? '/supervisor/users' : isDeptAdmin ? '/dept/users' : '/admin/users';
            const response = await api.get(endpoint);
            setUsers(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching users:', error);
            setUsers([]);
        }
    };

    const fetchDepartments = async () => {
        if (isSupervisor || isDeptAdmin) return;
        try {
            const response = await api.get('/admin/departments');
            if (Array.isArray(response.data)) {
                const depts = response.data
                    .filter((admin: any) => admin.department)
                    .map((admin: any) => ({
                        id: admin.department_id,
                        name: admin.department
                    }));
                const uniqueDepts = Array.from(new Map(depts.map(d => [d.id, d])).values());
                setDepartments(uniqueDepts);
            }
        } catch (error) {
            console.error('Error fetching departments:', error);
        }
    };

    const fetchDevices = async () => {
        if (!isSupervisor) return;
        try {
            const response = await api.get('/supervisor/devices');
            setDevices(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching devices:', error);
            setDevices([]);
        }
    };

    const fetchLocations = async () => {
        if (!isSupervisor) return;
        try {
            const response = await api.get('/supervisor/users/locations');
            const rows: UserLocation[] = Array.isArray(response.data) ? response.data : [];
            const byUser: Record<string, UserLocation> = {};
            rows.forEach((row) => {
                byUser[row.user_id] = row;
            });
            setLocations(byUser);
        } catch (error) {
            console.error('Error fetching locations:', error);
            setLocations({});
        }
    };

    const refreshAll = async () => {
        setLoading(true);
        await Promise.all([fetchUsers(), fetchDepartments(), fetchDevices(), fetchLocations()]);
        setLoading(false);
    };

    useEffect(() => {
        refreshAll();
    }, []);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        try {
            if (isSupervisor) {
                await api.post('/supervisor/users', { name: newUser.name, email: newUser.email, password: newUser.password });
            } else if (isDeptAdmin) {
                await api.post('/dept/users', { name: newUser.name, email: newUser.email, password: newUser.password });
            } else {
                const payload = {
                    name: newUser.name,
                    email: newUser.email,
                    role: newUser.role,
                    password: newUser.password,
                    ...(newUser.role === 'DEPT_ADMIN' && newUser.department_id ? { department_id: newUser.department_id } : {})
                };
                await api.post('/admin/users', payload);
            }
            setShowAddForm(false);
            setNewUser({ name: '', email: '', role: 'USER', password: '', department_id: '' });
            await refreshAll();
        } catch (error: any) {
            setFormError(error?.response?.data?.message || error?.message || 'Erreur lors de la création');
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (!isSuperAdmin) return;
        if (window.confirm('Voulez-vous vraiment supprimer cet utilisateur ?')) {
            try {
                await api.delete(`/admin/users/${id}`);
                await refreshAll();
            } catch (error) {
                console.error('Error deleting user:', error);
            }
        }
    };

    const handleToggleActivation = async (id: string, currentlyActive: boolean) => {
        if (!isSuperAdmin) return;
        try {
            await api.put(`/admin/users/${id}/activation`, { active: !currentlyActive });
            await refreshAll();
        } catch (error) {
            console.error('Error toggling activation:', error);
        }
    };

    const handleAssignDevice = async (userId: string) => {
        const deviceId = selectedDeviceByUser[userId];
        if (!deviceId) return;
        try {
            await api.post(`/supervisor/users/${userId}/assign-device`, { device_id: deviceId });
            await refreshAll();
        } catch (error) {
            console.error('Error assigning device:', error);
        }
    };

    const filteredUsers = users.filter(u => 
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const statsOverview = [
        { label: 'Total Opérateurs', value: users.length, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'Actifs', value: users.filter(u => u.status === 'active').length, icon: UserCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'En Attente', value: users.filter(u => u.status === 'inactive').length, icon: ShieldAlert, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        { label: 'Inactifs', value: users.filter(u => u.status !== 'active' && u.status !== 'inactive').length, icon: UserX, color: 'text-red-400', bg: 'bg-red-500/10' },
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
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight uppercase flex items-center gap-3">
                        <Users className="w-8 h-8 text-blue-500" />
                        Gestion du Personnel
                    </h2>
                    <p className="text-slate-400 mt-1 uppercase text-[10px] tracking-[0.2em] font-black italic">
                        Sentinel Access Control // Nœud d'Audit des Utilisateurs
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-blue-400" />
                        <input
                            type="text"
                            placeholder="RECHERCHER OPÉRATEUR..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-[#0a0f1d] border border-white/5 rounded text-[10px] font-mono tracking-widest text-slate-300 focus:outline-none focus:border-blue-600/50 w-64 transition-all"
                        />
                    </div>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20 text-[10px] font-black uppercase tracking-widest"
                    >
                        <UserPlus className="w-3.5 h-3.5" />
                        {showAddForm ? 'ANNULER' : 'AJOUTER OPÉRATEUR'}
                    </button>
                </div>
            </div>

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

            <AnimatePresence>
                {showAddForm && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, height: 0 }}
                        animate={{ opacity: 1, scale: 1, height: 'auto' }}
                        exit={{ opacity: 0, scale: 0.95, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="pro-card p-8 border-blue-600/20 mb-8 bg-blue-600/[0.02]">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Plus className="w-4 h-4 text-blue-400" />
                                Nouveau Dossier Opérateur
                            </h3>
                            {formError && (
                                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-[10px] font-bold uppercase tracking-tight">
                                    {formError}
                                </div>
                            )}
                            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Nom de Code</label>
                                    <input
                                        type="text"
                                        required
                                        value={newUser.name}
                                        onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-[#060b18] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-600"
                                        placeholder="NOM COMPLET..."
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Canal Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={newUser.email}
                                        onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-[#060b18] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-600"
                                        placeholder="EMAIL@SYSTEM..."
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Clé d'Accès</label>
                                    <input
                                        type="password"
                                        required
                                        value={newUser.password}
                                        onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-[#060b18] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-600"
                                        placeholder="CLÉ SÉCURISÉE..."
                                    />
                                </div>
                                <div className="flex gap-3">
                                    {!isSupervisor && !isDeptAdmin && (
                                        <select
                                            title="Rôle utilisateur"
                                            value={newUser.role}
                                            onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                            className="flex-1 px-4 py-2.5 bg-[#060b18] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-blue-600 uppercase"
                                        >
                                            <option value="USER">Opérateur</option>
                                            <option value="DEPT_ADMIN">Admin Dept</option>
                                            <option value="SUPERVISOR">Superviseur</option>
                                        </select>
                                    )}
                                    <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all">
                                        INITIALISER
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* List */}
            <div className="pro-card overflow-hidden">
                <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                        Registre des Accréditations
                    </h3>
                    <div className="text-[9px] font-bold text-slate-500 uppercase">
                        {filteredUsers.length} OPÉRATEURS_DOSSIERS
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-[#0d1224] border-b border-white/5">
                                <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Identité</th>
                                <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Rôle / Service</th>
                                <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Département</th>
                                <th className="px-6 py-4 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest">Autorisation</th>
                                {isSupervisor && <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Asset Assigné</th>}
                                <th className="px-6 py-4 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredUsers.map((user, i) => {
                                const rowRole = normalizeRole(user.role);
                                const rowLoc = locations[user.id];
                                const loc = rowLoc?.location;
                                return (
                                    <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 bg-[#161b2e] border border-white/5 rounded flex items-center justify-center text-blue-400 text-xs font-black">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-white tracking-tight uppercase">{user.name}</p>
                                                    <p className="text-[9px] font-mono text-slate-500">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                                                rowRole === 'SUPER_ADMIN' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                rowRole === 'DEPT_ADMIN' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                rowRole === 'SUPERVISOR' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                rowRole === 'GARDIEN' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                                'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                            }`}>
                                                {rowRole || 'OPÉRATEUR'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 font-bold text-slate-500 text-[10px] uppercase">
                                                <LayoutDashboard className="w-3 h-3 text-slate-700" />
                                                {user.department || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`status-badge ${user.status === 'active' ? 'status-secure' : 'status-danger'}`}>
                                                {user.status === 'active' ? 'ACCÈS_AUTORISÉ' : 'ACCÈS_RÉVOQUÉ'}
                                            </span>
                                        </td>
                                        {isSupervisor && (
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                                                    <Monitor className="w-3.5 h-3.5 text-blue-400" />
                                                    {user.assigned_device ? user.assigned_device.serial : '--'}
                                                </div>
                                            </td>
                                        )}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3 justify-end">
                                                {isSuperAdmin && (
                                                    <button
                                                        onClick={() => handleToggleActivation(user.id, user.status === 'active')}
                                                        className={`p-1.5 rounded transition-all border border-transparent ${
                                                            user.status === 'active' 
                                                                ? 'text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/20' 
                                                                : 'text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/20'
                                                        }`}
                                                        title={user.status === 'active' ? 'Révoquer Accès' : 'Autoriser Accès'}
                                                    >
                                                        {user.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                                    </button>
                                                )}
                                                {isSuperAdmin && (
                                                    <button
                                                        onClick={() => handleDeleteUser(user.id)}
                                                        className="p-1.5 text-red-500 hover:bg-red-500/10 hover:border-red-500/20 rounded transition-all border border-transparent"
                                                        title="Purge Dossier"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {isSupervisor && (
                                                    <div className="flex items-center gap-2">
                                                        <select
                                                            title="Sélection du matériel"
                                                            value={selectedDeviceByUser[user.id] || ''}
                                                            onChange={(e) => setSelectedDeviceByUser({ ...selectedDeviceByUser, [user.id]: e.target.value })}
                                                            className="bg-[#0a0f1d] border border-white/5 rounded text-[10px] px-2 py-1 outline-none text-slate-300 focus:border-blue-600/50"
                                                        >
                                                            <option value="">ASSET_ID...</option>
                                                            {devices.filter((d) => !d.assigned_to || d.assigned_to === user.name).map((d) => (
                                                                <option key={d.id} value={d.id}>{d.serial}</option>
                                                            ))}
                                                        </select>
                                                        <button onClick={() => handleAssignDevice(user.id)} className="text-[9px] font-black text-blue-400 uppercase hover:text-blue-300">LINK</button>
                                                    </div>
                                                )}
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
    );
};

const Loader2 = ({ className }: { className?: string }) => (
    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className={className}>
        <Users />
    </motion.div>
);
