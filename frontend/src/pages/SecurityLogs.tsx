import React, { useState, useEffect, useMemo } from 'react';
import { Search, Download, Filter, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { authService } from '../services/authService';

interface Log {
    id: string;
    userId?: string;
    action: string;
    details?: string;
    ipAddress?: string;
    timestamp: string;
    status?: string;
    user?: string;
    department?: string;
}

interface LogsResponse {
    scope?: 'global' | 'department';
    department?: string | null;
    logs?: Log[];
}

function normalizeRole(role?: string): string {
    if (role === 'ADMIN_GENERAL') return 'SUPER_ADMIN';
    if (role === 'ADMIN_DEPT') return 'DEPT_ADMIN';
    return role || '';
}

export const SecurityLogs = () => {
    const [logs, setLogs] = useState<Log[]>([]);
    const [scope, setScope] = useState<'global' | 'department'>('global');
    const [departmentScope, setDepartmentScope] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAction, setFilterAction] = useState('ALL');

    const isSuperAdmin = useMemo(() => {
        const role = normalizeRole(authService.getCurrentUser()?.role);
        return role === 'SUPER_ADMIN';
    }, []);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await api.get<LogsResponse | Log[]>('/security/logs');

                const data = response.data;
                if (Array.isArray(data)) {
                    setLogs(data);
                    setScope('global');
                    setDepartmentScope(null);
                } else {
                    setLogs(Array.isArray(data.logs) ? data.logs : []);
                    setScope(data.scope === 'department' ? 'department' : 'global');
                    setDepartmentScope(data.department ?? null);
                }
            } catch (err: unknown) {
                console.error('Erreur lors du chargement des logs:', err);
                const ax = err as { response?: { data?: { message?: string } } };
                setError(ax.response?.data?.message || 'Impossible de charger le journal d\'audit.');
                setLogs([]);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter((log) => {
        const matchSearch =
            !searchTerm ||
            log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.user?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (log.details?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (log.department?.toLowerCase() || '').includes(searchTerm.toLowerCase());

        const matchFilter = filterAction === 'ALL' || log.action === filterAction;

        return matchSearch && matchFilter;
    });

    const actions = ['ALL', ...new Set(logs.map((l) => l.action))];

    const handleExport = () => {
        const headers = isSuperAdmin
            ? ['Timestamp', 'Action', 'Utilisateur', 'Département', 'IP', 'Détails', 'Statut']
            : ['Timestamp', 'Action', 'Utilisateur', 'IP', 'Détails', 'Statut'];

        const csv = [
            headers,
            ...filteredLogs.map((log) => {
                const row = [
                    new Date(log.timestamp).toLocaleString('fr-FR'),
                    log.action,
                    log.user || 'N/A',
                ];
                if (isSuperAdmin) row.push(log.department || 'Global');
                row.push(
                    log.ipAddress || 'N/A',
                    log.details || 'N/A',
                    log.status || 'N/A'
                );
                return row;
            }),
        ]
            .map((row) => row.map((cell) => `"${cell}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_${scope === 'department' && departmentScope ? departmentScope : 'global'}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const scopeLabel =
        scope === 'department' && departmentScope
            ? `Vue département — ${departmentScope}`
            : 'Vue globale — tous les départements';

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Journal d'Audit</h2>
                    <p className="text-slate-400 mt-1 uppercase text-[10px] tracking-[0.2em] font-black">
                        Historique des Opérations Système
                    </p>
                </div>
                <button
                    onClick={handleExport}
                    disabled={loading || filteredLogs.length === 0}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-xs font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <Download className="w-4 h-4" />
                    Exporter
                </button>
            </div>

            <div
                className={`pro-card p-4 flex items-center gap-3 border ${
                    scope === 'global' ? 'border-blue-500/20 bg-blue-500/5' : 'border-amber-500/20 bg-amber-500/5'
                }`}
            >
                <Shield className={`w-5 h-5 ${scope === 'global' ? 'text-blue-400' : 'text-amber-400'}`} />
                <div>
                    <p className="text-xs font-black uppercase tracking-widest text-white">{scopeLabel}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                        {scope === 'global'
                            ? 'En tant que super administrateur, vous consultez l\'audit complet de l\'application.'
                            : 'En tant qu\'administrateur de département, seules les opérations de votre département sont visibles.'}
                    </p>
                </div>
            </div>

            {error ? (
                <div className="pro-card p-4 border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
                    {error}
                </div>
            ) : null}

            <div className="pro-card p-4 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Rechercher..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none text-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <select
                        value={filterAction}
                        onChange={(e) => setFilterAction(e.target.value)}
                        className="bg-[#0a0f1d] text-white text-sm rounded px-3 py-1.5 border border-white/10 focus:outline-none focus:border-blue-600"
                    >
                        {actions.map((action) => (
                            <option key={action} value={action}>
                                {action}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                </div>
            ) : (
                <div className="pro-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-white/[0.01] border-b border-white/5">
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        Timestamp
                                    </th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        Action
                                    </th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        Utilisateur
                                    </th>
                                    {isSuperAdmin ? (
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            Département
                                        </th>
                                    ) : null}
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        IP Address
                                    </th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        Détails
                                    </th>
                                    <th className="px-6 py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        Statut
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={isSuperAdmin ? 7 : 6} className="px-6 py-8 text-center text-slate-500">
                                            Aucun log trouvé
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map((log, index) => (
                                        <motion.tr
                                            key={log.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: index * 0.02 }}
                                            className="hover:bg-white/[0.02] transition-colors"
                                        >
                                            <td className="px-6 py-4 text-xs font-mono text-slate-400">
                                                {new Date(log.timestamp).toLocaleString('fr-FR')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded border border-blue-500/20">
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-white font-medium">
                                                {log.user || 'System'}
                                            </td>
                                            {isSuperAdmin ? (
                                                <td className="px-6 py-4 text-xs text-slate-400">
                                                    {log.department || 'Global'}
                                                </td>
                                            ) : null}
                                            <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                                {log.ipAddress || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-400 max-w-xs truncate">
                                                {(() => {
                                                    try {
                                                        const d = JSON.parse(log.details || '{}');
                                                        return d.message || log.details || 'N/A';
                                                    } catch {
                                                        return log.details || 'N/A';
                                                    }
                                                })()}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span
                                                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                                        log.status === 'SUCCESS'
                                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                            : log.status === 'PENDING_APPROVAL'
                                                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                    }`}
                                                >
                                                    {log.status || 'OK'}
                                                </span>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
