import { useCallback } from "react";
import { useTranslation } from "react-i18next";

const usePageTranslation = (namespace) => {
  const { t } = useTranslation();

  return useCallback(
    (key, defaultValueOrOptions, options = {}) => {
      const usingOptionsAsSecondArg =
        defaultValueOrOptions !== null && typeof defaultValueOrOptions === 'object';

      const resolvedOptions = usingOptionsAsSecondArg
        ? defaultValueOrOptions
        : options;
      const resolvedDefaultValue = usingOptionsAsSecondArg
        ? defaultValueOrOptions.defaultValue ?? key
        : defaultValueOrOptions ?? key;

      return t(`${namespace}.${key}`, {
        ...resolvedOptions,
        defaultValue: resolvedDefaultValue,
      });
    },
    [namespace, t],
  );
};

export default usePageTranslation;