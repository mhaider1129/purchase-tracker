import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import "./i18n";
import i18n from "./i18n";
import { I18nextProvider } from "react-i18next";

const storedDark = localStorage.getItem("darkMode");
if (storedDark === "true") {
  document.documentElement.classList.add("dark");
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
      <App />
    </I18nextProvider>
  </React.StrictMode>,
);
