import { useEffect, useState } from 'react';
import api from '../../services/api';

interface IncidentItem {
    id: string;
    type?: string;
    message?: string;
    is_resolved?: boolean;
    created_at?: string;
}

export const SecurityIncidentFeed = () => {
    const [items, setItems] = useState<IncidentItem[]>([]);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await api.get('/security/alerts');
                setItems(Array.isArray(res.data) ? res.data : []);
            } catch {
                setItems([]);
            }
        };
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="pro-card border border-white/5">
            <div className="px-6 py-4 border-b border-white/5">
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Historique incidents</h3>
            </div>
            <div className="divide-y divide-white/5 max-h-[420px] overflow-y-auto">
                {items.length === 0 ? (
                    <p className="p-6 text-sm text-slate-500">Aucun incident enregistré</p>
                ) : (
                    items.map((item) => (
                        <div key={item.id} className="px-6 py-4">
                            <p className="text-sm text-white">{item.message || item.type || 'Alerte'}</p>
                            <p className="text-[10px] text-slate-500 mt-1 uppercase">
                                {item.is_resolved ? 'Résolu' : 'Ouvert'} · {item.created_at || '—'}
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
