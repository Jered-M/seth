import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    label: string;
    value: number | string;
    icon: LucideIcon;
    tone?: 'blue' | 'emerald' | 'amber' | 'red';
}

const toneMap = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
};

export const StatCard = ({ label, value, icon: Icon, tone = 'blue' }: StatCardProps) => (
    <div className={`pro-card p-5 border ${toneMap[tone].split(' ').slice(2).join(' ')}`}>
        <div className="flex items-center justify-between">
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
                <p className="text-3xl font-bold text-white mt-2">{value}</p>
            </div>
            <div className={`p-3 rounded-lg border ${toneMap[tone]}`}>
                <Icon className="w-5 h-5" />
            </div>
        </div>
    </div>
);
