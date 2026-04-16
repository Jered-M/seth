import api from './api';

export interface Equipment {
    id: string;
    serialNumber: string;
    type: string;
    status: string;
    departmentId?: string | null;
    department: string | null;
    assignedTo: string | null;
    location?: string | null;
}

export interface CreateEquipmentData {
    type: string;
    departmentId?: string;
    location?: string;
}

export interface AssignEquipmentData {
    userId: string;
}

export interface Stats {
    total: number;
    available: number;
    busy: number;
    maintenance: number;
}

export const equipmentService = {
    async getAll(): Promise<Equipment[]> {
        try {
            const response = await api.get<Equipment[]>('/equipments/');
            return (Array.isArray(response.data) ? response.data : []).map((item: any) => ({
                ...item,
                serialNumber: item.serialNumber || item.qrCode || item.serial_number || item.id,
            }));
        } catch (error: any) {
            if (![404, 405].includes(error?.response?.status)) throw error;
            const fallbackResponse = await api.get<Equipment[]>('/equipment/');
            return (Array.isArray(fallbackResponse.data) ? fallbackResponse.data : []).map((item: any) => ({
                ...item,
                serialNumber: item.serialNumber || item.qrCode || item.serial_number || item.id,
            }));
        }
    },

    async create(data: CreateEquipmentData): Promise<{ message: string; id: string }> {
        try {
            const response = await api.post('/equipments/', data);
            return response.data;
        } catch (error: any) {
            if (![404, 405].includes(error?.response?.status)) throw error;
            const fallbackResponse = await api.post('/equipment/', data);
            return fallbackResponse.data;
        }
    },

    async assign(equipmentId: string, data: AssignEquipmentData): Promise<{ message: string; id: string }> {
        try {
            const response = await api.post(`/equipments/${equipmentId}/assign`, data);
            return response.data;
        } catch (error: any) {
            if (![404, 405].includes(error?.response?.status)) throw error;
            const fallbackResponse = await api.post(`/equipment/${equipmentId}/assign`, data);
            return fallbackResponse.data;
        }
    },

    async getAssignableUsers(equipmentId: string): Promise<Array<{ id: string; name: string; email: string }>> {
        try {
            const response = await api.get(`/equipments/${equipmentId}/assignable-users`);
            return Array.isArray(response.data) ? response.data : [];
        } catch (error: any) {
            if (![404, 405].includes(error?.response?.status)) throw error;
            const fallbackResponse = await api.get(`/equipment/${equipmentId}/assignable-users`);
            return Array.isArray(fallbackResponse.data) ? fallbackResponse.data : [];
        }
    },

    async getStats(): Promise<Stats> {
        try {
            const equipments = await this.getAll();
            return {
                total: equipments.length,
                available: equipments.filter(e => e.status === 'AVAILABLE').length,
                busy: equipments.filter(e => e.status === 'ASSIGNED').length,
                maintenance: equipments.filter(e => e.status === 'MAINTENANCE').length,
            };
        } catch (error) {
            console.error('Error fetching stats:', error);
            return { total: 0, available: 0, busy: 0, maintenance: 0 };
        }
    }
};
