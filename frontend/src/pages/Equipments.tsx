import React, { useState, useEffect, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { 
    Plus, 
    Filter, 
    MoreVertical, 
    Smartphone, 
    Monitor as MonitorIcon, 
    Laptop, 
    Box, 
    Loader2, 
    X, 
    UserPlus,
    Search,
    ShieldCheck,
    AlertCircle,
    ClipboardList,
    Wrench
} from 'lucide-react'
import { useEquipments } from '../hooks/useEquipments'
import { equipmentService } from '../services/equipmentService'
import { authService } from '../services/authService'

type UserOption = {
    id: string;
    name: string;
    email: string;
    department_id?: string | null;
    department?: string | null;
};

export const Equipments = () => {
    const { equipments, loading, error, fetchEquipments } = useEquipments()
    const currentUser = authService.getCurrentUser()
    const [showAddModal, setShowAddModal] = useState(false)
    const [showAssignModal, setShowAssignModal] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)
    const [assigningEquipment, setAssigningEquipment] = useState<string | null>(null)
    const [users, setUsers] = useState<UserOption[]>([])
    const [selectedUserId, setSelectedUserId] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [newEquipment, setNewEquipment] = useState({
        type: 'LAPTOP',
        departmentId: currentUser?.department_id || '',
        location: ''
    })

    const getIcon = (type: string) => {
        switch (type) {
            case 'LAPTOP': return <Laptop className="w-4 h-4" />
            case 'PHONE': return <Smartphone className="w-4 h-4" />
            case 'MONITOR': return <MonitorIcon className="w-4 h-4" />
            default: return <Box className="w-4 h-4" />
        }
    }

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'AVAILABLE': return 'status-secure'
            case 'ASSIGNED': return 'status-info'
            case 'OUT': return 'status-warning'
            case 'MAINTENANCE': return 'status-danger'
            default: return 'status-info'
        }
    }

    const normalizedRole = currentUser?.role === 'ADMIN_GENERAL'
        ? 'SUPER_ADMIN'
        : currentUser?.role === 'ADMIN_DEPT'
            ? 'DEPT_ADMIN'
            : currentUser?.role === 'SECURITY_AGENT'
                ? 'GARDIEN'
                : currentUser?.role

    const canAssignEquipment = ['SUPER_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR'].includes(normalizedRole || '')

    const handleAssignEquipment = async () => {
        if (!assigningEquipment || !selectedUserId) {
            setFormError('Sélectionnez un utilisateur')
            return
        }

        setSubmitting(true)
        setFormError(null)

        try {
            await equipmentService.assign(assigningEquipment, { userId: selectedUserId })
            await fetchEquipments()
            setShowAssignModal(false)
            setAssigningEquipment(null)
            setSelectedUserId('')
        } catch (err: any) {
            setFormError(err?.response?.data?.message || err?.message || "Erreur lors de l'assignation")
        } finally {
            setSubmitting(false)
        }
    }

    const handleCreateEquipment = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setSubmitting(true)
        setFormError(null)

        try {
            const payload = {
                type: newEquipment.type,
                departmentId: newEquipment.departmentId.trim() || undefined,
                location: newEquipment.location.trim() || undefined
            }

            await equipmentService.create(payload)
            await fetchEquipments()
            setShowAddModal(false)
            setNewEquipment({
                type: 'LAPTOP',
                departmentId: currentUser?.department_id || '',
                location: ''
            })
        } catch (err: any) {
            setFormError(err?.response?.data?.message || err?.message || "Erreur lors de l'ajout de l'équipement")
        } finally {
            setSubmitting(false)
        }
    }

    const statsCards = [
        { label: 'Total Équipements', value: equipments.length, icon: ClipboardList, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'Disponibles', value: equipments.filter(e => e.status === 'AVAILABLE').length, icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'Assignés', value: equipments.filter(e => e.status === 'ASSIGNED').length, icon: UserPlus, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        { label: 'Maintenance', value: equipments.filter(e => e.status === 'MAINTENANCE').length, icon: Wrench, color: 'text-red-400', bg: 'bg-red-500/10' },
    ]

    const filteredEquipments = equipments.filter(e => 
        e.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.assignedTo?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Inventaire Matériel</h2>
                    <p className="text-slate-400 mt-1 uppercase text-[10px] tracking-[0.2em] font-black italic">Sentinel Asset Tracking // Terminal_0x9A</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-blue-400" />
                        <input
                            type="text"
                            placeholder="FILTRER L'INVENTAIRE..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-[#0a0f1d] border border-white/5 rounded text-[10px] font-mono tracking-widest text-slate-300 focus:outline-none focus:border-blue-600/50 w-64 transition-all"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20 text-[10px] font-black uppercase tracking-widest"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Nouveau Matériel
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statsCards.map((stat, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="pro-card p-6 border-white/5 flex items-center justify-between"
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

            {/* Main Table Section */}
            <div className="pro-card overflow-hidden shadow-2xl relative">
                <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <MonitorIcon className="w-3.5 h-3.5 text-blue-400" />
                        Registre des Actifs
                    </h3>
                    <div className="text-[9px] font-bold text-slate-500 uppercase">
                        {filteredEquipments.length} UNITÉS_DÉTECTÉES
                    </div>
                </div>

                <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-[#0d1224] border-b border-white/5">
                                <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Matériel</th>
                                <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Type</th>
                                <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Localisation</th>
                                <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Opérateur</th>
                                <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Statut</th>
                                <th className="px-6 py-4 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredEquipments.map((item, i) => (
                                <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-[#161b2e] border border-white/5 rounded flex items-center justify-center text-blue-400">
                                                {getIcon(item.type)}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-white tracking-tight">{item.serialNumber}</p>
                                                <p className="text-[8px] font-mono text-slate-500 uppercase">SN_{item.serialNumber.substring(0, 8)}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{item.type}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500/20"></div>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase italic">{item.location || 'NON SPÉCIFIÉ'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {item.assignedTo ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 bg-blue-600/10 rounded flex items-center justify-center text-[8px] font-black text-blue-400 border border-blue-500/20">
                                                    {item.assignedTo.charAt(0)}
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">{item.assignedTo}</span>
                                            </div>
                                        ) : (
                                            <span className="text-[9px] text-slate-700 font-bold uppercase tracking-tighter">NON_ASSIGNÉ</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`status-badge ${getStatusStyles(item.status)}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 justify-end">
                                            {canAssignEquipment && (
                                                <button
                                                    onClick={() => {
                                                        setAssigningEquipment(item.id)
                                                        setShowAssignModal(true)
                                                        equipmentService.getAssignableUsers(item.id).then(setUsers)
                                                    }}
                                                    className="p-1.5 text-blue-400 hover:bg-blue-600/10 rounded transition-all border border-transparent hover:border-blue-600/20"
                                                    title="Assigner"
                                                >
                                                    <UserPlus className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button className="p-1.5 text-slate-600 hover:text-white hover:bg-white/5 rounded transition-all">
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View: Cards */}
                <div className="lg:hidden divide-y divide-white/5">
                    {filteredEquipments.map((item) => (
                        <div key={item.id} className="p-6 bg-white/[0.01] space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-[#161b2e] border border-white/5 rounded flex items-center justify-center text-blue-400">
                                        {getIcon(item.type)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white tracking-tight">{item.serialNumber}</p>
                                        <p className="text-[10px] font-mono text-slate-500 uppercase">{item.type}</p>
                                    </div>
                                </div>
                                <span className={`status-badge ${getStatusStyles(item.status)}`}>
                                    {item.status}
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Localisation</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase italic">{item.location || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Opérateur</p>
                                    <p className="text-[10px] font-bold text-slate-300 uppercase">{item.assignedTo || 'Non assigné'}</p>
                                </div>
                            </div>

                            <div className="pt-2 flex gap-2">
                                {canAssignEquipment && (
                                    <button
                                        onClick={() => {
                                            setAssigningEquipment(item.id)
                                            setShowAssignModal(true)
                                            equipmentService.getAssignableUsers(item.id).then(setUsers)
                                        }}
                                        className="flex-1 py-2 bg-blue-600 shadow-lg shadow-blue-900/20 text-white rounded text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                                    >
                                        <UserPlus className="w-3.5 h-3.5" />
                                        Assigner
                                    </button>
                                )}
                                <button className="flex-1 py-2 bg-white/5 text-slate-400 rounded text-[10px] font-black uppercase tracking-widest border border-white/5">
                                    Détails
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                
                {filteredEquipments.length === 0 && !loading && (
                    <div className="p-20 text-center">
                        <Box className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">AUCUN ÉQUIPEMENT RÉPERTORIÉ</p>
                        <p className="text-[9px] text-slate-700 mt-2 uppercase">Initialisation de la base de données requise.</p>
                    </div>
                )}
            </div>

            {loading && (
                <div className="fixed inset-0 bg-[#060b18]/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="text-center">
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">SYNCHRONISATION_INVENTAIRE...</p>
                    </div>
                </div>
            )}

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 bg-[#060b18]/80 backdrop-blur-md flex items-center justify-center px-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-lg pro-card border-blue-600/20 overflow-hidden"
                    >
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">NOUVEL ASSET</h3>
                                <p className="text-[9px] text-slate-500 uppercase mt-1">Enregistrement manuel dans la base SENTINEL</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>

                        <form onSubmit={handleCreateEquipment} className="p-6 space-y-5">
                            {formError && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-[10px] font-bold uppercase tracking-tight">
                                    {formError}
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Type d'Asset</label>
                                <select
                                    value={newEquipment.type}
                                    onChange={(e) => setNewEquipment({ ...newEquipment, type: e.target.value })}
                                    className="w-full bg-[#060b18] border border-white/10 rounded-lg px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-600"
                                >
                                    <option value="LAPTOP">Ordinateur Portable</option>
                                    <option value="PHONE">Terminal Mobile</option>
                                    <option value="MONITOR">Système d'Affichage</option>
                                    <option value="OTHER">Autre Matériel</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Localisation Initiale</label>
                                <input
                                    type="text"
                                    value={newEquipment.location}
                                    onChange={(e) => setNewEquipment({ ...newEquipment, location: e.target.value })}
                                    className="w-full bg-[#060b18] border border-white/10 rounded-lg px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-600 placeholder:text-slate-800"
                                    placeholder="ZONE / BÂTIMENT / BUREAU"
                                />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 py-3 bg-white/5 text-slate-500 font-bold uppercase tracking-widest text-[10px] hover:bg-white/10"
                                >
                                    ANNULER
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-3 bg-blue-600 text-white font-bold uppercase tracking-widest text-[10px] hover:bg-blue-700 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40"
                                >
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ENREGISTRER'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}

            {/* Assign Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 z-50 bg-[#060b18]/80 backdrop-blur-md flex items-center justify-center px-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-lg pro-card border-amber-600/20 overflow-hidden"
                    >
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">ASSIGNATION OPÉRATEUR</h3>
                                <p className="text-[9px] text-slate-500 uppercase mt-1">Liaison d'un asset à un identifiant utilisateur</p>
                            </div>
                            <button onClick={() => setShowAssignModal(false)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="p-6 space-y-5">
                            {formError && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-[10px] font-bold uppercase tracking-tight">
                                    {formError}
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Sélectionner l'Opérateur</label>
                                <select
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                    className="w-full bg-[#060b18] border border-white/10 rounded-lg px-4 py-3 text-xs text-white focus:outline-none focus:border-amber-600/50"
                                >
                                    <option value="">SCANNER LES UTILISATEURS...</option>
                                    {users.map((user) => (
                                        <option key={user.id} value={user.id}>
                                            {user.name.toUpperCase()} // {user.email}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAssignModal(false)}
                                    className="flex-1 py-3 bg-white/5 text-slate-500 font-bold uppercase tracking-widest text-[10px] hover:bg-white/10"
                                >
                                    ANNULER
                                </button>
                                <button
                                    onClick={handleAssignEquipment}
                                    disabled={submitting || !selectedUserId}
                                    className="flex-1 py-3 bg-amber-600 text-white font-bold uppercase tracking-widest text-[10px] hover:bg-amber-700 flex items-center justify-center gap-2 shadow-lg shadow-amber-900/40 disabled:opacity-50"
                                >
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'CONFIRMER L\'ASSIGNATION'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    )
}
