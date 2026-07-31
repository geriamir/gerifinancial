import axios from 'axios';

// Falls back to the local backend so the existing dev flow is unchanged.
const API_ORIGIN = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const API_URL = `${API_ORIGIN.replace(/\/$/, '')}/api`;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  // The session is an httpOnly cookie on the API's origin, so it only travels
  // if credentials are sent explicitly on these cross-origin requests.
  withCredentials: true
});

// Log response errors
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data
    });
    return Promise.reject(error);
  }
);

export default api;
