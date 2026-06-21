import api from './axiosInstance';

export const getVendors = (params) => api.get('/vendors', { params });
export const getVendor = (id) => api.get(`/vendors/${id}`);
export const getZones = () => api.get('/vendors/zones');
export const getDashboard = () => api.get('/vendors/me/dashboard');
export const updateProfile = (data) => api.put('/vendors/me/profile', data);
export const submitKyc = (data) => api.post('/kyc/submit', data, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const getKycStatus = () => api.get('/kyc/status');