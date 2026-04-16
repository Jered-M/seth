import { Link, Outlet, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    Monitor,
    Users,
    LogOut,
    Bell,
    Search,
    LocateFixed,
    Building2,
    ShieldAlert,
    ClipboardList,
    Settings,
    FileCheck
} from 'lucide-react'

interface User {
    name: string;
    role: string;
}

interface LayoutProps {
    user: User;
    onLogout: () => void;
}

export const Layout = ({ user, onLogout }: LayoutProps) => {
    const location = useLocation()
    const role = user.role
    const normalizedRole = role === 'ADMIN_GENERAL' ? 'SUPER_ADMIN' : role === 'ADMIN_DEPT' ? 'DEPT_ADMIN' : role === 'SECURITY_AGENT' ? 'GARDIEN' : role

    const navItems = [
        { icon: LayoutDashboard, label: 'Tableau de bord', path: '/', roles: ['SUPER_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR', 'GARDIEN', 'USER'] },
        { icon: Users, label: 'Utilisateurs', path: '/users', roles: ['SUPER_ADMIN', 'DEPT_ADMIN'] },
        { icon: Building2, label: 'Départements', path: '/admin-departments', roles: ['SUPER_ADMIN'] },
        { icon: Monitor, label: 'Équipements', path: '/equipments', roles: ['DEPT_ADMIN', 'SUPERVISOR', 'USER'] },
        { icon: LocateFixed, label: 'Localisation', path: '/tracking', roles: ['SUPER_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR'] },
        { icon: FileCheck, label: 'Autorisations', path: '/guardian', roles: ['GARDIEN', 'DEPT_ADMIN'] },
        { icon: ShieldAlert, label: 'Alertes', path: '/alerts', roles: ['SUPER_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR'] },
        { icon: ClipboardList, label: 'Logs', path: '/logs', roles: ['SUPER_ADMIN', 'DEPT_ADMIN'] },
        { icon: Settings, label: 'Paramètres', path: '/settings', roles: ['SUPER_ADMIN', 'DEPT_ADMIN'] },
    ]

    return (
        <div className="flex min-h-screen bg-[#060b18] text-slate-200 font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-[#0a0f1d] border-r border-white/5 flex flex-col fixed inset-y-0 z-30 shadow-2xl">
                <div className="p-6 border-b border-white/5 bg-[#0d1224]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/40">
                            <Monitor className="text-white w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight text-white leading-none">SENTINEL</h1>
                            <p className="text-[10px] text-blue-400 font-black tracking-widest mt-1 uppercase">SECURITY OS</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
                    {navItems.filter(item => !item.roles || item.roles.includes(normalizedRole)).map((item) => {
                        const Icon = item.icon
                        const isActive = location.pathname === item.path
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3.5 rounded-lg transition-all text-sm font-medium ${isActive
                                    ? 'bg-blue-600/10 text-blue-400 border-l-2 border-blue-600 shadow-sm'
                                    : 'text-slate-500 hover:bg-white/5 hover:text-slate-200 border-l-2 border-transparent'
                                    }`}
                            >
                                <Icon className={`w-4 h-4 transition-transform ${isActive ? 'scale-110' : ''}`} />
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>

                <div className="p-4 bg-[#060b18] border-t border-white/5">
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all text-sm font-medium border-l-2 border-transparent"
                    >
                        <LogOut className="w-4 h-4" />
                        DÉCONNEXION
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 ml-64 flex flex-col min-h-screen relative">
                <div className="absolute inset-0 tactical-grid opacity-20 pointer-events-none"></div>

                {/* Header */}
                <header className="h-16 bg-[#0a0f1d]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-8 sticky top-0 z-20 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="relative group overflow-hidden">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="RECHERCHE GLOBALE..."
                                className="pl-10 pr-4 py-1.5 bg-[#060b18] border border-white/5 rounded text-xs font-mono tracking-widest text-slate-300 focus:outline-none focus:border-blue-600/50 w-64 transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <button title="Notifications" className="relative p-2 text-slate-400 hover:text-white transition-colors">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[#0a0f1d] animate-pulse"></span>
                        </button>
                        
                        <div className="h-4 w-[1px] bg-white/10"></div>
                        
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-sm font-bold text-white tracking-tight">{user.name}</p>
                                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter">
                                    {normalizedRole.replace('_', ' ')} // LVL_4
                                </p>
                            </div>
                            <div className="w-9 h-9 bg-blue-600 rounded flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-900/20">
                                {user.name.charAt(0)}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 p-8 relative z-10 overflow-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
