import React from "react";
import { useTranslation } from "react-i18next";

const LanguageSwitcher = ({ className = "" }) => {
  const { i18n, t } = useTranslation();

  const currentLang = i18n.language?.startsWith("ar") ? "ar" : "en";

  const handleChange = (event) => {
    const lang = event.target.value;
    if (!lang || lang === currentLang) return;

    i18n.changeLanguage(lang);
  };

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <label
        htmlFor="language-switcher"
        className="text-gray-600 dark:text-gray-300"
      >
        {t("common.language")}
      </label>
      <select
        id="language-switcher"
        value={currentLang}
        onChange={handleChange}
        className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="en">English</option>
        <option value="ar">العربية</option>
      </select>
    </div>
  );
};

export default LanguageSwitcher;
