import axios from 'axios';

const baseURL = '/api';

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercept responses to handle global errors like 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If not authorized and we are not already on the login page
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      // For token refresh logic, we could attempt to refresh here.
      // For now, redirect to login via window or an event emitter.
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
