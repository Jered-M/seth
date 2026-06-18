import { Eye } from 'lucide-react';

interface AuditModeBannerProps {
    impersonating?: { name: string; email: string } | null;
    onStop?: () => void;
}

export const AuditModeBanner = ({ impersonating, onStop }: AuditModeBannerProps) => {
    if (!impersonating) return null;

    return (
        <div className="sticky top-0 z-50 flex items-center justify-between gap-4 px-6 py-3 bg-amber-500 text-black border-b border-amber-600">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                <Eye className="w-4 h-4" />
                Mode Audit — Vue: {impersonating.name} ({impersonating.email})
            </div>
            <button type="button" onClick={onStop} className="text-xs font-black uppercase underline">
                Quitter le mode audit
            </button>
        </div>
    );
};
