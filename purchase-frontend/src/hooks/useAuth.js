// src/hooks/useAuth.js
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { jwtDecode } from 'jwt-decode';
import axios from '../api/axios';

export const useAuth = () => {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // 🔐 Token Expiration Checker with 5-second buffer
  const isTokenExpired = useCallback((token) => {
    try {
      const decoded = jwtDecode(token);
      const now = Date.now() / 1000;
      return decoded.exp && decoded.exp < now - 5;
    } catch (err) {
      console.warn('⚠️ Invalid token:', err);
      return true;
    }
  }, []);

  // 🚪 Logout and reset auth state
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    navigate('/login');
  }, [navigate]);

  // 🔑 Login and persist token
  const login = useCallback((newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  }, []);

  // 👤 Fetch user profile from backend
  const fetchUserProfile = useCallback(async (token) => {
    try {
      const res = await axios.get('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(res.data);
    } catch (err) {
      console.error('❌ Failed to fetch user profile:', err);
      logout(); // 🔁 Auto-logout if token is invalid
    }
  }, [logout]);

  // 🌀 Initial load & token validation
  useEffect(() => {
    if (token) {
      if (isTokenExpired(token)) {
        logout();
      } else {
        fetchUserProfile(token);
      }
    }
  }, [token, isTokenExpired, fetchUserProfile, logout]);

  // 🧠 Sync auth across browser tabs
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

  // ✅ Memoized value for auth check
  const isAuthenticated = useMemo(() => !!token && !!user, [token, user]);

  return {
    token,
    user,
    login,
    logout,
    isAuthenticated,
  };
};
