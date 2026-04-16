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
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Erreur de connexion';
            setError(errorMessage);
            setLoading(false);
            throw new Error(errorMessage);
        }
    };

    const logout = () => {
        authService.logout();
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
