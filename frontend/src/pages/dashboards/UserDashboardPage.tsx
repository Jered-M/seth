import { useEffect, useState } from 'react';
import { ClipboardList, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { RequestForm, RequestList } from '../../features/requests/RequestForm';
import { StatCard } from '../../features/shared/StatCard';
import { InternalRequest, requestService } from '../../services/requestService';

export const UserDashboardPage = () => {
    const [requests, setRequests] = useState<InternalRequest[]>([]);

    const load = async () => {
        try {
            const data = await requestService.mine();
            setRequests(data);
        } catch {
            setRequests([]);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const pending = requests.filter((r) =>
        r.status.startsWith('PENDING')
    ).length;
    const completed = requests.filter((r) => r.status === 'COMPLETED').length;
    const rejected = requests.filter((r) => r.status.startsWith('REJECTED')).length;

    return (
        <div className="space-y-8 max-w-[1400px] mx-auto">
            <header>
                <h1 className="text-2xl font-black uppercase tracking-widest text-white">Espace utilisateur</h1>
                <p className="text-xs text-slate-400 mt-1">
                    Demandez une sortie de matériel ou signalez un problème — pas d'accès à l'inventaire global
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label="En attente" value={pending} icon={Clock} tone="amber" />
                <StatCard label="Validées / sorties" value={completed} icon={CheckCircle2} tone="emerald" />
                <StatCard label="Rejetées" value={rejected} icon={XCircle} tone="red" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <RequestForm onCreated={load} />
                <RequestList requests={requests} />
            </div>
        </div>
    );
};
