// src/hooks/useCurrentUser.js
import { useEffect, useState, useMemo } from 'react';
import api from '../api/axios';

const useCurrentUser = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchUser = async () => {
      try {
        const res = await api.get('/api/users/me', {
          signal: controller.signal,
        });
        setUser(res.data);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('❌ Failed to fetch current user:', err);
          setError(err?.response?.data?.message || 'Failed to load user');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchUser();

    return () => {
      controller.abort();
    };
  }, []);

  // Optional: memoize the result to avoid unnecessary re-renders
  return useMemo(() => ({ user, loading, error }), [user, loading, error]);
};

export default useCurrentUser;
