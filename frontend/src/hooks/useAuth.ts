import { useState } from 'react';
import { authService, LoginCredentials, User } from '../services/authService';

export const useAuth = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const login = async (credentials: LoginCredentials) => {
        setLoading(true);
        setError(null);
        try {
            const response = await authService.login(credentials);
            setLoading(false);
            return response;
        } catch (err: unknown) {
            if (err instanceof Error && err.message === 'MFA_REQUIRED') {
                setLoading(false);
                throw err;
            }
            const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
            const errorMessage =
                axiosErr.response?.data?.message ||
                (err instanceof Error ? err.message : null) ||
                'Erreur de connexion';
            setError(errorMessage);
            setLoading(false);
            throw new Error(errorMessage);
        }
    };

    const logout = async () => {
        await authService.logout();
    };

    const getCurrentUser = (): User | null => {
        return authService.getCurrentUser();
    };

    const isAuthenticated = (): boolean => {
        return authService.isAuthenticated();
    };

    return {
        login,
        logout,
        getCurrentUser,
        isAuthenticated,
        loading,
        error
    };
};
