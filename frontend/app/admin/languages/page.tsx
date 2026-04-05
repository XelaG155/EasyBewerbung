"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import api, { AdminLanguageSetting } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { adminBtn } from "@/lib/admin-ui";

type StatusMessage = { kind: "success" | "error"; text: string };

/**
 * Dedicated admin page for managing UI languages, reachable from the Admin
 * Console via the "Sprachen verwalten" card. Moved out of the main admin
 * page (2026-04-05) to reduce the vertical scroll on the console and give
 * the languages workflow its own focused surface, analogous to
 * `/admin/documents`.
 */
export default function AdminLanguagesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [languages, setLanguages] = useState<AdminLanguageSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const sortedLanguages = useMemo(
    () => [...languages].sort((a, b) => a.sort_order - b.sort_order),
    [languages]
  );

  useEffect(() => {
    if (!authLoading && (!user || !user.is_admin)) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  const loadLanguages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.adminListLanguages();
      setLanguages(data);
    } catch (error) {
      console.error(error);
      setStatus({ kind: "error", text: "Fehler beim Laden der Sprachen." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.is_admin) {
      loadLanguages();
    }
  }, [user, loadLanguages]);

  useEffect(() => {
    if (!status) return;
    const ms = status.kind === "error" ? 8000 : 5000;
    const handle = setTimeout(() => setStatus(null), ms);
    return () => clearTimeout(handle);
  }, [status]);

  const persistLanguages = async (next: AdminLanguageSetting[]) => {
    const previous = languages;
    setLanguages(next);
    try {
      await api.adminUpdateLanguages(
        next.map((lang) => ({
          code: lang.code,
          is_active: lang.is_active,
          sort_order: lang.sort_order,
        }))
      );
      setStatus({ kind: "success", text: "Spracheinstellungen gespeichert." });
    } catch (error) {
      console.error(error);
      setStatus({
        kind: "error",
        text: "Fehler beim Speichern. Änderung wurde zurückgesetzt.",
      });
      setLanguages(previous);
    }
  };

  const toggleLanguage = (code: string) => {
    const next = languages.map((lang) =>
      lang.code === code ? { ...lang, is_active: !lang.is_active } : lang
    );
    persistLanguages(next);
  };

  const moveLanguage = (code: string, direction: -1 | 1) => {
    const next = [...sortedLanguages];
    const index = next.findIndex((l) => l.code === code);
    if (index < 0) return;
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    const withOrder = next.map((lang, idx) => ({ ...lang, sort_order: idx }));
    persistLanguages(withOrder);
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto p-6" aria-busy="true">
        <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-800 animate-pulse mb-4" />
        <div className="h-64 w-full rounded bg-gray-100 dark:bg-gray-900 animate-pulse" />
      </div>
    );
  }

  if (!user?.is_admin) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Sprachen verwalten
        </h1>
        <button
          onClick={() => router.push("/admin")}
          className={adminBtn.secondary("lg")}
        >
          <span aria-hidden="true">←</span> Zurück zur Admin-Konsole
        </button>
      </header>

      <section className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Steuern Sie, welche Oberflächensprachen Benutzern zur Verfügung stehen
          und in welcher Reihenfolge sie im Sprachwähler erscheinen. Änderungen
          werden sofort gespeichert.
        </p>

        {sortedLanguages.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Keine Sprachen konfiguriert.
          </p>
        ) : (
          <div className="space-y-2">
            {sortedLanguages.map((lang, idx) => (
              <div
                key={lang.code}
                className={
                  "flex items-center justify-between rounded border px-3 py-2.5 " +
                  (lang.is_active
                    ? "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                    : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40")
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {lang.label}
                  </div>
                  <div className="text-xs font-mono text-gray-500">
                    {lang.code}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    className={adminBtn.secondary("sm")}
                    onClick={() => moveLanguage(lang.code, -1)}
                    disabled={idx === 0}
                    aria-label={`${lang.label} nach oben verschieben`}
                  >
                    ↑
                  </button>
                  <button
                    className={adminBtn.secondary("sm")}
                    onClick={() => moveLanguage(lang.code, 1)}
                    disabled={idx === sortedLanguages.length - 1}
                    aria-label={`${lang.label} nach unten verschieben`}
                  >
                    ↓
                  </button>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={lang.is_active}
                      onChange={() => toggleLanguage(lang.code)}
                      className="h-4 w-4"
                    />
                    Aktiv
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {status && (
        <div
          role={status.kind === "error" ? "alert" : "status"}
          aria-live={status.kind === "error" ? "assertive" : "polite"}
          className={
            "fixed bottom-4 right-4 z-[60] max-w-md rounded-lg shadow-lg " +
            "border px-4 py-3 text-sm flex items-start gap-3 " +
            (status.kind === "success"
              ? "bg-green-50 dark:bg-green-950/80 border-green-300 dark:border-green-800 text-green-900 dark:text-green-200"
              : "bg-red-50 dark:bg-red-950/80 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200")
          }
        >
          <span aria-hidden="true" className="mt-0.5 flex-shrink-0">
            {status.kind === "success" ? "✓" : "⚠"}
          </span>
          <div className="flex-1 min-w-0">{status.text}</div>
          <button
            onClick={() => setStatus(null)}
            className="flex-shrink-0 text-current opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current rounded"
            aria-label="Meldung schliessen"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
