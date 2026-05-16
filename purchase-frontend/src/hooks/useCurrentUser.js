import { useCallback, useMemo } from 'react';
import { fetchCurrentUser } from '../api/currentUser';
import { useDataQuery } from './useDataQuery';

const useCurrentUser = () => {
  const fetchUser = useCallback(async () => {
    const res = await fetchCurrentUser();
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