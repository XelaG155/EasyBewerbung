"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";
import api, { LanguageOption } from "@/lib/api";

const FALLBACK_LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", label: "English", direction: "ltr" },
  { code: "de", label: "Deutsch (German)", direction: "ltr" },
  { code: "fr", label: "Français (French)", direction: "ltr" },
  { code: "es", label: "Español (Spanish)", direction: "ltr" },
  { code: "ar", label: "Arabic", direction: "rtl" },
];

export default function SettingsPage() {
  const { t } = useTranslation();
  const { user, loading: authLoading, logout, refreshUser } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("");
  const [documentationLanguage, setDocumentationLanguage] = useState("");
  // Extended profile fields
  const [employmentStatus, setEmploymentStatus] = useState("");
  const [educationType, setEducationType] = useState("");
  const [additionalProfileContext, setAdditionalProfileContext] = useState("");
  // Display preferences
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>(FALLBACK_LANGUAGE_OPTIONS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const DATE_FORMAT_OPTIONS = [
    { value: "DD/MM/YYYY", label: "DD/MM/YYYY (31/12/2024)" },
    { value: "MM/DD/YYYY", label: "MM/DD/YYYY (12/31/2024)" },
    { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2024-12-31)" },
    { value: "DD.MM.YYYY", label: "DD.MM.YYYY (31.12.2024)" },
    { value: "DD-MM-YYYY", label: "DD-MM-YYYY (31-12-2024)" },
  ];

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setPreferredLanguage(user.preferred_language || "en");
      setDocumentationLanguage(user.documentation_language || "en");
      // Extended profile fields
      setEmploymentStatus(user.employment_status || "");
      setEducationType(user.education_type || "");
      setAdditionalProfileContext(user.additional_profile_context || "");
      // Display preferences
      setDateFormat(user.date_format || "DD/MM/YYYY");

      api
        .listLanguages()
        .then((res) => setLanguageOptions(res))
        .catch((error) => {
          console.error("Failed to load languages", error);
        });
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await api.updateUser(
        fullName,
        preferredLanguage,
        undefined, // motherTongue - not used anymore
        documentationLanguage,
        employmentStatus || undefined,
        educationType || undefined,
        additionalProfileContext || undefined,
        dateFormat
      );
      await refreshUser();
      setSuccess(t("settings.settingsSaved"));
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || t("settings.saveFailed") || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-400">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-slate-400 hover:text-slate-200"
            >
              ← {t("common.backToDashboard")}
            </button>
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="EasyBewerbung" className="w-8 h-8 rounded-lg" />
              <span className="text-xl font-bold">{t("common.appName")}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400">
              {user.full_name || user.email}
            </span>
            <span className="px-3 py-1 rounded bg-slate-800 text-sm text-emerald-300 border border-emerald-700">
              Credits: {user.credits}
            </span>
            <Button onClick={handleLogout} variant="outline">
              {t("common.logout")}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold mb-8">{t("settings.title")}</h1>

        <Card>
          <form onSubmit={handleSave} className="space-y-6">
            {/* Profile Information */}
            <div>
              <h2 className="text-xl font-semibold mb-4">{t("settings.profileInformation")}</h2>
              <Input
                label={t("settings.fullName")}
                value={fullName}
                onChange={setFullName}
                placeholder="Your full name"
              />
            </div>

            {/* Language Settings */}
            <div className="space-y-4 pt-4 border-t border-slate-700">
              <h2 className="text-xl font-semibold">{t("settings.languagePreferences")}</h2>
              <p className="text-sm text-slate-400">
                {t("settings.languageDescription")}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    {t("settings.preferredLanguage")}
                  </label>
                  <select
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {languageOptions.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    {t("settings.preferredLanguageHint")}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    {t("settings.documentationLanguage")}
                  </label>
                  <select
                    value={documentationLanguage}
                    onChange={(e) => setDocumentationLanguage(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {languageOptions.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    {t("settings.documentationLanguageHint")}
                  </p>
                </div>
              </div>
            </div>

            {/* Extended Profile Settings */}
            <div className="space-y-4 pt-4 border-t border-slate-700">
              <h2 className="text-xl font-semibold">{t("settings.extendedProfile") || "Extended Profile"}</h2>
              <p className="text-sm text-slate-400">
                {t("settings.extendedProfileDescription") || "Additional information to help generate more personalized application documents."}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    {t("settings.employmentStatus") || "Employment Status"}
                  </label>
                  <select
                    value={employmentStatus}
                    onChange={(e) => setEmploymentStatus(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">{t("settings.selectOption") || "-- Select --"}</option>
                    <option value="employed">{t("settings.employed") || "Currently employed"}</option>
                    <option value="unemployed">{t("settings.unemployed") || "Currently unemployed"}</option>
                    <option value="student">{t("settings.student") || "Student"}</option>
                    <option value="transitioning">{t("settings.transitioning") || "In career transition"}</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    {t("settings.employmentStatusHint") || "Your current employment situation helps tailor the tone of your applications."}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    {t("settings.educationType") || "Education Type"}
                  </label>
                  <select
                    value={educationType}
                    onChange={(e) => setEducationType(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">{t("settings.selectOption") || "-- Select --"}</option>
                    <option value="wms">{t("settings.wms") || "WMS (Wirtschaftsmittelschule)"}</option>
                    <option value="bms">{t("settings.bms") || "BMS (Berufsmaturitätsschule)"}</option>
                    <option value="university">{t("settings.university") || "University / FH"}</option>
                    <option value="apprenticeship">{t("settings.apprenticeship") || "Apprenticeship (Berufslehre)"}</option>
                    <option value="other">{t("settings.other") || "Other"}</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    {t("settings.educationTypeHint") || "Your education background helps personalize applications, especially for internship positions."}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    {t("settings.additionalContext") || "Additional Context"}
                  </label>
                  <textarea
                    value={additionalProfileContext}
                    onChange={(e) => setAdditionalProfileContext(e.target.value)}
                    placeholder={t("settings.additionalContextPlaceholder") || "e.g., I am in my practical year (Praktikumsjahr) as part of my WMS education..."}
                    className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {t("settings.additionalContextHint") || "Any additional information relevant to your job applications."}
                  </p>
                </div>
              </div>
            </div>

            {/* Display Preferences */}
            <div className="space-y-4 pt-4 border-t border-slate-700">
              <h2 className="text-xl font-semibold">{t("settings.displayPreferences") || "Display Preferences"}</h2>
              <p className="text-sm text-slate-400">
                {t("settings.displayPreferencesDescription") || "Customize how information is displayed throughout the app."}
              </p>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  {t("settings.dateFormat") || "Date Format"}
                </label>
                <select
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {DATE_FORMAT_OPTIONS.map((fmt) => (
                    <option key={fmt.value} value={fmt.value}>
                      {fmt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  {t("settings.dateFormatHint") || "Choose how dates are displayed throughout the application."}
                </p>
              </div>
            </div>

            {/* Success/Error Messages */}
            {success && (
              <div className="p-4 rounded-lg bg-emerald-900/30 border border-emerald-700 text-emerald-400">
                {success}
              </div>
            )}

            {error && (
              <div className="p-4 rounded-lg bg-red-900/30 border border-red-700 text-red-400">
                {error}
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <Button
                type="button"
                onClick={() => router.push("/dashboard")}
                variant="outline"
              >
                {t("settings.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={saving}
                variant="primary"
              >
                {saving ? t("settings.saving") : t("settings.saveSettings")}
              </Button>
            </div>
          </form>
        </Card>

        {/* Account Information */}
        <Card className="mt-6">
          <h2 className="text-xl font-semibold mb-4">{t("settings.accountInformation")}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Email:</span>
              <span className="text-white">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t("settings.accountCreated")}:</span>
              <span className="text-white">
                {new Date(user.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Credits:</span>
              <span className="text-white">{user.credits}</span>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
