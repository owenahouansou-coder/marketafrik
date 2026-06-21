import api from './axiosInstance';

export const getActiveCampaign = () => api.get('/campaigns/active');
export const getAllCampaigns = () => api.get('/campaigns');
export const createCampaign = (data) => api.post('/campaigns', data, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const toggleCampaign = (id, is_active) => api.patch(`/campaigns/${id}`, { is_active });
export const deleteCampaign = (id) => api.delete(`/campaigns/${id}`);