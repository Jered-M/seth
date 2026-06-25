import api from './api';
import { getLoginBrowserLocation } from './locationService';

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterData {
    email: string;
    password: string;
    name: string;
}

export interface User {
    id: string;
    name: string;
    role: string;
    email: string;
    department?: string;
    department_id?: string;
}

export interface LoginResponse {
    access_token: string;
    user: User;
}

export const authService = {
    async login(credentials: LoginCredentials): Promise<LoginResponse> {
        try {
            const location = await getLoginBrowserLocation();

            const response = await api.post('/auth/login', {
                ...credentials,
                ...(location ? { location } : {}),
            });

            console.log('[SetH AUTH] Réponse login:', {
                status: response.status,
                message: response.data?.message,
                role: response.data?.user?.role,
                code: response.data?.code,
            });

            if (response.data.message === 'MFA_REQUIRED') {
                localStorage.setItem('mfa_pending', JSON.stringify({
                    user_id: response.data.user_id,
                    risk_score: response.data.risk_score,
                    factors: response.data.factors,
                }));
                throw new Error('MFA_REQUIRED');
            }

            if (response.data.access_token && response.data.user) {
                localStorage.setItem('access_token', response.data.access_token);
                localStorage.setItem('user', JSON.stringify(response.data.user));
                return response.data;
            }

            if (response.data.tokens?.access_token) {
                const token = response.data.tokens.access_token;
                localStorage.setItem('access_token', token);
                const user: User = {
                    id: credentials.email,
                    name: credentials.email,
                    role: response.data.role,
                    email: credentials.email,
                };
                localStorage.setItem('user', JSON.stringify(user));
                return { access_token: token, user };
            }

            throw new Error('Réponse serveur incomplète (token manquant)');
        } catch (error: unknown) {
            if (error instanceof Error && error.message === 'MFA_REQUIRED') {
                throw error;
            }
            const ax = error as { response?: { status?: number; data?: { message?: string; code?: string } } };
            console.error('[SetH AUTH] Échec login:', {
                status: ax.response?.status,
                message: ax.response?.data?.message,
                code: ax.response?.data?.code,
            });
            throw error;
        }
    },

    async register(data: RegisterData): Promise<{ message: string; id: string }> {
        const response = await api.post('/auth/register', data);
        return response.data;
    },

    logout() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
    },

    getCurrentUser(): User | null {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                return JSON.parse(userStr);
            } catch {
                return null;
            }
        }
        return null;
    },

    isAuthenticated(): boolean {
        return !!localStorage.getItem('access_token');
    }
};
