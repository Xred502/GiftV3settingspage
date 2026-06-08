import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type BackofficeTheme =
  | 'modern'
  | 'microdeb-dark'
  | 'warm'
  | 'water';

export const themeOptions: Array<{
  key: BackofficeTheme;
  label: string;
  description: string;
}> = [
  {
    key: 'modern',
    label: 'Modern',
    description: 'Ren produktkÃ¤nsla med glas, gradientskikt och skarpa datahierarkier.',
  },
  {
    key: 'microdeb-dark',
    label: 'Microdeb Dark',
    description: 'M\u00f6rk Microdeb-profil med djupbl\u00e5 paneler och klar gr\u00f6n accent.',
  },
  {
    key: 'warm',
    label: 'Varmt',
    description: 'Varma toner med sand, terrakotta och mjuk hotellkÃ¤nsla.',
  },
  {
    key: 'water',
    label: 'Neonr\u00f6k',
    description: 'M\u00f6rk neonmix med rosa och cyan samt dimmig nattk\u00e4nsla.',
  },
];

function isBackofficeTheme(value: unknown): value is BackofficeTheme {
  return themeOptions.some((option) => option.key === value);
}

interface BackofficeThemeContextValue {
  theme: BackofficeTheme;
  activeTheme: (typeof themeOptions)[number];
  setTheme: (theme: BackofficeTheme) => void;
}

const BackofficeThemeContext = createContext<BackofficeThemeContextValue | undefined>(undefined);

export function BackofficeThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<BackofficeTheme>(() => {
    if (typeof window === 'undefined') return 'modern';
    const storedTheme = window.localStorage.getItem('backoffice-theme');
    return isBackofficeTheme(storedTheme) ? storedTheme : 'modern';
  });

  useEffect(() => {
    document.documentElement.dataset.backofficeTheme = theme;
    document.body.dataset.backofficeTheme = theme;
    window.localStorage.setItem('backoffice-theme', theme);

    return () => {
      delete document.documentElement.dataset.backofficeTheme;
      delete document.body.dataset.backofficeTheme;
    };
  }, [theme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'backoffice-theme') return;
      if (!isBackofficeTheme(event.newValue)) return;
      setTheme(event.newValue);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const incomingTheme = event.data?.type === 'backoffice-theme' ? event.data.theme : null;
      if (!isBackofficeTheme(incomingTheme)) return;
      setTheme(incomingTheme);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const value = useMemo(
    () => ({
      theme,
      activeTheme: themeOptions.find((option) => option.key === theme) || themeOptions[0],
      setTheme,
    }),
    [theme]
  );

  return (
    <BackofficeThemeContext.Provider value={value}>
      {children}
    </BackofficeThemeContext.Provider>
  );
}

export function useBackofficeTheme() {
  const context = useContext(BackofficeThemeContext);
  if (!context) {
    throw new Error('useBackofficeTheme must be used within BackofficeThemeProvider');
  }
  return context;
}

