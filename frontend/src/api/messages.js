import api from './axiosInstance';

export const getConversations = () => api.get('/conversations');
export const getOrCreateConversation = (data) => api.post('/conversations', data);
export const getConversation = (id, params) => api.get(`/conversations/${id}`, { params });
export const sendMessage = (id, content) => api.post(`/conversations/${id}/messages`, { content });
export const pollMessages = (id, since) => api.get(`/conversations/${id}/poll`, { params: { since } });
export const markAsRead = (id) => api.put(`/conversations/${id}/read`);
export const flagMessage = (id) => api.post(`/messages/${id}/flag`);
export const getUnreadCount = () => api.get('/unread-count');