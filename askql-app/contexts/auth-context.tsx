"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser } from '@/lib/api';

interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setToken: (token: string | null) => void;
  login: (token: string) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      setTokenState(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  // Fetch user info when token changes
  useEffect(() => {
    if (token) {
      fetchUserInfo(token);
    } else {
      setUser(null);
      setIsLoading(false);
    }
  }, [token]);

  const fetchUserInfo = async (authToken: string) => {
    try {
      setIsLoading(true);
      const userInfo = await getCurrentUser(authToken);
      setUser(userInfo);
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      // Clear invalid token
      localStorage.removeItem('auth_token');
      setTokenState(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const setToken = (newToken: string | null) => {
    if (newToken) {
      localStorage.setItem('auth_token', newToken);
    } else {
      localStorage.removeItem('auth_token');
    }
    setTokenState(newToken);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setTokenState(null);
    setUser(null);
    // Redirect to login page
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const login = (newToken: string) => {
    setToken(newToken);
  };

  const refreshUser = async () => {
    if (token) {
      await fetchUserInfo(token);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, setToken, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
