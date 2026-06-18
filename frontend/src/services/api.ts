import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

const DEV_LOGS = import.meta.env.DEV;

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        const requestUrl = `${config.baseURL ?? ''}${config.url ?? ''}`;
        if (DEV_LOGS && !isAuthEndpoint(requestUrl)) {
            console.log(`[SetH API] → ${config.method?.toUpperCase()} ${requestUrl}`);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

const isAuthEndpoint = (url?: string): boolean => {
    if (!url) return false;
    return url.includes('/auth/login') || url.includes('/auth/mfa') || url.includes('/auth/register');
};

api.interceptors.response.use(
    (response) => {
        if (DEV_LOGS) {
            console.log(`[SetH API] ← ${response.status} ${response.config.url}`, response.data);
        }
        return response;
    },
    (error) => {
        const status = error.response?.status;
        const requestUrl = error.config?.url as string | undefined;
        const hadToken = Boolean(error.config?.headers?.Authorization);
        const serverMsg =
            error.response?.data?.message ||
            error.response?.data?.msg;
        const authErrorCode = error.response?.data?.code;
        const isJwtError =
            status === 401 ||
            (status === 422 && typeof serverMsg === 'string' && serverMsg.toLowerCase().includes('signature'));

        if (serverMsg || status) {
            console.warn(`[SetH API] ← ${status} ${requestUrl}`, error.response?.data ?? error.message);
        }

        if (isJwtError && !isAuthEndpoint(requestUrl) && hadToken) {
            const detail = serverMsg || authErrorCode || requestUrl || 'API';
            sessionStorage.setItem(
                'auth_flash_error',
                `Session interrompue (${detail}). Reconnectez-vous.`
            );
            console.warn('[SetH AUTH] Session expirée — redirection login dans 1.2s', detail);
            localStorage.removeItem('access_token');
            localStorage.removeItem('user');
            if (!window.location.pathname.startsWith('/login')) {
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1200);
            }
        }
        return Promise.reject(error);
    }
);

export default api;
