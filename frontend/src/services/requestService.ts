import api from './api';

export interface InternalRequest {
    id: string;
    type: string;
    title: string;
    reason: string;
    status: string;
    device_id?: string | null;
    device_name?: string | null;
    device_serial?: string | null;
    department_id: string;
    department_name?: string | null;
    author_name?: string | null;
    author_email?: string | null;
    created_at?: string;
    updated_at?: string;
    exited_at?: string | null;
    dept_comment?: string | null;
    general_comment?: string | null;
    security_comment?: string | null;
}

export const requestService = {
    async create(data: {
        title: string;
        reason: string;
        type?: string;
        device_id?: string;
    }) {
        const res = await api.post<InternalRequest>('/requests/', data);
        return res.data;
    },

    async mine() {
        const res = await api.get<InternalRequest[]>('/requests/mine');
        return res.data;
    },

    async pendingDept() {
        const res = await api.get<InternalRequest[]>('/requests/pending/dept');
        return res.data;
    },

    async pendingGlobal() {
        const res = await api.get<InternalRequest[]>('/requests/pending/global');
        return res.data;
    },

    async pendingSecurity() {
        const res = await api.get<InternalRequest[]>('/requests/pending/security');
        return res.data;
    },

    async securityHistory() {
        const res = await api.get<InternalRequest[]>('/requests/history/security');
        return res.data;
    },

    async approve(id: string, comment?: string) {
        const res = await api.post<InternalRequest>(`/requests/${id}/approve`, { comment });
        return res.data;
    },

    async reject(id: string, comment: string) {
        const res = await api.post<InternalRequest>(`/requests/${id}/reject`, { comment });
        return res.data;
    },

    async confirmExit(id: string, comment?: string) {
        const res = await api.post<InternalRequest>(`/requests/${id}/confirm-exit`, { comment });
        return res.data;
    },

    async denyExit(id: string, comment: string) {
        const res = await api.post<InternalRequest>(`/requests/${id}/deny-exit`, { comment });
        return res.data;
    },
};
