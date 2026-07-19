import api from './api';

export interface PassageHistory {
    on_site_authorized: Record<string, unknown>[];
    exited_with_material: Record<string, unknown>[];
    fraudulent_or_blocked: Record<string, unknown>[];
    recent_logins: Record<string, unknown>[];
}

export const MAP_STATUS_LABELS: Record<string, string> = {
    AUTHORIZED_EXIT: 'Sortie autorisée',
    PENDING: 'En attente validation',
    OUT_OF_ZONE: 'Hors zone',
    MAINTENANCE: 'En panne',
    ON_SITE: 'Sur site',
    ONLINE: 'Connecté',
    GPS_DISABLED: 'GPS Désactivé',
};

export const MAP_STATUS_COLORS: Record<string, string> = {
    AUTHORIZED_EXIT: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    PENDING: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    OUT_OF_ZONE: 'text-red-400 border-red-500/30 bg-red-500/10',
    MAINTENANCE: 'text-slate-400 border-slate-500/30 bg-slate-500/10',
    ON_SITE: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    GPS_DISABLED: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
};

export const trackingService = {
    getPassageHistory: async (): Promise<PassageHistory> => {
        const { data } = await api.get<PassageHistory>('/user/tracking/passage-history');
        return data;
    },

    restoreDevice: async (deviceId: string, note?: string) => {
        const { data } = await api.post(`/admin/devices/${deviceId}/restore`, { note });
        return data;
    },

    resolveIncident: async (incidentId: string, note?: string) => {
        const { data } = await api.post(`/admin/incidents/${incidentId}/resolve`, { note });
        return data;
    },

    getGeofencingZones: async () => {
        const { data } = await api.get('/admin/geofencing/zones');
        return data;
    },

    getLocationAlerts: async () => {
        const { data } = await api.get('/admin/alerts/location');
        return data;
    },

    resolveLocationAlert: async (alertId: string) => {
        const { data } = await api.post(`/admin/alerts/${alertId}/resolve`);
        return data;
    },
};
