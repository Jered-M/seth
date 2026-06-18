import { Navigate } from 'react-router-dom';
import { authService } from '../services/authService';

function normalizeRole(role?: string): string {
    if (role === 'ADMIN_GENERAL') return 'SUPER_ADMIN';
    if (role === 'ADMIN_DEPT') return 'DEPT_ADMIN';
    if (role === 'SECURITY_AGENT') return 'GARDIEN';
    return role || '';
}

interface RoleRouteProps {
    allowed: string[];
    children: React.ReactNode;
}

/** Redirige vers l'accueil si le rôle connecté n'est pas autorisé. */
export const RoleRoute = ({ allowed, children }: RoleRouteProps) => {
    const user = authService.getCurrentUser();
    const role = normalizeRole(user?.role);

    if (!user || !allowed.includes(role)) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};
