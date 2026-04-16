import { Routes, Route, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Layout } from './layouts/Layout'
import { Dashboard } from './pages/Dashboard'
import { AdminDashboard } from './pages/AdminDashboard'
import { GuardianDashboard } from './pages/GuardianDashboard'
import { UserDashboard } from './pages/UserDashboard'
import { UserManagement } from './pages/UserManagement'
import { Equipments } from './pages/Equipments'
import { TrackingMap } from './pages/TrackingMap'
import { Login } from './pages/Login'
import { AdminDepartments } from './pages/AdminDepartments'
import { DashboardDepartment } from './pages/DashboardDepartment'
import DepartmentEquipmentMap from './pages/DepartmentEquipmentMap'
import { useState, useEffect } from 'react'
import { authService } from './services/authService'

interface User {
    id: string;
    username: string;
    email: string;
    role: string;
    department?: string;
}

function App() {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Vérifier si un utilisateur est déjà connecté
        const currentUser = authService.getCurrentUser()
        if (currentUser) {
            setUser(currentUser as User)
        }
        setLoading(false)
    }, [])

    const handleLogin = (userData: User) => {
        setUser(userData)
    }

    const handleLogout = () => {
        authService.logout()
        setUser(null)
    }

    const role = (user as User | null)?.role;
    const normalizedRole = role === 'ADMIN_GENERAL'
        ? 'SUPER_ADMIN'
        : role === 'ADMIN_DEPT'
            ? 'DEPT_ADMIN'
            : role === 'SECURITY_AGENT'
                ? 'GARDIEN'
                : role

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Chargement...</p>
                </div>
            </div>
        )
    }

    return (
        <AnimatePresence mode="wait">
            <Routes>
                <Route path="/login" element={<Login onLogin={handleLogin} />} />

                <Route path="/" element={user ? <Layout user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}>
                    <Route index element={
                        normalizedRole === 'SUPER_ADMIN' ? <AdminDashboard /> :
                        normalizedRole === 'DEPT_ADMIN' ? <DashboardDepartment /> :
                        normalizedRole === 'SUPERVISOR' ? <UserManagement /> :
                        normalizedRole === 'GARDIEN' ? <GuardianDashboard /> :
                        normalizedRole === 'USER' ? <UserDashboard /> :
                        <Dashboard />
                    } />
                    <Route path="equipments" element={<Equipments />} />
                    <Route path="tracking" element={<TrackingMap />} />
                    <Route path="users" element={<UserManagement />} />
                    <Route path="admin-departments" element={<AdminDepartments />} />
                    <Route path="my-department" element={<DashboardDepartment />} />
                    <Route path="department-equipment-map" element={<DepartmentEquipmentMap />} />
                    <Route path="guardian" element={<GuardianDashboard />} />
                </Route>
            </Routes>
        </AnimatePresence>
    )
}

export default App
