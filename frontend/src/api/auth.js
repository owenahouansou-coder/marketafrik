import api from './axiosInstance';

export const register = (data) => api.post('/auth/register', data);
export const login = (data) => api.post('/auth/login', data);
export const logout = (data) => api.post('/auth/logout', data);
export const getMe = () => api.get('/auth/me');
export const verifyEmail = (token) => api.get(`/auth/verify-email?token=${token}`);
export const resendVerification = (email) => api.post('/auth/resend-verification', { email });
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email });
export const resetPassword = (data) => api.post('/auth/reset-password', data);
export const refreshToken = (refreshToken) => api.post('/auth/refresh', { refreshToken });