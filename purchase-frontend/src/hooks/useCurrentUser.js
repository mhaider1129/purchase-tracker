import { useCallback, useMemo } from 'react';
import api from '../api/axios';
import { useDataQuery } from './useDataQuery';

const useCurrentUser = () => {
  const fetchUser = useCallback(async () => {
    const res = await api.get('/api/users/me');
    return res.data;
  }, []);

  const { data, error, isLoading, isFetching, refetch } = useDataQuery({
    queryKey: ['current-user'],
    queryFn: fetchUser,
    staleTime: 2 * 60_000,
    retry: 0,
  });

  return useMemo(
    () => ({
      user: data || null,
      loading: isLoading || isFetching,
      error: error?.response?.data?.message || error || null,
      refreshUser: refetch,
    }),
    [data, error, isFetching, isLoading, refetch],
  );
};

export default useCurrentUser;