import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// UI messages share the existing i18next language and fallback rules. Literal
// message keys allow punctuation without interpreting it as a nested key path.
// Do not pass user-entered descriptions or names through this helper.
export default function useUiTranslation() {
  const { t } = useTranslation('interface');
  return useCallback((message, options = {}) => t(message, {
    ...options,
    defaultValue: message,
    keySeparator: false,
    nsSeparator: false,
  }), [t]);
}
