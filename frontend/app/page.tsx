"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import api, { LanguageOption } from "@/lib/api";
import { useTranslation } from "@/lib/i18n-context";

export default function Home() {
  const { t, locale, setLocale } = useTranslation();
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([
    { code: "en", label: "English", direction: "ltr" },
    { code: "de", label: "Deutsch (German)", direction: "ltr" },
    { code: "fr", label: "Français (French)", direction: "ltr" },
    { code: "es", label: "Español (Spanish)", direction: "ltr" },
  ]);

  useEffect(() => {
    // Load available languages from API
    api
      .listLanguages()
      .then((list) => setLanguageOptions(list))
      .catch((error) => {
        console.error("Failed to load languages", error);
      });
  }, []);

  const handleLanguageChange = (code: string) => {
    setLocale(code);
  };
  const features = [
    {
      title: t("home.uploadDocuments"),
      description: t("home.uploadDescription"),
      icon: "📄",
    },
    {
      title: t("home.addJobs"),
      description: t("home.addJobsDescription"),
      icon: "🔍",
    },
    {
      title: t("home.trackApplications"),
      description: t("home.trackDescription"),
      icon: "📊",
    },
  ];

  const languages = [
    "English",
    "Deutsch",
    "Français",
    "Italiano",
    "Español",
    "Português",
    "Svizzeru / Schweizerdeutsch",
    "Rumantsch",
    "Albanian",
    "Croatian",
    "Serbian",
    "Bosnian",
    "Bulgarian",
    "Romanian",
    "Russian",
    "Ukrainian",
    "Polish",
    "Turkish",
    "Arabic",
    "Amharic",
    "Tigrinya",
    "Somali",
    "Swahili",
    "Yoruba",
    "Hausa",
    "Filipino (Tagalog)",
    "Thai",
    "Vietnamese",
    "Malay / Indonesian",
    "Hindi",
    "Bengali",
    "Chinese (Simplified)",
    "Chinese (Traditional)",
    "Plus 30+ more"
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="EasyBewerbung" className="w-8 h-8 rounded-lg" />
            <span className="text-xl font-bold">{t("common.appName")}</span>
          </div>
          <div className="flex gap-3 items-center">
            <div className="relative">
              <label className="text-sm text-slate-400 mr-2">{t("common.language")}:</label>
              <select
                value={locale}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {languageOptions.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
            <Button href="/login" variant="outline">
              {t("common.login")}
            </Button>
            <Button href="/register" variant="primary">
              {t("common.getStarted")}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-5xl font-bold leading-tight">
            {t("home.title")}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
              {t("home.titleHighlight")}
            </span>
          </h1>
          <p className="text-xl text-slate-300">
            {t("home.subtitle")}
          </p>
          <p className="text-lg text-emerald-400">
            {t("home.availableLanguages")}
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button href="/register" variant="primary">
              {t("home.startFree")} →
            </Button>
            <Button href="#features" variant="outline">
              {t("home.learnMore")}
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          {t("home.howItWorks")}
        </h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <Card key={index}>
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-slate-400">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Languages Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            {t("home.languageSection")}
          </h2>
          <Card>
            <p className="text-slate-300 text-center mb-6">
              {t("home.languageDescription")}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {languages.map((lang, index) => (
                <span
                  key={index}
                  className="px-3 py-1 rounded-full bg-slate-700 text-sm text-slate-200"
                >
                  {lang}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* Swiss RAV Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <Card className="bg-emerald-900/20 border-emerald-700">
            <h2 className="text-2xl font-bold mb-4 text-emerald-400">
              🇨🇭 {t("home.ravTitle")}
            </h2>
            <p className="text-slate-300">
              {t("home.ravDescription")}
            </p>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-4xl font-bold">
            {t("home.ctaTitle")}
          </h2>
          <p className="text-xl text-slate-300">
            {t("home.ctaSubtitle")}
          </p>
          <Button href="/register" variant="primary" className="text-lg">
            {t("home.createAccount")} →
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="container mx-auto px-6 text-center text-slate-400">
          <p>© 2025 {t("common.appName")}. {t("home.footer")}</p>
        </div>
      </footer>
    </div>
  );
}
