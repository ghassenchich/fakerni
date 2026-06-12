import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { emitLogout } from "./events";

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export const TOKEN_KEYS = {
  access: "fakerni_access",
  refresh: "fakerni_refresh",
};

let tokenCache = { access: null, refresh: null };

export async function loadTokens() {
  const [access, refresh] = await Promise.all([
    AsyncStorage.getItem(TOKEN_KEYS.access),
    AsyncStorage.getItem(TOKEN_KEYS.refresh),
  ]);
  tokenCache = { access, refresh };
  return tokenCache;
}

export function getTokens() {
  return tokenCache;
}

export async function setTokens({ access, refresh }) {
  if (access) {
    tokenCache.access = access;
    await AsyncStorage.setItem(TOKEN_KEYS.access, access);
  }
  if (refresh) {
    tokenCache.refresh = refresh;
    await AsyncStorage.setItem(TOKEN_KEYS.refresh, refresh);
  }
}

export async function clearTokens() {
  tokenCache = { access: null, refresh: null };
  await AsyncStorage.multiRemove([TOKEN_KEYS.access, TOKEN_KEYS.refresh]);
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
  await setTokens({ access: response.data.access });
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
        await clearTokens();
        emitLogout();
      }
    }

    return Promise.reject(error);
  }
);

export default client;
