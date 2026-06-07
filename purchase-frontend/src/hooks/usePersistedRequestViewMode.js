import { useEffect, useState } from 'react';

export const REQUEST_VIEW_MODES = {
  detailed: 'detailed',
  summary: 'summary',
};

const isValidRequestViewMode = (value) => Object.values(REQUEST_VIEW_MODES).includes(value);

const readInitialViewMode = (storageKey, defaultMode) => {
  if (typeof window === 'undefined') return defaultMode;

  const storedMode = window.localStorage.getItem(storageKey);
  return isValidRequestViewMode(storedMode) ? storedMode : defaultMode;
};

const usePersistedRequestViewMode = (
  storageKey,
  defaultMode = REQUEST_VIEW_MODES.detailed,
) => {
  const safeDefaultMode = isValidRequestViewMode(defaultMode)
    ? defaultMode
    : REQUEST_VIEW_MODES.detailed;
  const [requestViewMode, setRequestViewMode] = useState(() =>
    readInitialViewMode(storageKey, safeDefaultMode),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, requestViewMode);
  }, [requestViewMode, storageKey]);

  const updateRequestViewMode = (nextMode) => {
    setRequestViewMode(
      isValidRequestViewMode(nextMode) ? nextMode : REQUEST_VIEW_MODES.detailed,
    );
  };

  return [requestViewMode, updateRequestViewMode];
};

export default usePersistedRequestViewMode;