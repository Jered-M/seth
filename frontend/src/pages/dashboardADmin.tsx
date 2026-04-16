import React from "react";
import { useAuth } from "../hooks/useAuth";
import { 
    Shield, 
    Zap, 
    Monitor, 
    Layout as Hub, 
    Globe as Public, 
    Bell as Notifications, 
    Play, 
    ShieldAlert, 
    Activity, 
    Lock,
    Command,
    Terminal,
    Cpu
} from "lucide-react";

export const DashboardAdmin = () => {
    const { getCurrentUser } = useAuth();
    const user = getCurrentUser();

    const stats = [
        { label: "Alertes Flux", value: "0", sub: "SYNC_OK", icon: ShieldAlert, color: "text-red-500", bg: "bg-red-500/10" },
        { label: "Nodes Actifs", value: "128", sub: "GLOBAL", icon: Activity, color: "text-blue-400", bg: "bg-blue-500/10" },
        { label: "Opérateurs", value: "12", sub: "ONLINE", icon: Public, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    ];

    return (
        <div className="space-y-10 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* Hero Section */}
            <div className="relative overflow-hidden pro-card p-12 bg-gradient-to-br from-blue-600/5 to-transparent border-blue-500/20">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="absolute inset-0 tactical-grid opacity-10 pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="space-y-6 max-w-2xl">
                        <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                            PROTOCOL_LEVEL: 4
                        </div>
                        <h1 className="text-5xl font-black tracking-tighter uppercase leading-tight text-white">
                            BIENVENUE, <span className="text-blue-500 italic">{user?.name || "OPERATOR"}</span>
                        </h1>
                        <p className="text-slate-500 text-sm font-black uppercase tracking-[0.3em] italic">
                            NODE_ID_{user?.id?.substring(0, 8) || "0x000"} // TERMINAL_SÉCURISÉ_ACTIF
                        </p>
                    </div>
                    <div className="flex gap-6">
                        <div className="w-20 h-20 rounded-2xl bg-[#0a0f1d] border border-white/5 flex items-center justify-center shadow-2xl group transition-all hover:border-blue-500/30">
                            <Shield className="w-8 h-8 text-blue-500 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="w-20 h-20 rounded-2xl bg-[#0a0f1d] border border-white/5 flex items-center justify-center shadow-2xl group transition-all hover:border-amber-500/30">
                            <Zap className="w-8 h-8 text-amber-500 group-hover:rotate-12 transition-transform" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {stats.map((stat, i) => (
                    <div key={i} className="pro-card p-8 group hover:border-white/10 transition-all">
                        <div className="flex items-start justify-between">
                            <div className={`${stat.bg} p-4 rounded-xl border border-white/5 shadow-inner`}>
                                <stat.icon className={`${stat.color} w-6 h-6`} />
                            </div>
                            <div className="text-right">
                                <p className="text-slate-500 font-black text-[10px] uppercase tracking-[0.2em]">{stat.label}</p>
                                <p className="text-4xl font-bold text-white mt-1 tracking-tighter">{stat.value}</p>
                                <p className="text-blue-500/40 text-[9px] font-black mt-1 tracking-widest">{stat.sub}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tactical Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="pro-card p-10">
                    <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                        <Terminal className="w-5 h-5 text-blue-500" />
                        COMMANDES_SYSTÈME
                    </h3>
                    <div className="space-y-4">
                        {[
                            { title: "PERMISSIONS_OVERRIDE", desc: "Gérer les accès aux nodes opérationnels", icon: Lock },
                            { title: "THREAT_ANALYSIS", desc: "Générer la télémétrie de risque", icon: Activity },
                            { title: "SYSTEM_REBOOT", desc: "Purger le cache et les protocoles", icon: Zap },
                        ].map((action, i) => (
                            <button key={i} className="w-full group flex items-center justify-between p-6 rounded-xl bg-[#0a0f1d] border border-white/5 hover:border-blue-500/30 hover:bg-blue-600/[0.02] transition-all">
                                <div className="text-left">
                                    <p className="text-white font-black text-[11px] tracking-[0.2em] group-hover:text-blue-400 transition-colors uppercase">{action.title}</p>
                                    <p className="text-slate-500 text-[9px] mt-1 font-bold uppercase italic">{action.desc}</p>
                                </div>
                                <action.icon className="w-4 h-4 text-slate-600 transition-all group-hover:text-blue-500 group-hover:translate-x-1" />
                            </button>
                        ))}
                    </div>
                </div>

                <div className="pro-card p-10 bg-gradient-to-br from-blue-600/10 to-transparent relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none">
                        <Public className="w-[300px] h-[300px]" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-blue-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                             <Command className="w-4 h-4" /> NODE_ADVISORY
                        </h3>
                        <p className="text-slate-400 font-bold leading-relaxed text-[11px] uppercase tracking-widest italic">
                            SENTINEL OS v4.0 est synchronisé avec tous les nœuds régionaux. Le chiffrement AES-256 est actif sur tous les paquets sortants.
                        </p>
                    </div>
                    
                    <div className="mt-8 p-6 rounded-xl bg-white/[0.02] border border-white/5 backdrop-blur-sm group hover:bg-white/[0.05] transition-all cursor-pointer">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded bg-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-transform group-hover:scale-105">
                                <Play className="w-5 h-5 text-white fill-current" />
                            </div>
                            <div>
                                <p className="text-white font-black text-[10px] tracking-widest uppercase">GUIDE_PROTOCOLE</p>
                                <p className="text-slate-500 text-[9px] uppercase font-bold mt-1">Module d'entraînement opérationnel (03:42)</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};