import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api, setAuthToken } from '../api/client';
import { useTheme } from './ThemeContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { setTheme } = useTheme();

  // Sync theme from user profile when available
  const applyUser = useCallback(
    (userData, token) => {
      setUser(userData);
      if (token) {
        // Store token in memory + sessionStorage so it survives page refresh
        setAuthToken(token);
        try { sessionStorage.setItem('medsync_token', token); } catch {}
      }
      if (userData?.theme) {
        setTheme(userData.theme);
      }
    },
    [setTheme]
  );

  // Restore session on initial app load — try token from sessionStorage first,
  // then fall back to httpOnly cookie (works in same-origin / dev)
  const refreshUser = useCallback(async () => {
    try {
      // Restore in-memory token from sessionStorage across page refreshes
      try {
        const stored = sessionStorage.getItem('medsync_token');
        if (stored) setAuthToken(stored);
      } catch {}

      const data = await api.get('/auth/me');
      setUser(data.user);
      if (data.user?.theme) setTheme(data.user.theme);
    } catch {
      setUser(null);
      try { sessionStorage.removeItem('medsync_token'); } catch {}
      setAuthToken(null);
    } finally {
      setLoading(false);
    }
  }, [setTheme]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    applyUser(data.user, data.token);
    return data.user;
  };

  const register = async (formData) => {
    const data = await api.post('/auth/register', formData);
    applyUser(data.user, data.token);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      setAuthToken(null);
      try { sessionStorage.removeItem('medsync_token'); } catch {}
    }
  };

  const updateUser = (updatedUser) => {
    applyUser(updatedUser, null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        login,
        register,
        logout,
        refreshUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}
