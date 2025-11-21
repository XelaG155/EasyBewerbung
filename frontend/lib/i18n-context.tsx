"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

import enTranslations from "./translations/en.json";
import deTranslations from "./translations/de.json";
import esTranslations from "./translations/es.json";
import frTranslations from "./translations/fr.json";

type Translations = typeof enTranslations;

const translations: Record<string, Translations> = {
  en: enTranslations,
  de: deTranslations,
  es: esTranslations,
  fr: frTranslations,
};

interface I18nContextType {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState("en");

  useEffect(() => {
    // Load saved language from localStorage
    const saved = localStorage.getItem("preferred_language");
    if (saved && translations[saved]) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = (newLocale: string) => {
    if (translations[newLocale]) {
      setLocaleState(newLocale);
      localStorage.setItem("preferred_language", newLocale);
    }
  };

  const t = (key: string): string => {
    const keys = key.split(".");
    let value: any = translations[locale] || translations.en;

    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        // Fallback to English if translation not found
        value = translations.en;
        for (const fk of keys) {
          value = value?.[fk];
          if (value === undefined) {
            return key; // Return key if not found even in English
          }
        }
        break;
      }
    }

    return typeof value === "string" ? value : key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return context;
}
