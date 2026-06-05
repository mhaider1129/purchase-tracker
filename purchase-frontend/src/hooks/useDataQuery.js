import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const queryCache = new Map();
const inflightRequests = new Map();

const defaultRetryDelay = (attempt) => Math.min(1000 * 2 ** (attempt - 1), 5000);

const serializeKey = (queryKey) =>
  Array.isArray(queryKey) ? JSON.stringify(queryKey) : String(queryKey);

const isStale = (entry, staleTime) => {
  if (!entry) return true;
  if (staleTime === Infinity) return false;
  return Date.now() - entry.updatedAt > staleTime;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const invalidateQuery = (queryKey) => {
  queryCache.delete(serializeKey(queryKey));
};

export const invalidateQueries = (predicate) => {
  for (const key of queryCache.keys()) {
    if (predicate(key)) {
      queryCache.delete(key);
    }
  }
};

export const useDataQuery = ({
  queryKey,
  queryFn,
  enabled = true,
  staleTime = 60_000,
  retry = 1,
  retryDelay = defaultRetryDelay,
}) => {
  const serializedKey = useMemo(() => serializeKey(queryKey), [queryKey]);
  const mountedRef = useRef(true);
  const activeKeyRef = useRef(serializedKey);

  const [state, setState] = useState(() => {
    const cached = queryCache.get(serializedKey);
    if (cached && !isStale(cached, staleTime)) {
      return {
        data: cached.data,
        error: null,
        isLoading: false,
        isFetching: false,
      };
    }

    return {
      data: undefined,
      error: null,
      isLoading: enabled,
      isFetching: false,
    };
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    activeKeyRef.current = serializedKey;
    const cached = queryCache.get(serializedKey);

    if (enabled && cached && !isStale(cached, staleTime)) {
      setState({
        data: cached.data,
        error: null,
        isLoading: false,
        isFetching: false,
      });
      return;
    }

    setState({
      data: undefined,
      error: null,
      isLoading: enabled,
      isFetching: false,
    });
  }, [enabled, serializedKey, staleTime]);

  const execute = useCallback(
    async ({ force = false } = {}) => {
      if (!enabled) {
        return state.data;
      }

      const requestKey = serializedKey;
      const cached = queryCache.get(requestKey);
      if (!force && cached && !isStale(cached, staleTime)) {
        if (mountedRef.current && activeKeyRef.current === requestKey) {
          setState((prev) => ({ ...prev, data: cached.data, isLoading: false }));
        }
        return cached.data;
      }

      const existingRequest = inflightRequests.get(requestKey);
      if (existingRequest) {
        if (mountedRef.current && activeKeyRef.current === requestKey) {
          setState((prev) => ({ ...prev, isFetching: true }));
        }
        const sharedData = await existingRequest;
        if (mountedRef.current && activeKeyRef.current === requestKey) {
          setState({ data: sharedData, error: null, isLoading: false, isFetching: false });
        }
        return sharedData;
      }

      if (mountedRef.current && activeKeyRef.current === requestKey) {
        setState((prev) => ({ ...prev, isLoading: prev.data === undefined, isFetching: true, error: null }));
      }

      const request = (async () => {
        let lastError;
        for (let attempt = 0; attempt <= retry; attempt += 1) {
          try {
            const data = await queryFn();
            queryCache.set(requestKey, { data, updatedAt: Date.now() });
            return data;
          } catch (error) {
            lastError = error;
            if (attempt < retry) {
              await sleep(retryDelay(attempt + 1));
            }
          }
        }
        throw lastError;
      })();

      inflightRequests.set(requestKey, request);

      try {
        const data = await request;
        if (mountedRef.current && activeKeyRef.current === requestKey) {
          setState({ data, error: null, isLoading: false, isFetching: false });
        }
        return data;
      } catch (error) {
        if (mountedRef.current && activeKeyRef.current === requestKey) {
          setState((prev) => ({ ...prev, error, isLoading: false, isFetching: false }));
        }
        throw error;
      } finally {
        inflightRequests.delete(requestKey);
      }
    },
    [enabled, queryFn, retry, retryDelay, serializedKey, staleTime, state.data],
  );

  useEffect(() => {
    if (!enabled) {
      setState((prev) => ({ ...prev, isLoading: false, isFetching: false }));
      return;
    }

    execute().catch(() => {});
  }, [enabled, execute]);

  const refetch = useCallback(() => execute({ force: true }), [execute]);

  return {
    data: state.data,
    error: state.error,
    isLoading: state.isLoading,
    isFetching: state.isFetching,
    refetch,
  };
};