import { useEffect, useState } from 'react';
import api from '../../services/api';
import { InternalRequest, requestService } from '../../services/requestService';
import { RequestStatusBadge } from '../shared/RequestStatusBadge';
import { Loader2, Plus, Send, Package, AlertTriangle } from 'lucide-react';

interface RequestFormProps {
    onCreated?: () => void;
}

interface UserDevice {
    id: string;
    name: string;
    serial_number?: string;
}

export const RequestForm = ({ onCreated }: RequestFormProps) => {
    const [title, setTitle] = useState('');
    const [reason, setReason] = useState('');
    const [requestType, setRequestType] = useState<'EXIT' | 'PROBLEM'>('EXIT');
    const [deviceId, setDeviceId] = useState('');
    const [devices, setDevices] = useState<UserDevice[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (requestType !== 'EXIT') return;
        const loadDevices = async () => {
            try {
                const res = await api.get('/user/devices/with-location');
                const list = Array.isArray(res.data) ? res.data : [];
                setDevices(list);
                if (list[0]?.id) setDeviceId(list[0].id);
            } catch {
                setDevices([]);
            }
        };
        loadDevices();
    }, [requestType]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            if (requestType === 'EXIT') {
                await requestService.create({
                    title: title || 'Sortie matériel',
                    reason,
                    type: 'EXIT',
                    device_id: deviceId,
                });
                setSuccess('Demande de sortie envoyée — suivi ci-dessous.');
            } else {
                await api.post('/security/report', {
                    type: 'USER_REPORT',
                    message: `${title ? title + ' — ' : ''}${reason}`.trim(),
                });
                setSuccess('Problème signalé — l\'équipe sécurité en a été informée.');
            }
            setTitle('');
            setReason('');
            onCreated?.();
        } catch (err: unknown) {
            const ax = err as { response?: { data?: { message?: string } } };
            setError(ax.response?.data?.message || 'Erreur lors de la soumission');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={submit} className="pro-card p-6 space-y-4 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
                <Plus className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Nouvelle action</h3>
            </div>

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setRequestType('EXIT')}
                    className={`flex-1 py-2 rounded text-[10px] font-black uppercase ${
                        requestType === 'EXIT' ? 'bg-blue-600 text-white' : 'bg-[#0a0f1d] text-slate-400 border border-white/10'
                    }`}
                >
                    Demander une sortie
                </button>
                <button
                    type="button"
                    onClick={() => setRequestType('PROBLEM')}
                    className={`flex-1 py-2 rounded text-[10px] font-black uppercase ${
                        requestType === 'PROBLEM' ? 'bg-amber-600 text-white' : 'bg-[#0a0f1d] text-slate-400 border border-white/10'
                    }`}
                >
                    Signaler un problème
                </button>
            </div>

            {requestType === 'EXIT' && (
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                        <Package className="w-3 h-3" /> Mon matériel assigné
                    </label>
                    <select
                        className="w-full bg-[#0a0f1d] border border-white/10 rounded-lg px-4 py-3 text-sm text-white"
                        value={deviceId}
                        onChange={(e) => setDeviceId(e.target.value)}
                        required
                    >
                        {devices.length === 0 ? (
                            <option value="">Aucun matériel assigné — contactez votre admin</option>
                        ) : (
                            devices.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name} {d.serial_number ? `(${d.serial_number})` : ''}
                                </option>
                            ))
                        )}
                    </select>
                </div>
            )}

            {requestType === 'PROBLEM' && (
                <p className="text-[10px] text-slate-500 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    Décrivez le problème (matériel défectueux, incident, anomalie…). Une alerte sera créée pour l'équipe sécurité.
                </p>
            )}

            <input
                className="w-full bg-[#0a0f1d] border border-white/10 rounded-lg px-4 py-3 text-sm text-white"
                placeholder={requestType === 'EXIT' ? 'Objet (ex. sortie client)' : 'Résumé du problème'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
                className="w-full bg-[#0a0f1d] border border-white/10 rounded-lg px-4 py-3 text-sm text-white min-h-[120px]"
                placeholder={
                    requestType === 'EXIT'
                        ? 'Motif, destination, durée prévue...'
                        : 'Détails du problème, lieu, matériel concerné...'
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
            />
            {error ? <p className="text-xs text-red-400">{error}</p> : null}
            {success ? <p className="text-xs text-emerald-400">{success}</p> : null}
            <button
                type="submit"
                disabled={loading || (requestType === 'EXIT' && !deviceId)}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50 ${
                    requestType === 'PROBLEM' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {requestType === 'EXIT' ? 'Envoyer la demande' : 'Signaler'}
            </button>
        </form>
    );
};

interface RequestListProps {
    requests: InternalRequest[];
    emptyLabel?: string;
}

export const RequestList = ({ requests, emptyLabel = 'Aucune demande' }: RequestListProps) => (
    <div className="pro-card border border-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Mes demandes</h3>
        </div>
        <div className="divide-y divide-white/5">
            {requests.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">{emptyLabel}</p>
            ) : (
                requests.map((req) => (
                    <div key={req.id} className="px-6 py-4 flex items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-semibold text-white">{req.title}</p>
                            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{req.reason}</p>
                        </div>
                        <RequestStatusBadge status={req.status} />
                    </div>
                ))
            )}
        </div>
    </div>
);
