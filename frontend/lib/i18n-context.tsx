"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

import amTranslations from "./translations/am.json";
import arTranslations from "./translations/ar.json";
import bgTranslations from "./translations/bg.json";
import bmTranslations from "./translations/bm.json";
import bnTranslations from "./translations/bn.json";
import bsTranslations from "./translations/bs.json";
import csTranslations from "./translations/cs.json";
import deCHTranslations from "./translations/de-CH.json";
import deTranslations from "./translations/de.json";
import elTranslations from "./translations/el.json";
import enTranslations from "./translations/en.json";
import esTranslations from "./translations/es.json";
import faTranslations from "./translations/fa.json";
import filTranslations from "./translations/fil.json";
import frTranslations from "./translations/fr.json";
import gswTranslations from "./translations/gsw.json";
import haTranslations from "./translations/ha.json";
import heTranslations from "./translations/he.json";
import hiTranslations from "./translations/hi.json";
import hrTranslations from "./translations/hr.json";
import huTranslations from "./translations/hu.json";
import igTranslations from "./translations/ig.json";
import itTranslations from "./translations/it.json";
import jaTranslations from "./translations/ja.json";
import knTranslations from "./translations/kn.json";
import koTranslations from "./translations/ko.json";
import kuTranslations from "./translations/ku.json";
import lnTranslations from "./translations/ln.json";
import mlTranslations from "./translations/ml.json";
import msTranslations from "./translations/ms.json";
import neTranslations from "./translations/ne.json";
import paTranslations from "./translations/pa.json";
import plTranslations from "./translations/pl.json";
import ptTranslations from "./translations/pt.json";
import rmTranslations from "./translations/rm.json";
import rnTranslations from "./translations/rn.json";
import roTranslations from "./translations/ro.json";
import ruTranslations from "./translations/ru.json";
import rwTranslations from "./translations/rw.json";
import siTranslations from "./translations/si.json";
import skTranslations from "./translations/sk.json";
import slTranslations from "./translations/sl.json";
import snTranslations from "./translations/sn.json";
import soTranslations from "./translations/so.json";
import sqTranslations from "./translations/sq.json";
import srTranslations from "./translations/sr.json";
import swTranslations from "./translations/sw.json";
import taTranslations from "./translations/ta.json";
import teTranslations from "./translations/te.json";
import thTranslations from "./translations/th.json";
import tiTranslations from "./translations/ti.json";
import trTranslations from "./translations/tr.json";
import ukTranslations from "./translations/uk.json";
import urTranslations from "./translations/ur.json";
import viTranslations from "./translations/vi.json";
import woTranslations from "./translations/wo.json";
import xhTranslations from "./translations/xh.json";
import yoTranslations from "./translations/yo.json";
import zhCNTranslations from "./translations/zh-CN.json";
import zhHansTranslations from "./translations/zh-Hans.json";
import zhHantTranslations from "./translations/zh-Hant.json";
import zhTWTranslations from "./translations/zh-TW.json";
import zuTranslations from "./translations/zu.json";

type Translations = typeof enTranslations;

// Use any to allow translation files with slightly different structures
// The fallback mechanism will handle missing keys
const translations: Record<string, any> = {
  en: enTranslations,
  de: deTranslations,
  "de-CH": deCHTranslations,
  fr: frTranslations,
  it: itTranslations,
  es: esTranslations,
  pt: ptTranslations,
  gsw: gswTranslations,
  rm: rmTranslations,
  sq: sqTranslations,
  bs: bsTranslations,
  bg: bgTranslations,
  hr: hrTranslations,
  sr: srTranslations,
  sl: slTranslations,
  ro: roTranslations,
  ru: ruTranslations,
  uk: ukTranslations,
  pl: plTranslations,
  cs: csTranslations,
  sk: skTranslations,
  hu: huTranslations,
  tr: trTranslations,
  ar: arTranslations,
  he: heTranslations,
  fa: faTranslations,
  ku: kuTranslations,
  el: elTranslations,
  fil: filTranslations,
  th: thTranslations,
  vi: viTranslations,
  ms: msTranslations,
  "zh-Hans": zhHansTranslations,
  "zh-Hant": zhHantTranslations,
  "zh-CN": zhCNTranslations,
  "zh-TW": zhTWTranslations,
  ja: jaTranslations,
  ko: koTranslations,
  hi: hiTranslations,
  ur: urTranslations,
  bn: bnTranslations,
  pa: paTranslations,
  ta: taTranslations,
  te: teTranslations,
  kn: knTranslations,
  ml: mlTranslations,
  si: siTranslations,
  ne: neTranslations,
  am: amTranslations,
  ti: tiTranslations,
  so: soTranslations,
  sw: swTranslations,
  yo: yoTranslations,
  ig: igTranslations,
  ha: haTranslations,
  wo: woTranslations,
  bm: bmTranslations,
  rw: rwTranslations,
  rn: rnTranslations,
  ln: lnTranslations,
  zu: zuTranslations,
  xh: xhTranslations,
  sn: snTranslations,
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
    if (saved) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = (newLocale: string) => {
    // Allow any locale code; fall back to English strings if we don't have translations yet
    setLocaleState(newLocale);
    localStorage.setItem("preferred_language", newLocale);
  };

  const t = (key: string): string => {
    const keys = key.split(".");
    // Use English as a safe fallback for unknown locales
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
