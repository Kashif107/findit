import axios from 'axios';

export const TOKEN_KEY = 'findit_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER_ENDPOINT || 'http://localhost:5000/api'
});

// Content-Type is deliberately never set here: axios/browser add the multipart boundary for FormData.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const errMsg = (err) =>
  err?.response?.data?.message || (err?.request ? 'Cannot reach the server. Is it running?' : err?.message) || 'Something went wrong';

export default api;
