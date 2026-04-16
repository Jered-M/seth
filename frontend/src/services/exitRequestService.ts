import api from './api';

export interface CreateExitRequestData {
    equipmentId: string;
    reason: string;
    duration: string;
}

export interface ApproveRequestData {
    approved: boolean;
}

export const exitRequestService = {
    async create(data: CreateExitRequestData): Promise<{ message: string; id: string }> {
        const response = await api.post('/exit-requests/', data);
        return response.data;
    },

    async approve(requestId: string, data: ApproveRequestData): Promise<{ message: string; id: string }> {
        const response = await api.post(`/exit-requests/${requestId}/approve`, data);
        return response.data;
    },

    async confirmExit(requestId: string): Promise<{ message: string }> {
        const response = await api.post(`/exit-requests/${requestId}/confirm`);
        return response.data;
    }
};
