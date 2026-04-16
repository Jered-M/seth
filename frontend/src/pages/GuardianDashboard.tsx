import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion'
import { 
    LogIn, 
    LogOut, 
    Clock, 
    CheckCircle, 
    AlertCircle, 
    Loader2,
    Search,
    QrCode,
    User,
    Package,
    ShieldCheck,
    ArrowUpRight,
    ArrowDownLeft,
    Monitor,
    XCircle,
    CheckCircle2
} from 'lucide-react'

const API_BASE_URL = '/api';

interface ExitRequest {
    id: string;
    user: string;
    equipment: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
    created_at: string;
    approved_at?: string;
}

interface GuardianStats {
    pending_requests: number;
    approved_today: number;
    completed_today: number;
    rejected_today: number;
}

export const GuardianDashboard = () => {
    const [exitRequests, setExitRequests] = useState<ExitRequest[]>([]);
    const [stats, setStats] = useState<GuardianStats>({
        pending_requests: 0,
        approved_today: 0,
        completed_today: 0,
        rejected_today: 0
    });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchGuardianData();
        const interval = setInterval(fetchGuardianData, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchGuardianData = async () => {
        try {
            const token = localStorage.getItem('access_token');
            const headers: HeadersInit = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };

            const requestsRes = await fetch(`${API_BASE_URL}/exit-requests`, {
                method: 'GET',
                headers,
                credentials: 'include'
            });

            if (requestsRes.ok) {
                const requestsData = await requestsRes.json();
                setExitRequests(Array.isArray(requestsData) ? requestsData : []);
                
                const pending = (requestsData as ExitRequest[]).filter((r: ExitRequest) => r.status === 'PENDING').length;
                const approved = (requestsData as ExitRequest[]).filter((r: ExitRequest) => r.status === 'APPROVED').length;
                const completed = (requestsData as ExitRequest[]).filter((r: ExitRequest) => r.status === 'COMPLETED').length;
                const rejected = (requestsData as ExitRequest[]).filter((r: ExitRequest) => r.status === 'REJECTED').length;
                
                setStats({
                    pending_requests: pending,
                    approved_today: approved,
                    completed_today: completed,
                    rejected_today: rejected
                });
            }
        } catch (error) {
            console.error('Error fetching guardian data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (requestId: string, action: 'approve' | 'reject' | 'complete') => {
        try {
            const token = localStorage.getItem('access_token');
            const res = await fetch(`${API_BASE_URL}/exit-requests/${requestId}/${action}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });
            if (res.ok) fetchGuardianData();
        } catch (error) {
            console.error(`Error ${action} request:`, error);
        }
    };

    const filteredRequests = exitRequests.filter(req =>
        req.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.equipment.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'PENDING': return 'status-warning';
            case 'APPROVED': return 'status-info';
            case 'COMPLETED': return 'status-secure';
            case 'REJECTED': return 'status-danger';
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
                        <Monitor className="w-8 h-8 text-blue-500" />
                        Poste de Contrôle_S1
                    </h2>
                    <p className="text-slate-400 mt-1 uppercase text-[10px] tracking-[0.2em] font-black italic">
                        Sentinel Entry/Exit Logic // Autorisation Field Operative
                    </p>
                </div>
                <button
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20 text-[10px] font-black uppercase tracking-widest"
                >
                    <QrCode className="w-4 h-4" />
                    Scanner Identifiant
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Attente Validation', value: stats.pending_requests, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { label: 'Sorties Autorisées', value: stats.approved_today, icon: ArrowUpRight, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { label: 'Flux Terminés', value: stats.completed_today, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: 'Accès Refusés', value: stats.rejected_today, icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
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

            {/* Requests Registre */}
            <div className="pro-card overflow-hidden">
                <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                        Journal des Flux d'Équipements
                    </h3>
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                        <input
                            type="text"
                            placeholder="FILTRER LE FLUX..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 pr-4 py-1.5 bg-[#0a0f1d] border border-white/5 rounded text-[9px] font-mono tracking-widest text-slate-300 focus:outline-none focus:border-blue-600/50 w-64 transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-[#0d1224] border-b border-white/5">
                                <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Opérateur</th>
                                <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Matériel_ID</th>
                                <th className="px-6 py-4 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest">Statut</th>
                                <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Horodatage</th>
                                <th className="px-6 py-4 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest">Commandes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredRequests.map((request, i) => (
                                <tr key={request.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-[#161b2e] border border-white/5 rounded flex items-center justify-center text-blue-400 text-[10px] font-black">
                                                {request.user.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-xs font-bold text-white tracking-tight uppercase">{request.user}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Package className="w-3.5 h-3.5 text-slate-600" />
                                            <span className="text-[10px] font-mono text-slate-400 uppercase">{request.equipment}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`status-badge ${getStatusStyles(request.status)}`}>
                                            {request.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                            <Clock className="w-3 h-3" />
                                            {new Date(request.created_at).toLocaleTimeString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            {request.status === 'PENDING' && (
                                                <>
                                                    <button
                                                        onClick={() => handleAction(request.id, 'approve')}
                                                        className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
                                                    >
                                                        AUTORISER
                                                    </button>
                                                    <button
                                                        onClick={() => handleAction(request.id, 'reject')}
                                                        className="px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded text-[9px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all"
                                                    >
                                                        REFUSER
                                                    </button>
                                                </>
                                            )}
                                            {request.status === 'APPROVED' && (
                                                <button
                                                    onClick={() => handleAction(request.id, 'complete')}
                                                    className="px-3 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded text-[9px] font-black uppercase tracking-widest hover:bg-blue-500/20 transition-all"
                                                >
                                                    MARQUER_TERMINÉ
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredRequests.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center">
                                        <Clock className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">AUCUN FLUX DÉTECTÉ</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
