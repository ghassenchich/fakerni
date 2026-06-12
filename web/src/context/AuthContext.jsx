import { createContext, useContext, useEffect, useState } from "react";
import * as authApi from "../api/auth";
import * as usersApi from "../api/users";
import { getTokens, setTokens, clearTokens } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refreshProfile() {
    const response = await usersApi.getProfile();
    setUser(response.data);
    return response.data;
  }

  useEffect(() => {
    const { access } = getTokens();

    if (!access) {
      setLoading(false);
      return;
    }

    refreshProfile()
      .catch(() => {
        clearTokens();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleLogout() {
      setUser(null);
    }
    window.addEventListener("fakerni:logout", handleLogout);
    return () => window.removeEventListener("fakerni:logout", handleLogout);
  }, []);

  async function login(email, password) {
    const response = await authApi.login(email, password);
    setTokens(response.data);
    await refreshProfile();
  }

  async function register(email, password) {
    await authApi.register(email, password);
    await login(email, password);
  }

  function logout() {
    clearTokens();
    setUser(null);
  }

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
