import { useTranslation } from "react-i18next";
import en from "../../locales/en.json";
import ar from "../../locales/ar.json";

// Keep these shared controls readable even when a provider has incomplete resources.
export default function useWorkspaceTranslation() {
  const { t, i18n } = useTranslation();
  const language = (i18n.resolvedLanguage || i18n.language || "en").split(
    "-",
  )[0];
  const defaults =
    language === "ar" ? ar.operationalWorkspace : en.operationalWorkspace;

  return (key, options = {}) => {
    const name = key.replace(/^operationalWorkspace\./, "");
    const plural =
      options.count !== undefined
        ? new Intl.PluralRules(language === "ar" ? "ar" : "en").select(
            options.count,
          )
        : null;
    return t(key, {
      ...options,
      defaultValue: defaults[plural ? `${name}_${plural}` : name],
    });
  };
}
