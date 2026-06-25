import { useEffect, useState } from 'react';
import { Users, Building2, ShieldAlert, Eye } from 'lucide-react';
import { AdminDashboard } from '../AdminDashboard';
import { LivePresenceMap } from '../../features/admin/LivePresenceMap';
import { AuditModeBanner } from '../../features/admin/AuditModeBanner';
import { RequestApprovalActions } from '../../features/requests/RequestApprovalActions';
import { StatCard } from '../../features/shared/StatCard';
import { PassageHistoryPanel } from '../../features/tracking/PassageHistoryPanel';
import { InternalRequest, requestService } from '../../services/requestService';
import { departmentService } from '../../services/departmentService';

export const SuperAdminDashboardPage = () => {
    const [pendingGlobal, setPendingGlobal] = useState<InternalRequest[]>([]);
    const [kpis, setKpis] = useState({ users: 0, departments: 0, alerts: 0 });
    const [auditUser, setAuditUser] = useState<{ name: string; email: string } | null>(null);
    const [tab, setTab] = useState<'overview' | 'map' | 'history' | 'audit'>('overview');

    const load = async () => {
        try {
            const [global, stats] = await Promise.all([
                requestService.pendingGlobal(),
                departmentService.getStats(),
            ]);
            setPendingGlobal(global);
            setKpis({
                users: stats.data.total_users,
                departments: stats.data.total_departments,
                alerts: stats.data.security_alerts,
            });
        } catch (err) {
            console.error('Erreur chargement dashboard super admin:', err);
            setPendingGlobal([]);
        }
    };

    useEffect(() => {
        load();
    }, []);

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto">
            <AuditModeBanner impersonating={auditUser} onStop={() => setAuditUser(null)} />

            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-widest text-white">Supervision globale</h1>
                    <p className="text-xs text-slate-400 mt-1">KPIs · Validation finale · Carte live · Mode audit</p>
                </div>
                <div className="flex gap-2">
                    {(['overview', 'map', 'history', 'audit'] as const).map((key) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            className={`px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest ${
                                tab === key ? 'bg-blue-600 text-white' : 'bg-[#0a0f1d] text-slate-400 border border-white/10'
                            }`}
                        >
                            {key === 'overview' ? 'Vue d\'ensemble' : key === 'map' ? 'Localisation' : key === 'history' ? 'Historique' : 'Audit'}
                        </button>
                    ))}
                </div>
            </header>

            {tab === 'overview' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <StatCard label="Utilisateurs" value={kpis.users} icon={Users} tone="emerald" />
                        <StatCard label="Départements" value={kpis.departments} icon={Building2} tone="blue" />
                        <StatCard label="Alertes actives" value={kpis.alerts} icon={ShieldAlert} tone="red" />
                    </div>
                    <section className="space-y-4">
                        <h2 className="text-sm font-black uppercase tracking-widest text-white">Validation finale</h2>
                        <RequestApprovalActions requests={pendingGlobal} level="global" onUpdated={load} />
                    </section>
                    <AdminDashboard />
                </>
            )}

            {tab === 'map' && <LivePresenceMap />}

            {tab === 'history' && (
                <section className="space-y-4">
                    <h2 className="text-sm font-black uppercase tracking-widest text-white">Historique passages & présence</h2>
                    <PassageHistoryPanel />
                    <div className="pro-card p-4 border border-blue-500/20">
                        <p className="text-xs text-slate-400">
                            Validation forcée : si une sortie est approuvée mais l&apos;agent sécurité n&apos;a pas été notifié,
                            validez depuis la file « Validation finale » puis utilisez l&apos;API force-confirm sur la demande concernée.
                        </p>
                    </div>
                </section>
            )}

            {tab === 'audit' && (
                <div className="pro-card p-8 border border-amber-500/30 space-y-4">
                    <div className="flex items-center gap-2 text-amber-300">
                        <Eye className="w-5 h-5" />
                        <h2 className="text-sm font-black uppercase tracking-widest">Mode Audit (aperçu)</h2>
                    </div>
                    <p className="text-sm text-slate-400">
                        Sélectionnez un utilisateur depuis la gestion des comptes pour simuler sa vue.
                        Brancher <code className="text-blue-400">POST /api/admin/audit/impersonate</code> côté backend.
                    </p>
                    <button
                        type="button"
                        onClick={() => setAuditUser({ name: 'user@seth.com', email: 'user@seth.com' })}
                        className="px-4 py-2 bg-amber-500 text-black rounded text-xs font-black uppercase"
                    >
                        Simuler vue utilisateur
                    </button>
                </div>
            )}
        </div>
    );
};
