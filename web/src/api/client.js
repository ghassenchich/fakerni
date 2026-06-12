import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const TOKEN_KEYS = {
  access: "fakerni_access",
  refresh: "fakerni_refresh",
};

export function getTokens() {
  return {
    access: localStorage.getItem(TOKEN_KEYS.access),
    refresh: localStorage.getItem(TOKEN_KEYS.refresh),
  };
}

export function setTokens({ access, refresh }) {
  if (access) localStorage.setItem(TOKEN_KEYS.access, access);
  if (refresh) localStorage.setItem(TOKEN_KEYS.refresh, refresh);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEYS.access);
  localStorage.removeItem(TOKEN_KEYS.refresh);
}

const client = axios.create({ baseURL: BASE_URL });

client.interceptors.request.use((config) => {
  const { access } = getTokens();
  if (access) {
    config.headers.Authorization = `Bearer ${access}`;
  }
  return config;
});

let refreshPromise = null;

async function refreshAccessToken() {
  const { refresh } = getTokens();
  if (!refresh) throw new Error("No refresh token");

  const response = await axios.post(`${BASE_URL}/api/token/refresh/`, { refresh });
  setTokens({ access: response.data.access });
  return response.data.access;
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;

    if (response?.status === 401 && !config._retried) {
      config._retried = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const access = await refreshPromise;
        config.headers.Authorization = `Bearer ${access}`;
        return client(config);
      } catch {
        clearTokens();
        window.dispatchEvent(new Event("fakerni:logout"));
      }
    }

    return Promise.reject(error);
  }
);

export default client;
