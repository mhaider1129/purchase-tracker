// src/hooks/useAuth.js
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import axios from '../api/axios';

const AuthContext = createContext(null);

const useProvideAuth = () => {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const isTokenExpired = useCallback((candidate) => {
    if (!candidate) return true;
    try {
      const decoded = jwtDecode(candidate);
      const now = Date.now() / 1000;
      return decoded.exp && decoded.exp < now - 5;
    } catch (err) {
      console.warn('⚠️ Invalid token:', err);
      return true;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setIsLoading(false);
    navigate('/login');
  }, [navigate]);

  const fetchUserProfile = useCallback(async (activeToken) => {
    if (!activeToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await axios.get('/api/users/me', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      const profile = res.data || {};
      profile.permissions = Array.isArray(profile.permissions)
        ? profile.permissions
        : [];
      setUser(profile);
    } catch (err) {
      console.error('❌ Failed to fetch user profile:', err);
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  const login = useCallback((newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  }, []);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    if (isTokenExpired(token)) {
      logout();
    } else {
      fetchUserProfile(token);
    }
  }, [token, isTokenExpired, fetchUserProfile, logout]);

  useEffect(() => {
    const handleStorageChange = () => {
      const newToken = localStorage.getItem('token');
      if (!newToken || isTokenExpired(newToken)) {
        logout();
      } else {
        setToken(newToken);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [logout, isTokenExpired]);

  const value = useMemo(() => ({
    token,
    user,
    login,
    logout,
    isAuthenticated: Boolean(token && user),
    isLoading,
  }), [token, user, login, logout, isLoading]);

  return value;
};

export const AuthProvider = ({ children }) => {
  const auth = useProvideAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};