import api from './api';

export interface AppNotification {
    id: string;
    type: string;
    title: string;
    message: string;
    payload?: Record<string, unknown>;
    is_read: boolean;
    created_at: string | null;
}

export interface NotificationsResponse {
    unread_count: number;
    notifications: AppNotification[];
}

export const notificationService = {
    async list(): Promise<NotificationsResponse> {
        const { data } = await api.get<NotificationsResponse | AppNotification[]>('/security/notifications');
        if (Array.isArray(data)) {
            return {
                unread_count: data.filter((n) => !n.is_read).length,
                notifications: data,
            };
        }
        return {
            unread_count: data.unread_count ?? 0,
            notifications: Array.isArray(data.notifications) ? data.notifications : [],
        };
    },

    async markRead(id: string): Promise<void> {
        await api.post(`/security/notifications/${id}/read`);
    },

    async markAllRead(): Promise<void> {
        await api.post('/security/notifications/read-all');
    },
};
