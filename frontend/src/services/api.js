import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

const authApi = axios.create({
  baseURL: API_BASE_URL,
});

const uploadApi = axios.create({
  baseURL: API_BASE_URL,
});

uploadApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const videoAPI = {
  uploadVideo: (formData) => uploadApi.post('/videos/upload', formData),
  getVideo: (videoId) => api.get(`/videos/${videoId}`),
  listVideos: (status, limit = 20, offset = 0) => api.get('/videos', {
    params: { status, limit, offset },
  }),
  getAllVideos: (limit = 20, offset = 0) => api.get('/videos/all', {
    params: { limit, offset },
  }),
  getAnalysisResult: (videoId) => api.get(`/videos/${videoId}/analysis`),
  deleteVideo: (videoId) => api.delete(`/videos/${videoId}`),
};

export const reviewAPI = {
  getPendingReviews: (limit = 20, offset = 0, riskLevel) => api.get('/reviews/pending', {
    params: { limit, offset, riskLevel },
  }),
  submitReview: (data) => api.post('/reviews', data),
  updateReview: (reviewId, data) => api.put(`/reviews/${reviewId}`, data),
  getReviewHistory: (videoId) => api.get(`/reviews/${videoId}/history`),
  getAuditLog: (videoId) => api.get(`/reviews/${videoId}/log`),
};

export const statisticsAPI = {
  getDailyStats: (date) => api.get('/statistics/daily', { params: { date } }),
  getOverallStats: () => api.get('/statistics/overall'),
  getCategoryStats: () => api.get('/statistics/category'),
  getKeywordStats: () => api.get('/statistics/keywords'),
};

export const authAPI = {
  login: (username, password) => authApi.post('/auth/login', { username, password }),
  logout: () => {
    localStorage.removeItem('token');
  },
  getMe: () => api.get('/auth/me'),
};

export default api;
