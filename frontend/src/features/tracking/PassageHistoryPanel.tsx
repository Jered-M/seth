import { useEffect, useState } from 'react';
import { Clock, LogOut, ShieldAlert, UserCheck } from 'lucide-react';
import { trackingService } from '../../services/trackingService';

export const PassageHistoryPanel = () => {
    const [data, setData] = useState<Awaited<ReturnType<typeof trackingService.getPassageHistory>> | null>(null);

    useEffect(() => {
        trackingService.getPassageHistory().then(setData).catch(() => setData(null));
        const interval = setInterval(() => {
            trackingService.getPassageHistory().then(setData).catch(() => undefined);
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    if (!data) {
        return <p className="text-sm text-slate-500">Chargement de l&apos;historique...</p>;
    }

    const Section = ({
        title,
        icon: Icon,
        items,
        tone,
    }: {
        title: string;
        icon: typeof UserCheck;
        items: Record<string, unknown>[];
        tone: string;
    }) => (
        <section className="space-y-3">
            <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${tone}`}>
                <Icon className="w-4 h-4" />
                {title} ({items.length})
            </h3>
            <div className="pro-card divide-y divide-white/5 max-h-64 overflow-y-auto">
                {items.length === 0 ? (
                    <p className="p-4 text-xs text-slate-500">Aucun enregistrement</p>
                ) : (
                    items.map((item, i) => (
                        <div key={String(item.id || item.request_id || i)} className="p-4 text-xs space-y-1">
                            <p className="text-white font-semibold">
                                {String(item.user || item.label || item.message || '—')}
                            </p>
                            {item.department ? (
                                <p className="text-slate-500">Département: {String(item.department)}</p>
                            ) : null}
                            {item.device ? <p className="text-slate-500">Matériel: {String(item.device)}</p> : null}
                            {item.timestamp || item.updated_at || item.last_login ? (
                                <p className="text-slate-600 font-mono">
                                    {new Date(String(item.timestamp || item.updated_at || item.last_login)).toLocaleString('fr-FR')}
                                </p>
                            ) : null}
                            {item.zone_status ? (
                                <p className={item.zone_status === 'IN_ZONE' ? 'text-emerald-400' : 'text-red-400'}>
                                    Zone: {String(item.zone_status)}
                                </p>
                            ) : null}
                            {item.lat != null && item.lng != null ? (
                                <p className="text-blue-400 font-mono">
                                    GPS: {Number(item.lat).toFixed(5)}, {Number(item.lng).toFixed(5)}
                                </p>
                            ) : null}
                        </div>
                    ))
                )}
            </div>
        </section>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="Sur site — sortie approuvée" icon={UserCheck} items={data.on_site_authorized} tone="text-emerald-400" />
            <Section title="Sorties autorisées (matériel sorti)" icon={LogOut} items={data.exited_with_material} tone="text-blue-400" />
            <Section title="Connexions récentes" icon={Clock} items={data.recent_logins} tone="text-cyan-400" />
            <Section title="Hors zone / frauduleux / refusés" icon={ShieldAlert} items={data.fraudulent_or_blocked} tone="text-red-400" />
        </div>
    );
};
