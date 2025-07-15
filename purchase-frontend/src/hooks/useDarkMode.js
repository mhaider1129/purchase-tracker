import { useState, useEffect } from 'react';

const useDarkMode = () => {
  const [enabled, setEnabled] = useState(() => {
    const stored = localStorage.getItem('darkMode');
    return stored ? stored === 'true' : false;
  });

  useEffect(() => {
    if (enabled) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', enabled);
  }, [enabled]);

  const toggle = () => setEnabled((prev) => !prev);

  return [enabled, toggle];
};

export default useDarkMode;