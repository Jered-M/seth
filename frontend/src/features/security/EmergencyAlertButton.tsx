import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import { authService } from '../../services/authService';

interface EmergencyAlertButtonProps {
    departments: Array<{ id: string; name: string }>;
    onTriggered?: () => void;
}

export const EmergencyAlertButton = ({ departments, onTriggered }: EmergencyAlertButtonProps) => {
    const [departmentId, setDepartmentId] = useState(departments[0]?.id || '');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const trigger = async () => {
        if (!departmentId) return;
        setLoading(true);
        try {
            await api.post('/security/alerts/trigger', {
                department_id: departmentId,
                type: 'MANUAL_ALERT',
                message: message || 'Anomalie signalée par agent de sécurité',
                severity: 'CRITICAL',
            });
            setMessage('');
            onTriggered?.();
        } finally {
            setLoading(false);
        }
    };

    const user = authService.getCurrentUser();

    return (
        <div className="pro-card p-8 border-2 border-red-500/40 bg-red-500/[0.04] text-center space-y-6">
            <AlertTriangle className="w-16 h-16 text-red-400 mx-auto" />
            <div>
                <h2 className="text-xl font-black uppercase tracking-widest text-red-300">Alerte d&apos;urgence</h2>
                <p className="text-xs text-slate-400 mt-2">Diffusion instantanée — Admin Département + Admin Général</p>
            </div>
            <select
                className="w-full max-w-md mx-auto bg-[#0a0f1d] border border-white/10 rounded-lg px-4 py-3 text-sm text-white"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
            >
                {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                ))}
            </select>
            <textarea
                className="w-full max-w-md mx-auto bg-[#0a0f1d] border border-white/10 rounded-lg px-4 py-3 text-sm text-white min-h-[80px]"
                placeholder={`Décrire l'anomalie — Agent: ${user?.name || 'Sécurité'}`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
            />
            <button
                type="button"
                disabled={loading}
                onClick={trigger}
                className="w-full max-w-md mx-auto py-4 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-red-900/30 disabled:opacity-50"
            >
                {loading ? 'Diffusion...' : 'Déclencher l\'alerte'}
            </button>
        </div>
    );
};
