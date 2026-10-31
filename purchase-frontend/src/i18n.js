import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ar from "./locales/ar.json";

import interfaceEn from "./locales/interface.en.json";
import interfaceAr from "./locales/interface.ar.json";

const resources = {
  en: { translation: en, interface: interfaceEn },
  ar: { translation: ar, interface: interfaceAr },
};

const savedLang = localStorage.getItem("lang") || "en";

i18n.use(initReactI18next).init({
  resources,
  lng: savedLang,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
