"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import api, {
  ActivityEntry,
  AdminLanguageSetting,
  AdminUserDetail,
  AdminUserSummary,
  PromptTemplate,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [languages, setLanguages] = useState<AdminLanguageSetting[]>([]);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [query, setQuery] = useState("");
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const isAdmin = user?.is_admin;

  useEffect(() => {
    if (!isAdmin) return;
    loadLanguages();
    loadPrompts();
    searchUsers("");
  }, [isAdmin]);

  const sortedLanguages = useMemo(
    () => [...languages].sort((a, b) => a.sort_order - b.sort_order),
    [languages],
  );

  const loadLanguages = async () => {
    try {
      const data = await api.adminListLanguages();
      setLanguages(data);
    } catch (error) {
      console.error("Failed to load languages:", error);
      setStatus("Fehler beim Laden der Sprachen.");
    }
  };

  const updateLanguages = async (next: AdminLanguageSetting[]) => {
    try {
      setLanguages(next);
      await api.adminUpdateLanguages(
        next.map((lang) => ({ code: lang.code, is_active: lang.is_active, sort_order: lang.sort_order })),
      );
      setStatus("Sprachoptionen gespeichert.");
    } catch (error) {
      console.error("Failed to update languages:", error);
      setStatus("Fehler beim Speichern der Sprachoptionen.");
      // Reload languages to revert changes
      await loadLanguages();
    }
  };

  const toggleLanguage = (code: string) => {
    const next = languages.map((lang) =>
      lang.code === code ? { ...lang, is_active: !lang.is_active } : lang,
    );
    updateLanguages(next);
  };

  const moveLanguage = (code: string, direction: -1 | 1) => {
    const next = [...sortedLanguages];
    const index = next.findIndex((l) => l.code === code);
    if (index < 0) return;
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    const withOrder = next.map((lang, idx) => ({ ...lang, sort_order: idx }));
    updateLanguages(withOrder);
  };

  const searchUsers = async (value: string) => {
    try {
      const data = await api.adminSearchUsers(value);
      setUsers(data);
    } catch (error) {
      console.error("Failed to search users:", error);
      setStatus("Fehler bei der Benutzersuche.");
    }
  };

  const selectUser = async (userId: number) => {
    try {
      const detail = await api.adminGetUserDetail(userId);
      setSelectedUser(detail);
    } catch (error) {
      console.error("Failed to load user details:", error);
      setStatus("Fehler beim Laden der Benutzerdetails.");
    }
  };

  const changeCredits = async (delta: number) => {
    if (!selectedUser) return;
    try {
      const detail = await api.adminUpdateCredits(selectedUser.user.id, delta);
      setSelectedUser(detail);
      setStatus("Credits aktualisiert.");
    } catch (error) {
      console.error("Failed to update credits:", error);
      setStatus("Fehler beim Aktualisieren der Credits.");
    }
  };

  const toggleUserActive = async (desired: boolean) => {
    if (!selectedUser) return;
    try {
      const detail = await api.adminToggleActive(selectedUser.user.id, desired);
      setSelectedUser(detail);
      setStatus(desired ? "Benutzer entsperrt." : "Benutzer gesperrt.");
    } catch (error) {
      console.error("Failed to toggle user active status:", error);
      setStatus("Fehler beim Ändern des Benutzerstatus.");
    }
  };

  const toggleUserAdmin = async (desired: boolean) => {
    if (!selectedUser) return;
    try {
      const detail = await api.adminToggleAdmin(selectedUser.user.id, desired);
      setSelectedUser(detail);
      setStatus(desired ? "Admin-Rechte erteilt." : "Admin-Rechte entzogen.");
    } catch (error) {
      console.error("Failed to toggle user admin status:", error);
      setStatus("Fehler beim Ändern der Admin-Rechte.");
    }
  };

  const loadPrompts = async () => {
    try {
      const data = await api.adminListPrompts();
      setPrompts(data);
    } catch (error) {
      console.error("Failed to load prompts:", error);
      setStatus("Fehler beim Laden der Prompts.");
    }
  };

  const updatePrompt = async (prompt: PromptTemplate, content: string) => {
    try {
      const updated = await api.adminUpdatePrompt(prompt.id, prompt.name, content);
      setPrompts((prev) => prev.map((p) => (p.id === prompt.id ? updated : p)));
      setStatus("Prompt gespeichert.");
    } catch (error) {
      console.error("Failed to update prompt:", error);
      setStatus("Fehler beim Speichern des Prompts.");
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-700 dark:text-gray-200">Lade...</div>;
  }

  if (!user) {
    return <div className="p-8 text-gray-700 dark:text-gray-200">Bitte zuerst anmelden.</div>;
  }

  if (!isAdmin) {
    return <div className="p-8 text-red-600">Kein Zugriff: Administratoren vorbehalten.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Konsole</h1>
      {status && (
        <div className="rounded bg-green-100 text-green-800 px-4 py-2 text-sm" role="status">
          {status}
        </div>
      )}

      {/* Document Templates Navigation Card */}
      <SectionCard title="Document Templates">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Konfiguriere Credit-Kosten, Sprachquellen, LLM Provider und Prompts für die Dokumentgenerierung.
        </p>
        <button
          onClick={() => router.push("/admin/documents")}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Document Templates verwalten
        </button>
      </SectionCard>

      <SectionCard title="Sprachen verwalten">
        <div className="space-y-2">
          {sortedLanguages.map((lang) => (
            <div
              key={lang.code}
              className="flex items-center justify-between rounded border border-gray-200 dark:border-gray-800 px-3 py-2"
            >
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{lang.label}</div>
                <div className="text-xs text-gray-500">{lang.code}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-800"
                  onClick={() => moveLanguage(lang.code, -1)}
                >
                  ↑
                </button>
                <button
                  className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-800"
                  onClick={() => moveLanguage(lang.code, 1)}
                >
                  ↓
                </button>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={lang.is_active}
                    onChange={() => toggleLanguage(lang.code)}
                  />
                  Aktiv
                </label>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="User Suche & Details">
        <div className="flex gap-2 mb-4">
          <input
            className="flex-1 rounded border border-gray-200 dark:border-gray-800 px-3 py-2"
            placeholder="Email oder Name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white"
            onClick={() => searchUsers(query)}
          >
            Suchen
          </button>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2 md:col-span-1">
            {users.map((u) => (
              <button
                key={u.id}
                className={`w-full text-left rounded border px-3 py-2 ${
                  selectedUser?.user.id === u.id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                    : "border-gray-200 dark:border-gray-800"
                }`}
                onClick={() => selectUser(u.id)}
              >
                <div className="font-semibold text-gray-900 dark:text-gray-100">{u.email}</div>
                <div className="text-xs text-gray-500">Credits: {u.credits}</div>
                <div className="text-xs text-gray-500">Admin: {u.is_admin ? "Ja" : "Nein"}</div>
              </button>
            ))}
          </div>
          <div className="md:col-span-2 space-y-3">
            {selectedUser ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {selectedUser.user.email}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Credits: {selectedUser.user.credits}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-800"
                      onClick={() => changeCredits(1)}
                    >
                      +1 Credit
                    </button>
                    <button
                      className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-800"
                      onClick={() => changeCredits(-1)}
                    >
                      -1 Credit
                    </button>
                    <button
                      className={`px-3 py-1 rounded ${
                        selectedUser.user.is_active ? "bg-red-600 text-white" : "bg-green-600 text-white"
                      }`}
                      onClick={() => toggleUserActive(!selectedUser.user.is_active)}
                    >
                      {selectedUser.user.is_active ? "Sperren" : "Entsperren"}
                    </button>
                    <button
                      className="px-3 py-1 rounded bg-yellow-500 text-white"
                      onClick={() => toggleUserAdmin(!selectedUser.user.is_admin)}
                    >
                      {selectedUser.user.is_admin ? "Admin entziehen" : "Admin geben"}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <div>Letzter Login: {selectedUser.user.last_login_at || "-"}</div>
                  <div>Passwort geändert: {selectedUser.user.password_changed_at || "-"}</div>
                  <div>Erstellt am: {selectedUser.user.created_at}</div>
                  <div>Status: {selectedUser.user.is_active ? "Aktiv" : "Gesperrt"}</div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Aktivitäten</h3>
                  <div className="max-h-60 overflow-auto space-y-2 text-sm">
                    {selectedUser.activity.length === 0 && (
                      <div className="text-gray-500">Noch keine Logs.</div>
                    )}
                    {selectedUser.activity.map((log: ActivityEntry, idx) => (
                      <div
                        key={idx}
                        className="border border-gray-200 dark:border-gray-800 rounded px-3 py-2"
                      >
                        <div className="font-medium text-gray-900 dark:text-gray-100">{log.action}</div>
                        <div className="text-xs text-gray-500">{log.created_at}</div>
                        <div className="text-xs text-gray-500">IP: {log.ip_address || "-"}</div>
                        {log.metadata && <div className="text-xs text-gray-500">{log.metadata}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-gray-500">Bitte einen User auswählen.</div>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Prompts verwalten">
        <div className="space-y-4">
          {prompts.map((prompt) => (
            <div key={prompt.id} className="border border-gray-200 dark:border-gray-800 rounded p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{prompt.name}</div>
                  <div className="text-xs text-gray-500">{prompt.doc_type}</div>
                </div>
                <div className="text-xs text-gray-500">Aktualisiert: {prompt.updated_at}</div>
              </div>
              <textarea
                className="mt-2 w-full rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2 text-sm text-gray-800 dark:text-gray-100"
                rows={4}
                defaultValue={prompt.content}
                onBlur={(e) => updatePrompt(prompt, e.target.value)}
              />
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
