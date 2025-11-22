import { useState, useEffect } from "react";

const useDarkMode = () => {
  const [enabled, setEnabled] = useState(() => {
    const stored = localStorage.getItem("darkMode");
    return stored ? stored === "true" : false;
  });

  useEffect(() => {
    const body = document.body;

    if (enabled) {
      document.documentElement.classList.add("dark");
      body.style.backgroundColor = "#111827";
      body.style.color = "#f3f4f6";
    } else {
      document.documentElement.classList.remove("dark");
      body.style.backgroundColor = "#f3f4f6";
      body.style.color = "#111827";
    }
    localStorage.setItem("darkMode", enabled);
  }, [enabled]);

  const toggle = () => setEnabled((prev) => !prev);

  return [enabled, toggle];
};

export default useDarkMode;
