import api from './axiosInstance';

export const createOrder = (data) => api.post('/orders', data);
export const getOrders = (params) => api.get('/orders', { params });
export const getOrder = (id) => api.get(`/orders/${id}`);
export const updateOrderStatus = (id, status) => api.put(`/orders/${id}/status`, { status });
export const cancelOrder = (id, reason) => api.post(`/orders/${id}/cancel`, { reason });
export const initiatePayment = (data) => api.post('/payments/initiate', data);
export const confirmPayment = (data) => api.post('/payments/confirm', data);
export const getWallet = () => api.get('/payments/wallet');
export const getTransactionHistory = () => api.get('/payments/history');