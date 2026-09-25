import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import "./i18n";
import i18n from "./i18n";
import { I18nextProvider } from "react-i18next";
import { ThemeProvider } from "./theme/ThemeProvider";

const storedTheme = localStorage.getItem("theme");
const storedDark = localStorage.getItem("darkMode");
const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
if (
  storedTheme === "dark" ||
  storedTheme === "highContrast" ||
  (!storedTheme && storedDark === "true") ||
  (!storedTheme && storedDark === null && prefersDark)
) {
  document.documentElement.classList.add("dark");
}
if (storedTheme === "highContrast") {
  document.documentElement.classList.add("high-contrast");
}

const root = ReactDOM.createRoot(document.getElementById("root"));

i18n.on("languageChanged", (lng) => {
  document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
  localStorage.setItem("lang", lng);
});

document.documentElement.dir = i18n.language === "ar" ? "rtl" : "ltr";

root.render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </I18nextProvider>
  </React.StrictMode>,
);