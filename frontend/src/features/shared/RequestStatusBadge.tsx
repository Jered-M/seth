const styles: Record<string, string> = {
    PENDING_DEPT: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    PENDING_GENERAL: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
    PENDING_SECURITY: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
    COMPLETED: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    REJECTED_DEPT: 'bg-red-500/10 text-red-300 border-red-500/30',
    REJECTED_GENERAL: 'bg-red-500/10 text-red-300 border-red-500/30',
    REJECTED_SECURITY: 'bg-red-500/10 text-red-300 border-red-500/30',
    CANCELLED: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
};

const labels: Record<string, string> = {
    PENDING_DEPT: 'En attente département',
    PENDING_GENERAL: 'En attente admin général',
    PENDING_SECURITY: 'Validée — poste sécurité',
    COMPLETED: 'Sortie autorisée',
    REJECTED_DEPT: 'Rejetée (dept)',
    REJECTED_GENERAL: 'Rejetée (global)',
    REJECTED_SECURITY: 'Refusée (sécurité)',
    CANCELLED: 'Annulée',
};

export const RequestStatusBadge = ({ status }: { status: string }) => (
    <span
        className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider border ${
            styles[status] || styles.PENDING_DEPT
        }`}
    >
        {labels[status] || status}
    </span>
);
