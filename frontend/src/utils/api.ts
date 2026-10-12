import axios from 'axios';

// In production (Vercel): VITE_API_URL=https://your-aws-domain.com
// In development: uses Vite proxy → localhost:8000
const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL: BASE,
  timeout: 60000,
});

export const getModelStatus = () => api.get('/models/status');

export const getPestConfig = () => api.get('/pest/config');
export const predictPest = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/pest/predict', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const getPlantDiseaseConfig = () => api.get('/plant-disease/config');
export const predictPlantDisease = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/plant-disease/predict', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const getFertilizerConfig = () => api.get('/fertilizer/config');
export const predictFertilizer = (data: Record<string, unknown>) =>
  api.post('/fertilizer/predict', data);

export const getIrrigationConfig = () => api.get('/irrigation/config');
export const predictIrrigation = (data: Record<string, unknown>) =>
  api.post('/irrigation/predict', data);

export const getHistory = (params?: { model_id?: string; limit?: number; offset?: number }) =>
  api.get('/history/', { params });

export const getModelInspect = (modelId: string) =>
  api.get(`/models/${modelId}/inspect`);

export const uploadModel = (modelId: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/models/${modelId}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const reloadModel = (modelId: string) =>
  api.post(`/models/${modelId}/reload`);

export const deleteHistoryRecord = (id: number) =>
  api.delete(`/history/${id}`);

export const getReports = () => api.get('/reports/');

export const getEvaluationModelInfo = (modelId: string) =>
  api.get(`/evaluation/model/${modelId}/info`);

export default api;
