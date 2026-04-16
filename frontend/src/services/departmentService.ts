import api from './api';

export const departmentService = {
    getAll: () => api.get('/dept/all'),
    getStats: () => api.get('/dept/stats'),
    create: (data: any) => api.post('/dept/create', data),
    delete: (id: string) => api.delete(`/dept/${id}`),
};
