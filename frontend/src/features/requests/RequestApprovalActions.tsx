import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { InternalRequest, requestService } from '../../services/requestService';
import { RequestStatusBadge } from '../shared/RequestStatusBadge';

interface RequestApprovalActionsProps {
    requests: InternalRequest[];
    level: 'dept' | 'global';
    onUpdated?: () => void;
}

export const RequestApprovalActions = ({ requests, level, onUpdated }: RequestApprovalActionsProps) => {
    const [comment, setComment] = useState<Record<string, string>>({});
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const act = async (id: string, action: 'approve' | 'reject') => {
        setLoadingId(id);
        try {
            if (action === 'approve') {
                await requestService.approve(id, comment[id]);
            } else {
                await requestService.reject(id, comment[id] || 'Rejet');
            }
            onUpdated?.();
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <div className="pro-card border border-white/5 divide-y divide-white/5">
            {requests.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">Aucune demande en attente ({level})</p>
            ) : (
                requests.map((req) => (
                    <div key={req.id} className="p-6 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="font-semibold text-white">{req.title}</p>
                                <p className="text-xs text-slate-400 mt-1">{req.reason}</p>
                            </div>
                            <RequestStatusBadge status={req.status} />
                        </div>
                        <input
                            className="w-full bg-[#0a0f1d] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                            placeholder="Commentaire (obligatoire pour rejeter)"
                            value={comment[req.id] || ''}
                            onChange={(e) => setComment((prev) => ({ ...prev, [req.id]: e.target.value }))}
                        />
                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={loadingId === req.id}
                                onClick={() => act(req.id, 'approve')}
                                className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-600 rounded text-[10px] font-black uppercase text-white"
                            >
                                <Check className="w-3.5 h-3.5" /> Valider
                            </button>
                            <button
                                type="button"
                                disabled={loadingId === req.id}
                                onClick={() => act(req.id, 'reject')}
                                className="inline-flex items-center gap-1 px-3 py-2 bg-red-600 rounded text-[10px] font-black uppercase text-white"
                            >
                                <X className="w-3.5 h-3.5" /> Rejeter
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};
