import { BASE_URL, refreshTokenRoute } from '@/constants/backend_routes';
import axios from 'axios';

// NOTE: react-hot-toast is NOT imported at the top level.
// Turbopack/Next.js cannot instantiate its ESM module (.mjs) before the React
// component tree is ready. We import it lazily inside callbacks instead.
async function showErrorToast(message: string) {
  try {
    const { default: toast } = await import('react-hot-toast');
    toast.error(message);
  } catch {
    // toast unavailable (e.g. during SSR) — fail silently
  }
}

const axios_api = axios.create({
  baseURL: BASE_URL + '/api',
  withCredentials: true,
});

// Variables to track the refresh-token race condition
let isRefreshing = false;
let failedQueue: { resolve: (v: any) => void; reject: (e: any) => void }[] = [];

const processQueue = (error: any, token: null | boolean = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else       prom.resolve(token);
  });
  failedQueue = [];
};

axios_api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // ── 401 handling: try to refresh the token ───────────────────────────
    if (error.response?.status === 401 && !originalRequest._retry) {

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => axios_api(originalRequest))
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post(refreshTokenRoute, {}, { withCredentials: true });
        processQueue(null, true);
        return axios_api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // ── Global error toast (non-401 errors) ──────────────────────────────
    if (error.response && error.response.status !== 401) {
      const raw = error.response.data?.ERROR || error.response.data?.MESSAGE || error.message || 'An unexpected error occurred';
      const displayMessage = Array.isArray(raw) ? raw[0] : raw;
      showErrorToast(displayMessage);
    } else if (!error.response) {
      showErrorToast('Network error. Please check your connection.');
    }

    return Promise.reject(error);
  }
);

export default axios_api;
