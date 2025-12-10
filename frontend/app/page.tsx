"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import api, { LanguageOption } from "@/lib/api";
import { useTranslation } from "@/lib/i18n-context";
import { useTheme } from "@/lib/theme-context";

export default function Home() {
  const { t, locale, setLocale } = useTranslation();
  const { theme, toggleTheme } = useTheme();
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
    <div className="page-shell min-h-screen">
      {/* Header */}
      <header className="border-b border-muted backdrop-blur nav-surface">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
            <img src="/logo.png" alt="EasyBewerbung" className="w-8 h-8 rounded-lg flex-shrink-0" />
            <span className="text-lg sm:text-xl font-bold whitespace-nowrap">{t("common.appName")}</span>
          </div>
          <div className="flex gap-1.5 sm:gap-2 md:gap-3 items-center flex-shrink-0 min-w-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="btn-base btn-secondary flex items-center gap-1 sm:gap-2 px-2 sm:px-4 flex-shrink-0"
              aria-pressed={theme === "light"}
            >
              <span aria-hidden>{theme === "light" ? "🌙" : "☀️"}</span>
              <span className="text-sm hidden md:inline">
                {theme === "light" ? t("common.darkMode") : t("common.lightMode")}
              </span>
            </button>
            {/* Language selector - compact on mobile, full on desktop */}
            <div className="relative flex items-center flex-shrink-0 min-w-0">
              <label className="text-sm text-muted mr-2 hidden lg:inline">{t("common.language")}:</label>
              <select
                value={locale}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="px-2 sm:px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 max-w-full"
                style={{
                  background: "var(--card-background)",
                  color: "var(--foreground)",
                  borderColor: "var(--border)",
                  boxShadow: "none",
                  minWidth: "0",
                }}
                aria-label={t("common.language")}
              >
                {languageOptions.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
            <Button href="/login" variant="outline" className="flex-shrink-0 px-3 py-2 text-sm sm:px-4 sm:text-base whitespace-nowrap">
              {t("common.login")}
            </Button>
            <Button href="/register" variant="primary" className="flex-shrink-0 px-3 py-2 text-sm sm:px-4 sm:text-base whitespace-nowrap">
              {t("common.getStarted")}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight break-words">
            {t("home.title")}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
              {t("home.titleHighlight")}
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-muted break-words">
            {t("home.subtitle")}
          </p>
          <p className="text-base sm:text-lg text-success break-words">
            {t("home.availableLanguages")}
          </p>
          <div className="flex flex-wrap gap-4 justify-center pt-4">
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
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12 break-words">
          {t("home.howItWorks")}
        </h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <Card key={index}>
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 break-words">{feature.title}</h3>
              <p className="text-muted break-words">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Languages Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 break-words">
            {t("home.languageSection")}
          </h2>
          <Card>
            <p className="text-muted text-center mb-6 break-words">
              {t("home.languageDescription")}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {languages.map((lang, index) => (
                <span
                  key={index}
                  className="chip px-3 py-1 rounded-full text-sm break-words"
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
          <Card className="border-2" style={{ borderColor: "var(--success)" }}>
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-success break-words">
              🇨🇭 {t("home.ravTitle")}
            </h2>
            <p className="text-muted break-words">
              {t("home.ravDescription")}
            </p>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold break-words">
            {t("home.ctaTitle")}
          </h2>
          <p className="text-lg sm:text-xl text-muted break-words">
            {t("home.ctaSubtitle")}
          </p>
          <Button href="/register" variant="primary" className="text-base sm:text-lg">
            {t("home.createAccount")} →
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-muted py-8 text-muted">
        <div className="container mx-auto px-6 text-center">
          <p className="break-words">© 2025 {t("common.appName")}. {t("home.footer")}</p>
        </div>
      </footer>
    </div>
  );
}
