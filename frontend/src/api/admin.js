import api from './axiosInstance';

export const getDashboard = () => api.get('/admin/dashboard');
export const getProductsPending = (params) => api.get('/admin/products/pending', { params });
export const updateProductStatus = (id, status, reason) => api.patch(`/admin/products/${id}/status`, { status, reason });
export const getUsers = (params) => api.get('/admin/users', { params });
export const updateUserStatus = (id, status, reason) => api.patch(`/admin/users/${id}/status`, { status, reason });
export const getDisputes = (params) => api.get('/admin/disputes', { params });
export const resolveDispute = (id, data) => api.patch(`/admin/disputes/${id}/resolve`, data);
export const getCommissions = (params) => api.get('/admin/commissions', { params });
export const getAdminLogs = (params) => api.get('/admin/logs', { params });