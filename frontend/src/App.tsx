import { Routes, Route, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Layout } from './layouts/Layout'
import { Dashboard } from './pages/Dashboard'
import { UserDashboardPage } from './pages/dashboards/UserDashboardPage'
import { DeptAdminDashboardPage } from './pages/dashboards/DeptAdminDashboardPage'
import { SuperAdminDashboardPage } from './pages/dashboards/SuperAdminDashboardPage'
import { SecurityAgentDashboardPage } from './pages/dashboards/SecurityAgentDashboardPage'
import { UserManagement } from './pages/UserManagement'
import { Equipments } from './pages/Equipments'
import { TrackingMap } from './pages/TrackingMap'
import { Login } from './pages/Login'
import { AdminDepartments } from './pages/AdminDepartments'
import { DashboardDepartment } from './pages/DashboardDepartment'
import DepartmentEquipmentMap from './pages/DepartmentEquipmentMap'
import { SecurityAlerts } from './pages/SecurityAlerts'
import { SecurityLogs } from './pages/SecurityLogs'
import { SettingsPage } from './pages/Settings'
import { RoleRoute } from './components/RoleRoute'
import { useState, useEffect } from 'react'
import { authService, User } from './services/authService'
import { registerPushNotifications, syncPushSubscriptionIfEnabled } from './services/pushNotificationService'

function App() {
    const [user, setUser] = useState<User | null>(() =>
        authService.isAuthenticated() ? authService.getCurrentUser() : null
    );
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authService.isAuthenticated()) {
            setUser((prev) => prev ?? authService.getCurrentUser());
            syncPushSubscriptionIfEnabled().catch(() => undefined);
        } else {
            authService.logout();
            setUser(null);
        }
        setLoading(false);
    }, []);

    const handleLogin = (userData: User) => {
        setUser(userData);
        registerPushNotifications().catch(() => undefined);
    };

    const handleLogout = () => {
        authService.logout();
        setUser(null);
    };

    const sessionUser = user ?? (authService.isAuthenticated() ? authService.getCurrentUser() : null);
    const isLoggedIn = Boolean(sessionUser && authService.isAuthenticated());
    const role = sessionUser?.role;
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

                <Route path="/" element={isLoggedIn && sessionUser ? <Layout user={sessionUser} onLogout={handleLogout} /> : <Navigate to="/login" />}>
                    <Route index element={
                        normalizedRole === 'SUPER_ADMIN' ? <SuperAdminDashboardPage /> :
                        normalizedRole === 'DEPT_ADMIN' ? <DeptAdminDashboardPage /> :
                        normalizedRole === 'GARDIEN' ? <SecurityAgentDashboardPage /> :
                        normalizedRole === 'USER' ? <UserDashboardPage /> :
                        <Dashboard />
                    } />
                    <Route path="equipments" element={
                        <RoleRoute allowed={['SUPER_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR']}>
                            <Equipments />
                        </RoleRoute>
                    } />
                    <Route path="tracking" element={
                        <RoleRoute allowed={['SUPER_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR', 'GARDIEN']}>
                            <TrackingMap />
                        </RoleRoute>
                    } />
                    <Route path="users" element={
                        <RoleRoute allowed={['SUPER_ADMIN', 'DEPT_ADMIN']}>
                            <UserManagement />
                        </RoleRoute>
                    } />
                    <Route path="admin-departments" element={
                        <RoleRoute allowed={['SUPER_ADMIN']}>
                            <AdminDepartments />
                        </RoleRoute>
                    } />
                    <Route path="my-department" element={
                        <RoleRoute allowed={['DEPT_ADMIN', 'SUPERVISOR']}>
                            <DashboardDepartment />
                        </RoleRoute>
                    } />
                    <Route path="department-equipment-map" element={
                        <RoleRoute allowed={['SUPER_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR']}>
                            <DepartmentEquipmentMap />
                        </RoleRoute>
                    } />
                    <Route path="guardian" element={
                        <RoleRoute allowed={['GARDIEN', 'DEPT_ADMIN']}>
                            <SecurityAgentDashboardPage />
                        </RoleRoute>
                    } />
                    <Route path="alerts" element={
                        <RoleRoute allowed={['SUPER_ADMIN', 'DEPT_ADMIN', 'SUPERVISOR']}>
                            <SecurityAlerts />
                        </RoleRoute>
                    } />
                    <Route path="logs" element={
                        <RoleRoute allowed={['SUPER_ADMIN', 'DEPT_ADMIN']}>
                            <SecurityLogs />
                        </RoleRoute>
                    } />
                    <Route path="settings" element={
                        <RoleRoute allowed={['SUPER_ADMIN', 'DEPT_ADMIN']}>
                            <SettingsPage />
                        </RoleRoute>
                    } />
                </Route>
            </Routes>
        </AnimatePresence>
    )
}

export default App
