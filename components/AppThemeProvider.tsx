'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';

export type AppTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: AppTheme;
  toggleTheme: () => void;
}

const THEME_KEY = 'civicloop.theme';
const THEME_EVENT = 'civicloop:theme-change';
const ThemeContext = createContext<ThemeContextValue | null>(null);
let themeOverride: AppTheme | null = null;

function getSavedTheme(): AppTheme {
  if (themeOverride !== null) return themeOverride;
  try {
    return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch (error) {
    console.warn('Civicloop: unable to read the saved theme preference', error);
    return 'light';
  }
}

function getServerTheme(): AppTheme {
  return 'light';
}

function subscribeToTheme(callback: () => void): () => void {
  const onStorage = () => {
    themeOverride = null;
    callback();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(THEME_EVENT, callback);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(THEME_EVENT, callback);
  };
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeToTheme, getSavedTheme, getServerTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const next = getSavedTheme() === 'dark' ? 'light' : 'dark';
    themeOverride = next;
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch (error) {
      console.warn('Civicloop: unable to save the theme preference', error);
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppTheme must be used inside AppThemeProvider');
  return context;
}
