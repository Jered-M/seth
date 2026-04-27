import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertCircle, Clock, Trash2, CheckCircle, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../services/api';

interface Alert {
    id: string;
    type: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    message: string;
    location?: string;
    timestamp: string;
    status: 'ACTIVE' | 'RESOLVED';
    details?: string;
}

export const SecurityAlerts = () => {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ACTIVE');

    useEffect(() => {
        const fetchAlerts = async () => {
            try {
                setLoading(true);
                const response = await api.get('/security/alerts');
                setAlerts(Array.isArray(response.data) ? response.data : []);
            } catch (error) {
                console.error('Erreur lors du chargement des alertes:', error);
                // Mock data for demo
                setAlerts([
                    {
                        id: '1',
                        type: 'INTRUSION_ATTEMPT',
                        severity: 'CRITICAL',
                        message: 'Tentative d\'intrusion détectée',
                        location: 'Zone B-12',
                        timestamp: new Date().toISOString(),
                        status: 'ACTIVE',
                        details: 'Accès non autorisé détecté'
                    }
                ]);
            } finally {
                setLoading(false);
            }
        };
        fetchAlerts();
    }, []);

    const handleResolveAlert = async (id: string) => {
        try {
            await api.put(`/security/alerts/${id}/resolve`);
            setAlerts(alerts.map(a => a.id === id ? { ...a, status: 'RESOLVED' } : a));
        } catch (error) {
            console.error('Erreur:', error);
        }
    };

    const handleDeleteAlert = async (id: string) => {
        try {
            await api.delete(`/security/alerts/${id}`);
            setAlerts(alerts.filter(a => a.id !== id));
        } catch (error) {
            console.error('Erreur:', error);
        }
    };

    const filteredAlerts = alerts.filter(a => 
        filter === 'ALL' ? true : a.status === filter
    );

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return 'bg-red-500/10 border-red-500/20 text-red-400';
            case 'HIGH': return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
            case 'MEDIUM': return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
            default: return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Flux d'Alertes</h2>
                    <p className="text-slate-400 mt-1 uppercase text-[10px] tracking-[0.2em] font-black">Surveillance des Incidents Sécurité</p>
                </div>
                <div className="flex gap-2">
                    {['ALL', 'ACTIVE', 'RESOLVED'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilter(status as any)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                                filter === status
                                    ? 'bg-blue-600 text-white'
                                    : 'border border-white/10 text-slate-400 hover:text-white'
                            }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Alerts List */}
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
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <ShieldAlert className="w-5 h-5" />
                                        <h3 className="text-sm font-bold uppercase tracking-tight">{alert.type}</h3>
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                            alert.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                                            alert.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                                            alert.severity === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-blue-500/20 text-blue-400'
                                        }`}>
                                            {alert.severity}
                                        </span>
                                    </div>
                                    <p className="text-white mb-2">{alert.message}</p>
                                    {alert.location && (
                                        <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                                            <MapPin className="w-3 h-3" />
                                            {alert.location}
                                        </div>
                                    )}
                                    {alert.details && (
                                        <p className="text-xs text-slate-500">{alert.details}</p>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-3">
                                        <Clock className="w-3 h-3" />
                                        {new Date(alert.timestamp).toLocaleString('fr-FR')}
                                    </div>
                                </div>
                                <div className="flex gap-2 ml-4">
                                    {alert.status === 'ACTIVE' && (
                                        <button
                                            onClick={() => handleResolveAlert(alert.id)}
                                            className="p-2 hover:bg-emerald-500/10 rounded transition-colors text-emerald-400"
                                            title="Résoudre"
                                        >
                                            <CheckCircle className="w-5 h-5" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDeleteAlert(alert.id)}
                                        className="p-2 hover:bg-red-500/10 rounded transition-colors text-red-400"
                                        title="Supprimer"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};
