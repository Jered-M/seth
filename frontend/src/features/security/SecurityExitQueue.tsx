import { useEffect, useState } from 'react';
import { Package, LogOut, ShieldCheck, XCircle } from 'lucide-react';
import { InternalRequest, requestService } from '../../services/requestService';
import { getFreshBrowserLocation } from '../../services/locationService';
import { RequestStatusBadge } from '../shared/RequestStatusBadge';

interface SecurityExitQueueProps {
    onUpdated?: () => void;
}

export const SecurityExitQueue = ({ onUpdated }: SecurityExitQueueProps) => {
    const [queue, setQueue] = useState<InternalRequest[]>([]);
    const [history, setHistory] = useState<InternalRequest[]>([]);
    const [comment, setComment] = useState<Record<string, string>>({});
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const load = async () => {
        try {
            const [pending, past] = await Promise.all([
                requestService.pendingSecurity(),
                requestService.securityHistory(),
            ]);
            setQueue(pending);
            setHistory(past);
        } catch {
            setQueue([]);
            setHistory([]);
        }
    };

    useEffect(() => {
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    const confirm = async (id: string) => {
        setLoadingId(id);
        try {
            const agentLocation = await getFreshBrowserLocation();
            await requestService.confirmExit(
                id,
                comment[id],
                agentLocation ? { lat: agentLocation.lat, lng: agentLocation.lng, accuracy: agentLocation.accuracy } : undefined
            );
            await load();
            onUpdated?.();
        } finally {
            setLoadingId(null);
        }
    };

    const deny = async (id: string) => {
        setLoadingId(id);
        try {
            const agentLocation = await getFreshBrowserLocation();
            await requestService.denyExit(
                id,
                comment[id] || 'Refus au poste de sécurité',
                agentLocation ? { lat: agentLocation.lat, lng: agentLocation.lng, accuracy: agentLocation.accuracy } : undefined
            );
            await load();
            onUpdated?.();
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <div className="space-y-8">
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-sm font-black uppercase tracking-widest text-white">
                        Sorties matériel à contrôler ({queue.length})
                    </h2>
                </div>
                <p className="text-xs text-slate-400">
                    Demandes validées par Admin Département et Admin Général — autorisez ou refusez la sortie physique.
                </p>

                <div className="pro-card border border-emerald-500/20 divide-y divide-white/5">
                    {queue.length === 0 ? (
                        <p className="p-6 text-sm text-slate-500">Aucune sortie en attente au poste de sécurité</p>
                    ) : (
                        queue.map((req) => (
                            <div key={req.id} className="p-6 space-y-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-white">{req.title}</p>
                                        <p className="text-xs text-slate-400 mt-1">{req.reason}</p>
                                        <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-slate-500 uppercase">
                                            <span>Demandeur: {req.author_name || req.author_email}</span>
                                            {req.department_name ? <span>Dept: {req.department_name}</span> : null}
                                            {req.device_name ? (
                                                <span className="text-blue-400">Matériel: {req.device_name}</span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <RequestStatusBadge status={req.status} />
                                </div>
                                {(req.dept_comment || req.general_comment) && (
                                    <div className="text-[10px] text-slate-500 bg-[#0a0f1d] rounded p-3 border border-white/5">
                                        {req.dept_comment ? <p>Dept: {req.dept_comment}</p> : null}
                                        {req.general_comment ? <p className="mt-1">Général: {req.general_comment}</p> : null}
                                    </div>
                                )}
                                <input
                                    className="w-full bg-[#0a0f1d] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                                    placeholder="Note de contrôle (optionnel pour autoriser)"
                                    value={comment[req.id] || ''}
                                    onChange={(e) => setComment((p) => ({ ...p, [req.id]: e.target.value }))}
                                />
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        disabled={loadingId === req.id}
                                        onClick={() => confirm(req.id)}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-[10px] font-black uppercase text-white"
                                    >
                                        <ShieldCheck className="w-4 h-4" />
                                        Autoriser passage
                                    </button>
                                    <button
                                        type="button"
                                        disabled={loadingId === req.id}
                                        onClick={() => deny(req.id)}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-[10px] font-black uppercase text-white"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Refuser
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>

            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <LogOut className="w-5 h-5 text-slate-400" />
                    <h2 className="text-sm font-black uppercase tracking-widest text-white">Historique contrôles</h2>
                </div>
                <div className="pro-card border border-white/5 divide-y divide-white/5 max-h-80 overflow-y-auto">
                    {history.length === 0 ? (
                        <p className="p-6 text-sm text-slate-500">Aucun contrôle enregistré</p>
                    ) : (
                        history.map((req) => (
                            <div key={req.id} className="px-6 py-4 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm text-white">{req.title}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">{req.author_name}</p>
                                </div>
                                <RequestStatusBadge status={req.status} />
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
};
