'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { translate, type AppLanguage } from '@/lib/i18n';

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}

const LANGUAGE_KEY = 'civicloop.language';
const LANGUAGE_EVENT = 'civicloop:language-change';
const LanguageContext = createContext<LanguageContextValue | null>(null);
let languageOverride: AppLanguage | null = null;

function getSavedLanguage(): AppLanguage {
  if (languageOverride) return languageOverride;
  try {
    const saved = window.localStorage.getItem(LANGUAGE_KEY);
    return saved === 'en' || saved === 'kn' || saved === 'hi' ? saved : 'en';
  } catch (error) {
    console.warn('Civicloop: unable to read the saved language preference', error);
    return 'en';
  }
}

function getServerLanguage(): AppLanguage {
  return 'en';
}

function subscribeToLanguage(callback: () => void): () => void {
  const onStorage = () => {
    languageOverride = null;
    callback();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(LANGUAGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(LANGUAGE_EVENT, callback);
  };
}

export function AppLanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(subscribeToLanguage, getSavedLanguage, getServerLanguage);

  useEffect(() => {
    document.documentElement.lang = language === 'kn' ? 'kn-IN' : language === 'hi' ? 'hi-IN' : 'en';
  }, [language]);

  const setLanguage = useCallback((next: AppLanguage) => {
    languageOverride = next;
    try {
      window.localStorage.setItem(LANGUAGE_KEY, next);
    } catch (error) {
      console.warn('Civicloop: unable to save the language preference', error);
    }
    window.dispatchEvent(new Event(LANGUAGE_EVENT));
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useAppLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useAppLanguage must be used inside AppLanguageProvider');
  return context;
}

export function useTranslate(): (text: string) => string {
  const { language } = useAppLanguage();
  return useCallback((text: string) => translate(language, text), [language]);
}
