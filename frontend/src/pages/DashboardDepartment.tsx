import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Package, 
    Plus, 
    Edit2, 
    Trash2, 
    CheckCircle, 
    AlertCircle, 
    Loader2,
    ShieldCheck,
    Search,
    TrendingUp,
    Monitor,
    Database,
    Cpu,
    Zap
} from 'lucide-react';
import { equipmentService, Equipment } from '../services/equipmentService';
import { authService } from '../services/authService';

export const DashboardDepartment = () => {
    const [equipments, setEquipments] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [stats, setStats] = useState({ total: 0, available: 0, assigned: 0, maintenance: 0 });
    const [searchTerm, setSearchTerm] = useState('');

    const user = authService.getCurrentUser();
    const userDepartmentName = user?.department;
    const userDepartmentId = user?.department_id;

    useEffect(() => {
        fetchEquipments();
    }, []);

    const fetchEquipments = async () => {
        try {
            setLoading(true);
            const data = await equipmentService.getAll();
            
            // Filter by department name or ID
            const filtered = data.filter(e => {
                const equipDepName = typeof e.department === 'string' ? e.department : (e.department as any)?.name;
                const equipDepId = e.departmentId || (e.department as any)?.id;
                
                return (userDepartmentName && equipDepName === userDepartmentName) || 
                       (userDepartmentId && equipDepId === userDepartmentId);
            });
            setEquipments(filtered);
            
            setStats({
                total: filtered.length,
                available: filtered.filter(e => e.status === 'AVAILABLE').length,
                assigned: filtered.filter(e => e.status === 'ASSIGNED').length,
                maintenance: filtered.filter(e => e.status === 'MAINTENANCE').length,
            });
        } catch (error) {
            console.error('Error fetching equipments:', error);
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        { label: 'Total Assets', value: stats.total, icon: Database, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'Opérationnels', value: stats.available, icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'En Usage', value: stats.assigned, icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        { label: 'Maintenance', value: stats.maintenance, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
    ];

    const filteredEquipments = equipments.filter(e => 
        e.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.type?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight uppercase flex items-center gap-3">
                        <Cpu className="w-8 h-8 text-blue-500" />
                        Inventaire : {userDepartmentName || 'Non assigné'}
                    </h2>
                    <p className="text-slate-400 mt-1 uppercase text-[10px] tracking-[0.2em] font-black italic">
                        BIENVENUE, <span className="text-blue-500">{user?.name || "OPERATOR"}</span> // Sentinel Asset Management
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-blue-400" />
                        <input
                            type="text"
                            placeholder="RECHERCHER ASSET..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-[#0a0f1d] border border-white/5 rounded text-[10px] font-mono tracking-widest text-slate-300 focus:outline-none focus:border-blue-600/50 w-64 transition-all"
                        />
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20 text-[10px] font-black uppercase tracking-widest"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Nouvel Asset
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, i) => (
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

            {/* Equipment Register */}
            <div className="pro-card overflow-hidden">
                <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Monitor className="w-3.5 h-3.5 text-blue-400" />
                        Registre des Assets du Département
                    </h3>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                        {filteredEquipments.length} UNITÉS_EN_STOCKE
                    </div>
                </div>

                {loading ? (
                    <div className="p-20 text-center">
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">INTERROGATION_BASE_DONNÉES...</p>
                    </div>
                ) : filteredEquipments.length === 0 ? (
                    <div className="p-20 text-center border-t border-white/5">
                        <Package className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">AUCUN ASSET RÉPERTORIÉ DANS CE SERVICE</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-[#0d1224] border-b border-white/5">
                                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Cofiguration_Asset</th>
                                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Catégorie</th>
                                    <th className="px-6 py-4 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest">Status_Actif</th>
                                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Assignataire</th>
                                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Localité</th>
                                    <th className="px-6 py-4 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest">Options</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredEquipments.map((equip, i) => (
                                    <tr key={equip.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-white tracking-tight uppercase">SN_{equip.serialNumber}</span>
                                                <span className="text-[8px] font-mono text-slate-500 uppercase">REF_{equip.id.substring(0,8)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-0.5 bg-[#161b2e] border border-white/5 rounded text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                {equip.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`status-badge ${
                                                equip.status === 'AVAILABLE' ? 'status-secure' : 
                                                equip.status === 'ASSIGNED' ? 'status-info' : 'status-danger'
                                            }`}>
                                                {equip.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500/20"></div>
                                                <span className="text-[10px] font-bold text-slate-300 uppercase italic whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">
                                                    {equip.assignedTo || 'NON_LOGUÉ'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{equip.location || '--'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button title="Éditer" className="p-1.5 text-blue-400 hover:bg-blue-600/10 rounded border border-transparent hover:border-blue-600/20"><Edit2 className="w-3.5 h-3.5" /></button>
                                                <button title="Supprimer" className="p-1.5 text-red-500 hover:bg-red-500/10 rounded border border-transparent hover:border-red-500/20"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal de création - Dark Sentinel Style */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 bg-[#060b18]/80 backdrop-blur-md flex items-center justify-center px-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-md pro-card border-blue-600/20 overflow-hidden"
                        >
                            <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Enregistrement Matériel</h3>
                                <p className="text-[9px] text-slate-500 uppercase mt-1 italic">Nouveau module détecté dans le service {userDepartmentName || 'Non assigné'}</p>
                            </div>
                            <div className="p-8 text-center space-y-6">
                                <div className="p-10 border border-dashed border-white/10 rounded-xl bg-[#0a0f1d]">
                                    <Monitor className="w-10 h-10 text-slate-800 mx-auto mb-4" />
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-relaxed">
                                        Interface de saisie en attente d'initialisation des champs dynamiques.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="w-full py-3 bg-blue-600 text-white font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 shadow-lg shadow-blue-900/40"
                                >
                                    ANNULER L'OPÉRATION
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DashboardDepartment;
