import { createContext, useContext, useEffect, useState } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import * as authApi from "../api/auth";
import * as usersApi from "../api/users";
import { getBiometricEnabled, setBiometricEnabled as persistBiometricEnabled } from "../api/biometric";
import { loadTokens, getTokens, setTokens, clearTokens } from "../api/client";
import { onLogout } from "../api/events";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);

  async function refreshProfile() {
    const response = await usersApi.getProfile();
    setUser(response.data);
    return response.data;
  }

  useEffect(() => {
    (async () => {
      await loadTokens();
      const { access } = getTokens();

      if (!access) {
        setLoading(false);
        return;
      }

      try {
        await refreshProfile();
        const enabled = await getBiometricEnabled();
        setBiometricEnabledState(enabled);
        if (enabled) setLocked(true);
      } catch {
        await clearTokens();
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    return onLogout(() => setUser(null));
  }, []);

  async function login(email, password) {
    const response = await authApi.login(email, password);
    await setTokens(response.data);
    await refreshProfile();
    const enabled = await getBiometricEnabled();
    setBiometricEnabledState(enabled);
  }

  async function register(email, password) {
    await authApi.register(email, password);
    await login(email, password);
  }

  async function logout() {
    await clearTokens();
    setUser(null);
    setLocked(false);
  }

  async function unlock() {
    const result = await LocalAuthentication.authenticateAsync();
    if (result.success) {
      setLocked(false);
    }
    return result.success;
  }

  async function setBiometricEnabled(enabled) {
    await persistBiometricEnabled(enabled);
    setBiometricEnabledState(enabled);
  }

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    locked,
    biometricEnabled,
    login,
    register,
    logout,
    refreshProfile,
    unlock,
    setBiometricEnabled,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
