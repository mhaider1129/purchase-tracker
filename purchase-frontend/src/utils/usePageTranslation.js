import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const usePageTranslation = (namespace) => {
  const { t } = useTranslation();

  return useCallback(
    (key, defaultValue, options = {}) =>
      t(`${namespace}.${key}`, {
        defaultValue: defaultValue ?? key,
        ...options,
      }),
    [namespace, t]
  );
};

export default usePageTranslation;