import { useEffect, useState } from 'react';
import { EmergencyAlertButton } from '../../features/security/EmergencyAlertButton';
import { SecurityExitQueue } from '../../features/security/SecurityExitQueue';
import { departmentService } from '../../services/departmentService';
import { StatCard } from '../../features/shared/StatCard';
import { requestService } from '../../services/requestService';
import { Shield, Package } from 'lucide-react';

export const SecurityAgentDashboardPage = () => {
    const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
    const [pendingCount, setPendingCount] = useState(0);

    const refreshStats = async () => {
        try {
            const pending = await requestService.pendingSecurity();
            setPendingCount(pending.length);
        } catch {
            setPendingCount(0);
        }
    };

    useEffect(() => {
        const load = async () => {
            try {
                const res = await departmentService.getAll();
                setDepartments(Array.isArray(res.data) ? res.data : []);
            } catch {
                setDepartments([]);
            }
            await refreshStats();
        };
        load();
    }, []);

    return (
        <div className="space-y-8 max-w-[1200px] mx-auto">
            <header>
                <h1 className="text-2xl font-black uppercase tracking-widest text-white">Agent de sécurité</h1>
                <p className="text-xs text-slate-400 mt-1">
                    Contrôle des sorties matériel validées par les administrateurs
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatCard label="Sorties à contrôler" value={pendingCount} icon={Package} tone="amber" />
                <StatCard label="Poste actif" value="ONLINE" icon={Shield} tone="emerald" />
            </div>

            <SecurityExitQueue onUpdated={refreshStats} />

            <EmergencyAlertButton departments={departments} />
        </div>
    );
};
