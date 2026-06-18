import api from './api';

export interface DepartmentStats {
    total_departments: number;
    total_users: number;
    total_equipment: number;
    security_alerts: number;
}

export interface DepartmentSummary {
    id: string;
    name: string;
    admin_count: number;
    equipment_count: number;
    active_users: number;
}

function normalizeStats(body: unknown): DepartmentStats {
    const nested = body as { data?: Partial<DepartmentStats> };
    const raw = nested?.data ?? (body as Partial<DepartmentStats>);
    return {
        total_departments: raw?.total_departments ?? 0,
        total_users: raw?.total_users ?? 0,
        total_equipment: raw?.total_equipment ?? 0,
        security_alerts: raw?.security_alerts ?? 0,
    };
}

export const departmentService = {
    getAll: async (): Promise<{ data: DepartmentSummary[] }> => {
        const res = await api.get<DepartmentSummary[]>('/dept/all');
        return { data: Array.isArray(res.data) ? res.data : [] };
    },

    getStats: async (): Promise<{ data: DepartmentStats }> => {
        try {
            const res = await api.get('/admin/system-stats');
            return { data: normalizeStats(res.data) };
        } catch {
            const res = await api.get('/dept/stats');
            return { data: normalizeStats(res.data) };
        }
    },

    create: (data: { name: string }) => api.post('/admin/departments', data),
    delete: (id: string) => api.delete(`/admin/departments/${id}`),
};
