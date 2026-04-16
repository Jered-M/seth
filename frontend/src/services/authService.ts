import api from './api';

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

const getBrowserLocation = async (): Promise<{ lat: number; lng: number; accuracy?: number } | null> => {
    if (!navigator.geolocation) return null;

    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 7000, maximumAge: 120000 }
        );
    });
};

export const authService = {
    async login(credentials: LoginCredentials): Promise<LoginResponse> {
        try {
            const location = await getBrowserLocation();
            const response = await api.post('/auth/login', {
                ...credentials,
                ...(location ? { location } : {})
            });
            console.log('Raw auth response:', response.data);
            
            // Vérifier si MFA est requis
            if (response.data.message === 'MFA_REQUIRED') {
                localStorage.setItem('mfa_pending', JSON.stringify({
                    user_id: response.data.user_id,
                    risk_score: response.data.risk_score,
                    factors: response.data.factors
                }));
                throw new Error('MFA_REQUIRED');
            }
            
            // Cas 1: Nouvelle structure (access_token + user)
            if (response.data.access_token && response.data.user) {
                localStorage.setItem('access_token', response.data.access_token);
                localStorage.setItem('user', JSON.stringify(response.data.user));
                return response.data;
            }
            
            // Cas 2: Ancienne structure (tokens.access_token + role)
            if (response.data.tokens && response.data.tokens.access_token) {
                const token = response.data.tokens.access_token;
                localStorage.setItem('access_token', token);
                
                const user: User = {
                    id: credentials.email,
                    name: credentials.email,
                    role: response.data.role,
                    email: credentials.email
                };
                localStorage.setItem('user', JSON.stringify(user));
                
                return {
                    access_token: token,
                    user
                };
            }
            
            return response.data;
        } catch (error) {
            console.error('Login error:', error);
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
