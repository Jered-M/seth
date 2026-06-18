import { useEffect, useState } from 'react';
import { Building2, ShieldAlert, ClipboardList } from 'lucide-react';
import { RequestApprovalActions } from '../../features/requests/RequestApprovalActions';
import { StatCard } from '../../features/shared/StatCard';
import { InternalRequest, requestService } from '../../services/requestService';
import { authService } from '../../services/authService';
import api from '../../services/api';

export const DeptAdminDashboardPage = () => {
    const [pending, setPending] = useState<InternalRequest[]>([]);
    const [alertCount, setAlertCount] = useState(0);
    const user = authService.getCurrentUser();

    const load = async () => {
        try {
            const [reqs, alerts] = await Promise.all([
                requestService.pendingDept(),
                api.get('/security/alerts'),
            ]);
            setPending(reqs);
            setAlertCount(Array.isArray(alerts.data) ? alerts.data.length : 0);
        } catch {
            setPending([]);
        }
    };

    useEffect(() => {
        load();
        const interval = setInterval(load, 20000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="space-y-8 max-w-[1400px] mx-auto">
            <header>
                <h1 className="text-2xl font-black uppercase tracking-widest text-white">Admin Département</h1>
                <p className="text-xs text-slate-400 mt-1">{user?.department || 'Mon secteur'}</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label="Demandes à valider" value={pending.length} icon={ClipboardList} tone="amber" />
                <StatCard label="Alertes sécurité" value={alertCount} icon={ShieldAlert} tone="red" />
                <StatCard label="Département" value={user?.department || '—'} icon={Building2} tone="blue" />
            </div>

            <section className="space-y-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-white">Validation niveau 1</h2>
                <RequestApprovalActions requests={pending} level="dept" onUpdated={load} />
            </section>
        </div>
    );
};
