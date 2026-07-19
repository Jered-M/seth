import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    Monitor,
    Users,
    LogOut,
    Search,
    LocateFixed,
    Building2,
    ShieldAlert,
    ClipboardList,
    Settings,
    FileCheck,
    Menu,
    X
} from 'lucide-react'
import { NotificationBell } from '../components/NotificationBell'

interface User {
    id?: string;
    name: string;
    role: string;
}

interface LayoutProps {
    user: User;
    onLogout: () => void;
}

export const Layout = ({ user, onLogout }: LayoutProps) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const location = useLocation()
    const role = user.role
    const normalizedRole = role === 'ADMIN_GENERAL' ? 'SUPER_ADMIN' : role === 'ADMIN_DEPT' ? 'DEPT_ADMIN' : role === 'SECURITY_AGENT' ? 'GARDIEN' : role

    const navItems = [
        { icon: LayoutDashboard, label: 'Tableau de bord', path: '/', roles: ['SUPER_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR', 'GARDIEN', 'USER'] },
        { icon: Users, label: 'Utilisateurs', path: '/users', roles: ['SUPER_ADMIN', 'DEPT_ADMIN'] },
        { icon: Building2, label: 'Départements', path: '/admin-departments', roles: ['SUPER_ADMIN'] },
        { icon: Monitor, label: 'Équipements', path: '/equipments', roles: ['SUPER_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR'] },
        { icon: LocateFixed, label: 'Localisation', path: '/tracking', roles: ['SUPER_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR', 'GARDIEN'] },
        { icon: FileCheck, label: 'Autorisations', path: '/guardian', roles: ['GARDIEN', 'DEPT_ADMIN'] },
        { icon: ShieldAlert, label: 'Alertes', path: '/alerts', roles: ['SUPER_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR'] },
        { icon: ClipboardList, label: 'Logs', path: '/logs', roles: ['SUPER_ADMIN', 'DEPT_ADMIN'] },
        { icon: Settings, label: 'Paramètres', path: '/settings', roles: ['SUPER_ADMIN', 'DEPT_ADMIN'] },
    ]

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen)

    return (
        <div className="flex min-h-screen bg-[#060b18] text-slate-200 font-sans">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-64 bg-[#0a0f1d] border-r border-white/5 flex flex-col 
                transition-transform duration-300 transform 
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
                lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen
            `}>
                <div className="p-6 border-b border-white/5 bg-[#0d1224] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg shadow-lg shadow-blue-900/40">
                            <Monitor className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold leading-none tracking-tight text-white">SENTINEL</h1>
                            <p className="text-[10px] text-blue-400 font-black tracking-widest mt-1 uppercase">SECURITY OS</p>
                        </div>
                    </div>
                    <button onClick={toggleSidebar} className="lg:hidden text-slate-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
                    {navItems.filter(item => !item.roles || item.roles.includes(normalizedRole)).map((item) => {
                        const Icon = item.icon
                        const isActive = location.pathname === item.path
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsSidebarOpen(false)}
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
                        className="flex items-center w-full gap-3 px-4 py-3 text-sm font-medium transition-all border-l-2 border-transparent rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                    >
                        <LogOut className="w-4 h-4" />
                        DÉCONNEXION
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="relative flex flex-col flex-1 w-full min-h-screen">
                <div className="absolute inset-0 pointer-events-none tactical-grid opacity-20"></div>

                {/* Header */}
                <header className="h-16 bg-[#0a0f1d]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-20 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={toggleSidebar}
                            className="p-2 rounded-lg lg:hidden text-slate-400 hover:text-white bg-white/5"
                        >
                            <Menu className="w-6 h-6" />
                        </button>

                        <div className="relative hidden overflow-hidden md:flex group">
                            <Search className="absolute w-4 h-4 -translate-y-1/2 left-3 top-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="RECHERCHE GLOBALE..."
                                className="pl-10 pr-4 py-1.5 bg-[#060b18] border border-white/5 rounded text-xs font-mono tracking-widest text-slate-300 focus:outline-none focus:border-blue-600/50 w-48 lg:w-64 transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 lg:gap-6">
                        <NotificationBell userId={user.id} />
                        
                        <div className="hidden sm:block h-4 w-[1px] bg-white/10"></div>
                        
                        <div className="flex items-center gap-2 lg:gap-4">
                            <div className="hidden text-right sm:block">
                                <p className="text-sm font-bold tracking-tight text-white">{user.name}</p>
                                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter">
                                    {normalizedRole.replace('_', ' ')}
                                </p>
                            </div>
                            <div className="flex items-center justify-center w-8 h-8 text-xs font-black text-white bg-blue-600 rounded shadow-lg lg:w-9 lg:h-9 lg:text-sm shadow-blue-900/20">
                                {user.name.charAt(0)}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="relative z-10 flex-1 p-4 overflow-x-hidden lg:p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
