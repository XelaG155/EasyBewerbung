"use client";

/**
 * LlmSyncCheckModal
 * -----------------
 * Full-screen modal that shows the result of a live check against the LLM
 * providers (OpenAI / Anthropic / Google):
 *
 * - Deprecated models: currently in our DB but no longer offered by the
 *   provider. Shown with the list of DocumentTemplates that reference them
 *   and a suggested replacement. Admin can delete them individually.
 * - New models: offered by the provider but missing from our DB. Admin can
 *   check the boxes and import them in bulk.
 *
 * Providers that are unreachable (missing SDK or API key) are shown with
 * the error message so the admin knows which env var to set.
 */

import { useEffect, useState } from "react";

import api, {
  LlmImportRequestItem,
  LlmProvider,
  LlmSyncCheckResult,
  LlmSyncDeprecatedEntry,
  LlmSyncNewEntry,
} from "@/lib/api";
import { adminBtn, adminIconBtn } from "@/lib/admin-ui";

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
  setStatus: (s: { kind: "success" | "error"; text: string }) => void;
}

export default function LlmSyncCheckModal({
  isOpen,
  onClose,
  onChanged,
  setStatus,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LlmSyncCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  // Trigger the check automatically when the modal opens for the first time.
  useEffect(() => {
    if (isOpen && result === null && !loading) {
      runCheck();
    }
    if (!isOpen) {
      // Reset on close so the next open re-runs fresh.
      setResult(null);
      setSelected(new Set());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.syncCheckLlmModels();
      setResult(r);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "LLM-Sync-Check fehlgeschlagen."
      );
    } finally {
      setLoading(false);
    }
  };

  const keyFor = (m: LlmSyncNewEntry) => `${m.provider}:${m.model_id}`;

  const toggleSelected = (m: LlmSyncNewEntry) => {
    const key = keyFor(m);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllNew = () => {
    if (!result) return;
    const all = new Set<string>();
    for (const provider of Object.keys(result.providers) as LlmProvider[]) {
      for (const m of result.providers[provider].new) {
        all.add(keyFor(m));
      }
    }
    setSelected(all);
  };

  const clearSelection = () => setSelected(new Set());

  const importSelected = async () => {
    if (!result || selected.size === 0) return;
    const items: LlmImportRequestItem[] = [];
    for (const provider of Object.keys(result.providers) as LlmProvider[]) {
      for (const m of result.providers[provider].new) {
        if (selected.has(keyFor(m))) {
          items.push({
            provider: m.provider,
            model_id: m.model_id,
            display_name: m.display_name,
          });
        }
      }
    }
    setImporting(true);
    try {
      const importResult = await api.importLlmModels(items);
      setStatus({
        kind: "success",
        text: `${importResult.created} Modelle importiert (${importResult.skipped} übersprungen).`,
      });
      await onChanged();
      // Re-run the check so the just-imported items disappear from "new".
      await runCheck();
      setSelected(new Set());
    } catch (e) {
      setStatus({
        kind: "error",
        text: e instanceof Error ? e.message : "Import fehlgeschlagen.",
      });
    } finally {
      setImporting(false);
    }
  };

  const deleteDeprecated = async (row: LlmSyncDeprecatedEntry) => {
    const refs = row.referencing_templates;
    const confirmMsg =
      refs.length > 0
        ? `Modell ${row.provider}/${row.model_id} löschen?\n\n` +
          `Es wird aktuell von ${refs.length} Template(s) verwendet:\n` +
          refs.map((r) => `  • ${r.display_name} (${r.doc_type})`).join("\n") +
          `\n\nBitte stellen Sie diese Vorlagen zuerst auf ein anderes Modell um, ` +
          `sonst verweigert der Server den Löschvorgang (409).` +
          (row.suggested_replacement
            ? `\n\nVorschlag: ${row.suggested_replacement.provider}/${row.suggested_replacement.model_id}`
            : "")
        : `Modell ${row.provider}/${row.model_id} löschen?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await api.deleteLlmModel(row.id);
      setStatus({
        kind: "success",
        text: `Modell ${row.provider}/${row.model_id} gelöscht.`,
      });
      await onChanged();
      await runCheck();
    } catch (e) {
      setStatus({
        kind: "error",
        text: e instanceof Error ? e.message : "Löschen fehlgeschlagen.",
      });
    }
  };

  if (!isOpen) return null;

  const providerNames: LlmProvider[] = result
    ? (Object.keys(result.providers) as LlmProvider[])
    : [];
  const totalDeprecated = result
    ? Object.values(result.providers).reduce(
        (sum, p) => sum + p.deprecated.length,
        0
      )
    : 0;
  const totalNew = result
    ? Object.values(result.providers).reduce((sum, p) => sum + p.new.length, 0)
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-check-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="sync-check-title"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              LLM-Update prüfen
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Vergleicht die in der DB hinterlegten Modelle mit den Live-Listen
              von OpenAI, Anthropic und Google.
              {result && (
                <>
                  {" "}
                  · Geprüft: {new Date(result.checked_at).toLocaleString("de-CH")}
                  {" · "}
                  <span className="text-red-700 dark:text-red-300">
                    {totalDeprecated} veraltet
                  </span>
                  {" · "}
                  <span className="text-green-700 dark:text-green-300">
                    {totalNew} neu
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={runCheck}
              disabled={loading}
              className={adminBtn.primary("md")}
            >
              {loading ? "Prüft..." : "Neu prüfen"}
            </button>
            <button
              onClick={onClose}
              className={`${adminIconBtn} text-2xl leading-none`}
              aria-label="Schliessen"
            >
              &times;
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {error && (
            <div
              role="alert"
              className="rounded border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-700 text-red-900 dark:text-red-200 px-3 py-2 text-sm"
            >
              {error}
            </div>
          )}

          {loading && !result && (
            <div className="text-center py-12 text-gray-600 dark:text-gray-400">
              Lade Live-Daten von den Providern...
            </div>
          )}

          {result &&
            providerNames.map((providerName) => {
              const pr = result.providers[providerName];
              return (
                <section
                  key={providerName}
                  className="border border-gray-200 dark:border-gray-800 rounded-lg"
                >
                  <header className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {PROVIDER_LABELS[providerName]}
                    </h3>
                    {pr.available ? (
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {pr.live_model_count} Modelle live
                      </span>
                    ) : (
                      <span className="text-xs text-amber-700 dark:text-amber-300">
                        Nicht erreichbar
                      </span>
                    )}
                  </header>

                  {!pr.available && (
                    <div className="p-4 text-xs text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30">
                      {pr.error ?? "Provider nicht erreichbar."}
                    </div>
                  )}

                  {pr.available && pr.deprecated.length === 0 && pr.new.length === 0 && (
                    <div className="p-4 text-xs text-green-800 dark:text-green-300">
                      Alles im grünen Bereich — keine Unterschiede zur DB.
                    </div>
                  )}

                  {pr.deprecated.length > 0 && (
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                      <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                        Veraltet ({pr.deprecated.length})
                      </h4>
                      <div className="space-y-2">
                        {pr.deprecated.map((row) => (
                          <div
                            key={row.id}
                            className="rounded border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/20 p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="font-mono text-xs text-gray-900 dark:text-gray-100">
                                  {row.model_id}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  {row.display_name}
                                </div>
                                {row.referencing_templates.length > 0 ? (
                                  <div className="mt-2 text-xs text-gray-700 dark:text-gray-300">
                                    <div className="font-semibold">
                                      Verwendet in {row.referencing_templates.length}{" "}
                                      Template(s):
                                    </div>
                                    <ul className="list-disc ml-5 mt-1">
                                      {row.referencing_templates.map((t) => (
                                        <li key={t.id}>
                                          {t.display_name}{" "}
                                          <code className="text-gray-500">
                                            ({t.doc_type})
                                          </code>
                                        </li>
                                      ))}
                                    </ul>
                                    {row.suggested_replacement && (
                                      <div className="mt-2 text-xs text-blue-800 dark:text-blue-300">
                                        <strong>Vorschlag:</strong>{" "}
                                        <code>
                                          {row.suggested_replacement.provider}/
                                          {row.suggested_replacement.model_id}
                                        </code>{" "}
                                        ({row.suggested_replacement.display_name})
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                    Wird von keinem Template referenziert — kann
                                    sicher gelöscht werden.
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => deleteDeprecated(row)}
                                className={`${adminBtn.danger("sm")} flex-shrink-0`}
                                aria-label={`Modell ${row.model_id} löschen`}
                              >
                                Löschen
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pr.new.length > 0 && (
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-green-800 dark:text-green-300">
                          Neu verfügbar ({pr.new.length})
                        </h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        {pr.new.map((m) => {
                          const k = keyFor(m);
                          const isChecked = selected.has(k);
                          return (
                            <label
                              key={k}
                              className={`flex items-center gap-2 rounded border px-2 py-1.5 text-xs cursor-pointer transition-colors ${
                                isChecked
                                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                                  : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelected(m)}
                                className="h-3.5 w-3.5"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-mono text-gray-900 dark:text-gray-100 truncate">
                                  {m.model_id}
                                </div>
                                {m.display_name !== m.model_id && (
                                  <div className="text-gray-600 dark:text-gray-400 truncate">
                                    {m.display_name}
                                  </div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
        </div>

        {/* Footer */}
        {result && totalNew > 0 && (
          <footer className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllNew}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline rounded px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Alle auswählen
              </button>
              <span className="text-gray-400" aria-hidden="true">·</span>
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs text-gray-600 dark:text-gray-400 hover:underline rounded px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Auswahl leeren
              </button>
              <span className="text-xs text-gray-600 dark:text-gray-400 ml-2">
                {selected.size} ausgewählt
              </span>
            </div>
            <button
              onClick={importSelected}
              disabled={importing || selected.size === 0}
              className={adminBtn.success("lg")}
            >
              {importing
                ? "Wird importiert..."
                : selected.size === 0
                ? "Auswahl importieren"
                : `${selected.size} importieren`}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
