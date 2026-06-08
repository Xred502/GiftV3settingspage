import { useState, useEffect } from 'react';

const STORAGE_KEY = 'settings-dark-mode';

export function useDarkMode() {
  const [isDark, setIsDark] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'true'
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem(STORAGE_KEY, String(isDark));
  }, [isDark]);

  return { isDark, toggle: () => setIsDark((d) => !d) };
}
