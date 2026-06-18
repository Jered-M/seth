import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertCircle, Clock, CheckCircle, UserPlus, X, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { authService } from '../services/authService';

interface Alert {
    id: string;
    type: string;
    typeLabel?: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    message: string;
    department?: string;
    reporterName?: string;
    timestamp?: string;
    createdAt?: string;
    status: 'ACTIVE' | 'RESOLVED';
    assignedTechnicianId?: string | null;
    assignedTechnicianName?: string | null;
    assignedAt?: string | null;
}

interface Technician {
    id: string;
    name: string;
    email: string;
}

function formatAlertDate(alert: Alert): string {
    const raw = alert.timestamp || alert.createdAt;
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('fr-FR');
}

export const SecurityAlerts = () => {
    const currentUser = authService.getCurrentUser();
    const normalizedRole =
        currentUser?.role === 'ADMIN_GENERAL'
            ? 'SUPER_ADMIN'
            : currentUser?.role === 'ADMIN_DEPT'
              ? 'DEPT_ADMIN'
              : currentUser?.role;

    const canAssignTechnician = normalizedRole === 'DEPT_ADMIN';

    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ACTIVE');
    const [assignAlertId, setAssignAlertId] = useState<string | null>(null);
    const [technicians, setTechnicians] = useState<Technician[]>([]);
    const [selectedTechId, setSelectedTechId] = useState('');
    const [assignLoading, setAssignLoading] = useState(false);
    const [assignError, setAssignError] = useState<string | null>(null);

    const fetchAlerts = async () => {
        try {
            setLoading(true);
            const response = await api.get('/security/alerts');
            const data = Array.isArray(response.data) ? response.data : [];
            setAlerts(data);
        } catch (error) {
            console.error('Erreur lors du chargement des alertes:', error);
            setAlerts([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, []);

    const openAssignModal = async (alertId: string) => {
        setAssignAlertId(alertId);
        setSelectedTechId('');
        setAssignError(null);
        try {
            const res = await api.get('/security/alerts/technicians');
            const list = Array.isArray(res.data) ? res.data : [];
            setTechnicians(list);
            if (list[0]?.id) setSelectedTechId(list[0].id);
        } catch {
            setTechnicians([]);
            setAssignError('Impossible de charger les techniciens du département');
        }
    };

    const handleAssignTechnician = async () => {
        if (!assignAlertId || !selectedTechId) return;
        setAssignLoading(true);
        setAssignError(null);
        try {
            const res = await api.post(`/security/alerts/${assignAlertId}/assign`, {
                technicianId: selectedTechId,
            });
            setAlerts((prev) => prev.map((a) => (a.id === assignAlertId ? res.data : a)));
            setAssignAlertId(null);
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { message?: string } } };
            setAssignError(ax.response?.data?.message || 'Assignation impossible');
        } finally {
            setAssignLoading(false);
        }
    };

    const handleResolveAlert = async (id: string) => {
        try {
            const res = await api.put(`/security/alerts/${id}/resolve`);
            setAlerts((prev) => prev.map((a) => (a.id === id ? res.data : a)));
        } catch (error) {
            console.error('Erreur:', error);
        }
    };

    const filteredAlerts = alerts.filter((a) =>
        filter === 'ALL' ? true : a.status === filter
    );

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'CRITICAL':
                return 'bg-red-500/10 border-red-500/20 text-red-400';
            case 'HIGH':
                return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
            case 'MEDIUM':
                return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
            default:
                return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
        }
    };

    const severityLabel: Record<string, string> = {
        CRITICAL: 'Critique',
        HIGH: 'Élevée',
        MEDIUM: 'Moyenne',
        LOW: 'Faible',
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Flux d'Alertes</h2>
                    <p className="text-slate-400 mt-1 uppercase text-[10px] tracking-[0.2em] font-black">
                        Surveillance des Incidents Sécurité
                    </p>
                </div>
                <div className="flex gap-2">
                    {(['ALL', 'ACTIVE', 'RESOLVED'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                                filter === status
                                    ? 'bg-blue-600 text-white'
                                    : 'border border-white/10 text-slate-400 hover:text-white'
                            }`}
                        >
                            {status === 'ALL' ? 'Toutes' : status === 'ACTIVE' ? 'Actives' : 'Résolues'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : filteredAlerts.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Aucune alerte à afficher</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredAlerts.map((alert, index) => (
                        <motion.div
                            key={alert.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`pro-card p-6 border-l-4 ${getSeverityColor(alert.severity)}`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <ShieldAlert className="w-5 h-5 shrink-0" />
                                        <h3 className="text-sm font-bold uppercase tracking-tight">
                                            {alert.typeLabel || alert.type}
                                        </h3>
                                        <span
                                            className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                                alert.severity === 'CRITICAL'
                                                    ? 'bg-red-500/20 text-red-400'
                                                    : alert.severity === 'HIGH'
                                                      ? 'bg-orange-500/20 text-orange-400'
                                                      : alert.severity === 'MEDIUM'
                                                        ? 'bg-yellow-500/20 text-yellow-400'
                                                        : 'bg-blue-500/20 text-blue-400'
                                            }`}
                                        >
                                            {severityLabel[alert.severity] || alert.severity}
                                        </span>
                                        {alert.status === 'RESOLVED' && (
                                            <span className="px-2 py-1 rounded text-xs font-bold uppercase bg-emerald-500/20 text-emerald-400">
                                                Résolue
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-white mb-2">{alert.message}</p>
                                    {alert.reporterName && (
                                        <p className="text-xs text-slate-500 mb-1">
                                            Signalé par : <span className="text-slate-400">{alert.reporterName}</span>
                                            {alert.department ? ` · ${alert.department}` : ''}
                                        </p>
                                    )}
                                    {alert.assignedTechnicianName && (
                                        <p className="text-xs text-blue-400 mb-1">
                                            Technicien assigné : {alert.assignedTechnicianName}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-3">
                                        <Clock className="w-3 h-3" />
                                        {formatAlertDate(alert)}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 shrink-0">
                                    {canAssignTechnician && alert.status === 'ACTIVE' && !alert.assignedTechnicianId && (
                                        <button
                                            onClick={() => openAssignModal(alert.id)}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 rounded text-[10px] font-black uppercase text-blue-300 border border-blue-500/30"
                                            title="Assigner à un technicien"
                                        >
                                            <UserPlus className="w-4 h-4" />
                                            Assigner technicien
                                        </button>
                                    )}
                                    {alert.status === 'ACTIVE' && (
                                        <button
                                            onClick={() => handleResolveAlert(alert.id)}
                                            className="p-2 hover:bg-emerald-500/10 rounded transition-colors text-emerald-400"
                                            title="Marquer comme résolue"
                                        >
                                            <CheckCircle className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {assignAlertId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="pro-card w-full max-w-md p-6 border border-white/10 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black uppercase text-white">Assigner à un technicien</h3>
                            <button onClick={() => setAssignAlertId(null)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {technicians.length === 0 ? (
                            <p className="text-sm text-amber-400">
                                Aucun technicien (superviseur) dans votre département. Créez un compte SUPERVISOR via la gestion utilisateurs.
                            </p>
                        ) : (
                            <select
                                className="w-full bg-[#0a0f1d] border border-white/10 rounded-lg px-4 py-3 text-sm text-white"
                                value={selectedTechId}
                                onChange={(e) => setSelectedTechId(e.target.value)}
                            >
                                {technicians.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name} ({t.email})
                                    </option>
                                ))}
                            </select>
                        )}
                        {assignError && <p className="text-xs text-red-400">{assignError}</p>}
                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => setAssignAlertId(null)}
                                className="px-4 py-2 text-xs font-bold uppercase text-slate-400"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                disabled={assignLoading || !selectedTechId}
                                onClick={handleAssignTechnician}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 rounded text-xs font-black uppercase text-white disabled:opacity-50"
                            >
                                {assignLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                Confirmer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
