import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

export const themes = {
  light: "light",
  dark: "dark",
  highContrast: "highContrast",
};

const themeOrder = [themes.light, themes.dark, themes.highContrast];

const applyTheme = (nextTheme) => {
  const root = document.documentElement;
  root.classList.remove("dark", "high-contrast");

  if (nextTheme === themes.dark) {
    root.classList.add("dark");
  }

  if (nextTheme === themes.highContrast) {
    root.classList.add("dark", "high-contrast");
  }
};

export const ThemeProvider = ({ children }) => {
  const storedTheme = localStorage.getItem("theme");
  const initialTheme = themeOrder.includes(storedTheme) ? storedTheme : themes.light;
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("theme", theme);
    localStorage.setItem("darkMode", String(theme !== themes.light));
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      themes,
      isDarkMode: theme !== themes.light,
      setTheme,
      cycleTheme: () => {
        const currentIndex = themeOrder.indexOf(theme);
        const nextTheme = themeOrder[(currentIndex + 1) % themeOrder.length];
        setTheme(nextTheme);
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};