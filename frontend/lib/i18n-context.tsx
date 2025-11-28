"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

import enTranslations from "./translations/en.json";
import deTranslations from "./translations/de.json";
import esTranslations from "./translations/es.json";
import frTranslations from "./translations/fr.json";
import amTranslations from "./translations/am.json";
import arTranslations from "./translations/ar.json";
import bgTranslations from "./translations/bg.json";
import bnTranslations from "./translations/bn.json";
import bsTranslations from "./translations/bs.json";
import csTranslations from "./translations/cs.json";
import deCHTranslations from "./translations/de-CH.json";
import elTranslations from "./translations/el.json";
import faTranslations from "./translations/fa.json";
import filTranslations from "./translations/fil.json";
import heTranslations from "./translations/he.json";
import hiTranslations from "./translations/hi.json";
import hrTranslations from "./translations/hr.json";
import huTranslations from "./translations/hu.json";
import itTranslations from "./translations/it.json";
import jaTranslations from "./translations/ja.json";
import knTranslations from "./translations/kn.json";
import koTranslations from "./translations/ko.json";
import kuTranslations from "./translations/ku.json";
import mlTranslations from "./translations/ml.json";
import msTranslations from "./translations/ms.json";
import neTranslations from "./translations/ne.json";
import paTranslations from "./translations/pa.json";
import plTranslations from "./translations/pl.json";
import ptTranslations from "./translations/pt.json";
import roTranslations from "./translations/ro.json";
import ruTranslations from "./translations/ru.json";
import siTranslations from "./translations/si.json";
import skTranslations from "./translations/sk.json";
import slTranslations from "./translations/sl.json";
import soTranslations from "./translations/so.json";
import sqTranslations from "./translations/sq.json";
import srTranslations from "./translations/sr.json";
import taTranslations from "./translations/ta.json";
import teTranslations from "./translations/te.json";
import thTranslations from "./translations/th.json";
import tiTranslations from "./translations/ti.json";
import trTranslations from "./translations/tr.json";
import ukTranslations from "./translations/uk.json";
import urTranslations from "./translations/ur.json";
import viTranslations from "./translations/vi.json";
import zhCNTranslations from "./translations/zh-CN.json";
import zhTWTranslations from "./translations/zh-TW.json";

type Translations = typeof enTranslations;

// Use any to allow translation files with slightly different structures
// The fallback mechanism will handle missing keys
const translations: Record<string, any> = {
  en: enTranslations,
  de: deTranslations,
  es: esTranslations,
  fr: frTranslations,
  am: amTranslations,
  ar: arTranslations,
  bg: bgTranslations,
  bn: bnTranslations,
  bs: bsTranslations,
  cs: csTranslations,
  "de-CH": deCHTranslations,
  el: elTranslations,
  fa: faTranslations,
  fil: filTranslations,
  he: heTranslations,
  hi: hiTranslations,
  hr: hrTranslations,
  hu: huTranslations,
  it: itTranslations,
  ja: jaTranslations,
  kn: knTranslations,
  ko: koTranslations,
  ku: kuTranslations,
  ml: mlTranslations,
  ms: msTranslations,
  ne: neTranslations,
  pa: paTranslations,
  pl: plTranslations,
  pt: ptTranslations,
  ro: roTranslations,
  ru: ruTranslations,
  si: siTranslations,
  sk: skTranslations,
  sl: slTranslations,
  so: soTranslations,
  sq: sqTranslations,
  sr: srTranslations,
  ta: taTranslations,
  te: teTranslations,
  th: thTranslations,
  ti: tiTranslations,
  tr: trTranslations,
  uk: ukTranslations,
  ur: urTranslations,
  vi: viTranslations,
  "zh-CN": zhCNTranslations,
  "zh-TW": zhTWTranslations,
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
