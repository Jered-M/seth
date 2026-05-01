import React, { useState, useEffect } from 'react';
import { Activity, Search, Download, Filter, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../services/api';

interface Log {
    id: string;
    userId?: string;
    action: string;
    details?: string;
    ipAddress?: string;
    timestamp: string;
    status?: string;
    user?: string;
}

export const SecurityLogs = () => {
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAction, setFilterAction] = useState('ALL');

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                setLoading(true);
                const response = await api.get('/security/logs');
                setLogs(Array.isArray(response.data) ? response.data : []);
            } catch (error) {
                console.error('Erreur lors du chargement des logs:', error);
                // Mock data
                setLogs([
                    {
                        id: '1',
                        userId: 'user1',
                        action: 'LOGIN',
                        details: 'Connexion réussie',
                        ipAddress: '192.168.1.100',
                        timestamp: new Date().toISOString(),
                        status: 'SUCCESS',
                        user: 'John Doe'
                    },
                    {
                        id: '2',
                        userId: 'user2',
                        action: 'DEPARTMENT_CREATE',
                        details: 'Création du département Informatique',
                        ipAddress: '192.168.1.101',
                        timestamp: new Date(Date.now() - 3600000).toISOString(),
                        status: 'SUCCESS',
                        user: 'Admin'
                    }
                ]);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter(log => {
        const matchSearch = !searchTerm || 
            log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.user?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (log.details?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        
        const matchFilter = filterAction === 'ALL' || log.action === filterAction;
        
        return matchSearch && matchFilter;
    });

    const actions = ['ALL', ...new Set(logs.map(l => l.action))];

    const handleExport = () => {
        const csv = [
            ['Timestamp', 'Action', 'Utilisateur', 'IP', 'Détails', 'Statut'],
            ...filteredLogs.map(log => [
                new Date(log.timestamp).toLocaleString('fr-FR'),
                log.action,
                log.user || 'N/A',
                log.ipAddress || 'N/A',
                log.details || 'N/A',
                log.status || 'N/A'
            ])
        ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Journal d'Audit</h2>
                    <p className="text-slate-400 mt-1 uppercase text-[10px] tracking-[0.2em] font-black">Historique des Opérations Système</p>
                </div>
                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-xs font-bold uppercase tracking-widest"
                >
                    <Download className="w-4 h-4" />
                    Exporter
                </button>
            </div>

            {/* Filters */}
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
                        {actions.map(action => (
                            <option key={action} value={action}>{action}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Logs Table */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <div className="pro-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-white/[0.01] border-b border-white/5">
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Timestamp</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Action</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Utilisateur</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">IP Address</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Détails</th>
                                    <th className="px-6 py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Statut</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
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
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                                    log.status === 'SUCCESS' 
                                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                }`}>
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
