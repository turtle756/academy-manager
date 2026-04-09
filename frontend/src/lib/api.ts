import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const academyId = localStorage.getItem('academy_id');
  if (academyId) {
    config.headers['X-Academy-Id'] = academyId;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const url = err.config?.url || '';
      if (!url.includes('/auth/me') && !url.includes('/academies/my')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('academy_id');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
