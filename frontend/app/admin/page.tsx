"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api, {
  ActivityEntry,
  AdminUserDetail,
  AdminUserSummary,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { adminBtn } from "@/lib/admin-ui";

type StatusMessage = { kind: "success" | "error"; text: string };

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(
    null
  );
  const [query, setQuery] = useState("");
  const [creditInput, setCreditInput] = useState<string>("10");
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const isAdmin = user?.is_admin;

  useEffect(() => {
    if (!isAdmin) return;
    searchUsers("");
  }, [isAdmin]);

  // Auto-dismiss toast after 5s (8s for errors)
  useEffect(() => {
    if (!status) return;
    const ms = status.kind === "error" ? 8000 : 5000;
    const handle = setTimeout(() => setStatus(null), ms);
    return () => clearTimeout(handle);
  }, [status]);

  const searchUsers = async (value: string) => {
    try {
      const data = await api.adminSearchUsers(value);
      setUsers(data);
    } catch (error) {
      console.error("Failed to search users:", error);
      setStatus({ kind: "error", text: "Fehler bei der Benutzersuche." });
    }
  };

  const selectUser = async (userId: number) => {
    try {
      const detail = await api.adminGetUserDetail(userId);
      setSelectedUser(detail);
    } catch (error) {
      console.error("Failed to load user details:", error);
      setStatus({
        kind: "error",
        text: "Fehler beim Laden der Benutzerdetails.",
      });
    }
  };

  const applyCreditChange = async (delta: number) => {
    if (!selectedUser) return;
    if (delta === 0) {
      setStatus({ kind: "error", text: "Bitte eine Anzahl ungleich 0 angeben." });
      return;
    }
    try {
      const detail = await api.adminUpdateCredits(selectedUser.user.id, delta);
      setSelectedUser(detail);
      setStatus({
        kind: "success",
        text:
          delta > 0
            ? `${delta} Credits hinzugefügt (neu: ${detail.user.credits}).`
            : `${Math.abs(delta)} Credits abgezogen (neu: ${detail.user.credits}).`,
      });
    } catch (error) {
      console.error("Failed to update credits:", error);
      setStatus({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Fehler beim Aktualisieren der Credits.",
      });
    }
  };

  const handleCreditSubmit = (mode: "add" | "subtract") => {
    const parsed = parseInt(creditInput.trim(), 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      setStatus({
        kind: "error",
        text: "Bitte eine positive ganze Zahl eingeben.",
      });
      return;
    }
    applyCreditChange(mode === "add" ? parsed : -parsed);
  };

  const toggleUserActive = async (desired: boolean) => {
    if (!selectedUser) return;
    try {
      const detail = await api.adminToggleActive(
        selectedUser.user.id,
        desired
      );
      setSelectedUser(detail);
      setStatus({
        kind: "success",
        text: desired ? "Benutzer entsperrt." : "Benutzer gesperrt.",
      });
    } catch (error) {
      console.error("Failed to toggle user active status:", error);
      setStatus({
        kind: "error",
        text: "Fehler beim Ändern des Benutzerstatus.",
      });
    }
  };

  const toggleUserAdmin = async (desired: boolean) => {
    if (!selectedUser) return;
    try {
      const detail = await api.adminToggleAdmin(selectedUser.user.id, desired);
      setSelectedUser(detail);
      setStatus({
        kind: "success",
        text: desired ? "Admin-Rechte erteilt." : "Admin-Rechte entzogen.",
      });
    } catch (error) {
      console.error("Failed to toggle user admin status:", error);
      setStatus({
        kind: "error",
        text: "Fehler beim Ändern der Admin-Rechte.",
      });
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-gray-700 dark:text-gray-200">Lade...</div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 text-gray-700 dark:text-gray-200">
        Bitte zuerst anmelden.
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-8 text-red-600">
        Kein Zugriff: Administratoren vorbehalten.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Admin-Konsole
        </h1>
        <button
          onClick={() => router.push("/dashboard")}
          className={adminBtn.secondary("lg")}
          title="Zurück zum Dashboard"
        >
          <span aria-hidden="true">←</span> Zurück zum Dashboard
        </button>
      </div>

      {/* Navigation cards for sub-admin areas */}
      <div className="grid md:grid-cols-2 gap-4">
        <SectionCard title="Dokument-Vorlagen">
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            Credit-Kosten, Sprachquellen, LLM-Provider, Prompts und Dokumenttypen
            verwalten.
          </p>
          <button
            onClick={() => router.push("/admin/documents")}
            className={adminBtn.primary("lg")}
          >
            Dokument-Vorlagen verwalten →
          </button>
        </SectionCard>

        <SectionCard title="Sprachen">
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            Verfügbare Oberflächensprachen aktivieren, deaktivieren und sortieren.
          </p>
          <button
            onClick={() => router.push("/admin/languages")}
            className={adminBtn.primary("lg")}
          >
            Sprachen verwalten →
          </button>
        </SectionCard>
      </div>

      <SectionCard title="Benutzer suchen und verwalten">
        <div className="flex gap-2 mb-4">
          <input
            className="flex-1 rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            placeholder="E-Mail oder Name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") searchUsers(query);
            }}
          />
          <button
            className={adminBtn.primary("lg")}
            onClick={() => searchUsers(query)}
          >
            Suchen
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2 md:col-span-1 max-h-[600px] overflow-y-auto">
            {users.length === 0 ? (
              <div className="text-sm text-gray-500">Keine Benutzer gefunden.</div>
            ) : (
              users.map((u) => (
                <button
                  key={u.id}
                  className={
                    "w-full text-left rounded border px-3 py-2 transition-colors " +
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 " +
                    (selectedUser?.user.id === u.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                      : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40")
                  }
                  onClick={() => selectUser(u.id)}
                >
                  <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {u.email}
                  </div>
                  <div className="text-xs text-gray-500">
                    Credits: {u.credits} · Admin: {u.is_admin ? "Ja" : "Nein"}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="md:col-span-2 space-y-4">
            {selectedUser ? (
              <>
                <div className="rounded border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {selectedUser.user.email}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Aktuelle Credits:{" "}
                        <strong className="text-gray-900 dark:text-gray-100">
                          {selectedUser.user.credits}
                        </strong>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        className={
                          selectedUser.user.is_active
                            ? adminBtn.danger("md")
                            : adminBtn.success("md")
                        }
                        onClick={() =>
                          toggleUserActive(!selectedUser.user.is_active)
                        }
                      >
                        {selectedUser.user.is_active ? "Sperren" : "Entsperren"}
                      </button>
                      <button
                        className={adminBtn.warning("md")}
                        onClick={() =>
                          toggleUserAdmin(!selectedUser.user.is_admin)
                        }
                      >
                        {selectedUser.user.is_admin
                          ? "Admin entziehen"
                          : "Admin geben"}
                      </button>
                    </div>
                  </div>

                  {/* Credit management — bulk input instead of +1/-1 buttons */}
                  <div className="border-t border-gray-200 dark:border-gray-800 pt-3">
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Credits anpassen
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={creditInput}
                        onChange={(e) => setCreditInput(e.target.value)}
                        className="w-24 rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        aria-label="Anzahl Credits"
                      />
                      <button
                        className={adminBtn.success("md")}
                        onClick={() => handleCreditSubmit("add")}
                      >
                        + hinzufügen
                      </button>
                      <button
                        className={adminBtn.secondary("md")}
                        onClick={() => handleCreditSubmit("subtract")}
                      >
                        − abziehen
                      </button>
                      <span className="text-xs text-gray-500 ml-1">
                        z.B. 20 für 20 gekaufte Credits
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-800 pt-3 grid grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <div>
                      Letzter Login:{" "}
                      <span className="text-gray-500">
                        {selectedUser.user.last_login_at || "—"}
                      </span>
                    </div>
                    <div>
                      Passwort geändert:{" "}
                      <span className="text-gray-500">
                        {selectedUser.user.password_changed_at || "—"}
                      </span>
                    </div>
                    <div>
                      Erstellt am:{" "}
                      <span className="text-gray-500">
                        {selectedUser.user.created_at}
                      </span>
                    </div>
                    <div>
                      Status:{" "}
                      <span
                        className={
                          selectedUser.user.is_active
                            ? "text-green-700 dark:text-green-400"
                            : "text-red-700 dark:text-red-400"
                        }
                      >
                        {selectedUser.user.is_active ? "Aktiv" : "Gesperrt"}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Aktivitäten
                  </h3>
                  <div className="max-h-60 overflow-auto space-y-2 text-sm">
                    {selectedUser.activity.length === 0 && (
                      <div className="text-gray-500">
                        Noch keine Aktivitätslogs.
                      </div>
                    )}
                    {selectedUser.activity.map(
                      (log: ActivityEntry, idx) => (
                        <div
                          key={idx}
                          className="border border-gray-200 dark:border-gray-800 rounded px-3 py-2"
                        >
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {log.action}
                          </div>
                          <div className="text-xs text-gray-500">
                            {log.created_at}
                          </div>
                          <div className="text-xs text-gray-500">
                            IP: {log.ip_address || "—"}
                          </div>
                          {log.metadata && (
                            <div className="text-xs text-gray-500 break-all">
                              {log.metadata}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-gray-500 text-sm">
                Bitte einen Benutzer aus der Liste wählen.
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Status toast */}
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
