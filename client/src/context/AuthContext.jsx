import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { useTheme } from './ThemeContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { setTheme } = useTheme();

  // Sync theme from user profile when available
  const applyUser = useCallback(
    (userData) => {
      setUser(userData);
      if (userData?.theme) {
        setTheme(userData.theme);
      }
    },
    [setTheme]
  );

  // Restore session on initial app load via httpOnly cookie
  const refreshUser = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      applyUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [applyUser]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    applyUser(data.user);
    return data.user;
  };

  const register = async (formData) => {
    const data = await api.post('/auth/register', formData);
    applyUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  };

  const updateUser = (updatedUser) => {
    applyUser(updatedUser);
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
