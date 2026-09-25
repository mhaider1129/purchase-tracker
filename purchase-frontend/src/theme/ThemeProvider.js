import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const ThemeContext = createContext(null);

export const themes = {
  light: "light",
  dark: "dark",
  highContrast: "highContrast",
};

const themeOrder = [themes.light, themes.dark, themes.highContrast];

const getPreferredTheme = () => {
  const storedTheme = localStorage.getItem("theme");
  if (themeOrder.includes(storedTheme)) return storedTheme;

  const legacyDarkMode = localStorage.getItem("darkMode");
  if (legacyDarkMode === "true") return themes.dark;
  if (legacyDarkMode === "false") return themes.light;

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? themes.dark
    : themes.light;
};

const applyTheme = (nextTheme) => {
  const root = document.documentElement;
  root.classList.remove("dark", "high-contrast");
  root.dataset.theme = nextTheme;
  root.style.colorScheme = nextTheme === themes.light ? "light" : "dark";

  if (nextTheme === themes.dark) {
    root.classList.add("dark");
  }

  if (nextTheme === themes.highContrast) {
    root.classList.add("dark", "high-contrast");
  }

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      "content",
      nextTheme === themes.light ? "#f6f8fc" : "#070b14",
    );
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getPreferredTheme);

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

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};