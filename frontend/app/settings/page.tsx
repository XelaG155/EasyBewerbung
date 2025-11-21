"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { useAuth } from "@/lib/auth-context";
import api, { LanguageOption } from "@/lib/api";

const FALLBACK_LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", label: "English", direction: "ltr" },
  { code: "de", label: "Deutsch (German)", direction: "ltr" },
  { code: "fr", label: "Français (French)", direction: "ltr" },
  { code: "es", label: "Español (Spanish)", direction: "ltr" },
  { code: "ar", label: "Arabic", direction: "rtl" },
];

export default function SettingsPage() {
  const { user, loading: authLoading, logout, refreshUser } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("");
  const [motherTongue, setMotherTongue] = useState("");
  const [documentationLanguage, setDocumentationLanguage] = useState("");
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>(FALLBACK_LANGUAGE_OPTIONS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setPreferredLanguage(user.preferred_language || "en");
      setMotherTongue(user.mother_tongue || "en");
      setDocumentationLanguage(user.documentation_language || "en");

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
        motherTongue,
        documentationLanguage
      );
      await refreshUser();
      setSuccess("Settings saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
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
          <p className="text-slate-400">Loading...</p>
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
              ← Back to Dashboard
            </button>
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="EasyBewerbung" className="w-8 h-8 rounded-lg" />
              <span className="text-xl font-bold">EasyBewerbung</span>
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
              Log Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>

        <Card>
          <form onSubmit={handleSave} className="space-y-6">
            {/* Profile Information */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
              <Input
                label="Full Name"
                value={fullName}
                onChange={setFullName}
                placeholder="Your full name"
              />
            </div>

            {/* Language Settings */}
            <div className="space-y-4 pt-4 border-t border-slate-700">
              <h2 className="text-xl font-semibold">Language Preferences</h2>
              <p className="text-sm text-slate-400">
                Choose your preferred languages for communication and documentation.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Preferred Language (UI)
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
                    Your preferred language for the user interface
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Mother Tongue
                  </label>
                  <select
                    value={motherTongue}
                    onChange={(e) => setMotherTongue(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {languageOptions.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Your native language for company profile generation
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Documentation Language
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
                    Default language for generated documents and applications
                  </p>
                </div>
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
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                variant="primary"
              >
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </form>
        </Card>

        {/* Account Information */}
        <Card className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Account Information</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Email:</span>
              <span className="text-white">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Account Created:</span>
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
