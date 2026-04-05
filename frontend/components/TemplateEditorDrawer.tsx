"use client";

/**
 * TemplateEditorDrawer
 * --------------------
 * Side-drawer replacement for the cramped inline-table editing of
 * DocumentTemplate rows on the admin page. Organizes all fields into
 * tabs (Grunddaten, Sprache, LLM, Prompt, Vorschau) so there is room
 * to breathe and to show context (e.g. placeholder help next to the
 * prompt textarea).
 *
 * The component is purely presentational — it receives the template and
 * the list of LLM models from the parent, calls `onSave(updates)` when
 * the admin hits "Speichern" and `onClose()` to dismiss.
 */

import { useEffect, useMemo, useState } from "react";
import type {
  DocumentTemplate,
  DocumentTemplateUpdate,
  LlmModel,
} from "@/lib/api";

type Tab = "basics" | "language" | "llm" | "prompt" | "preview";

interface TemplateEditorDrawerProps {
  isOpen: boolean;
  template: DocumentTemplate | null;
  llmModels: LlmModel[];
  onClose: () => void;
  onSave: (updates: DocumentTemplateUpdate) => Promise<void>;
  onOpenPromptBuilder?: () => void;
}

const LANGUAGE_SOURCE_LABELS: Record<DocumentTemplate["language_source"], string> = {
  preferred_language: "Bevorzugte Sprache",
  mother_tongue: "Muttersprache",
  documentation_language: "Dokumentationssprache",
};

const LANGUAGE_SOURCE_HELP: Record<DocumentTemplate["language_source"], string> = {
  preferred_language:
    "Verwendet die vom Benutzer für die Oberfläche gewählte Sprache.",
  mother_tongue:
    "Verwendet die Muttersprache des Benutzers — nützlich für sehr persönliche Dokumente.",
  documentation_language:
    "Verwendet die Sprache, in der der Lebenslauf / die Bewerbung erstellt wird (Standard).",
};

const TABS: { id: Tab; label: string }[] = [
  { id: "basics", label: "Grunddaten" },
  { id: "language", label: "Sprache" },
  { id: "llm", label: "LLM" },
  { id: "prompt", label: "Prompt" },
  { id: "preview", label: "Vorschau" },
];

export default function TemplateEditorDrawer({
  isOpen,
  template,
  llmModels,
  onClose,
  onSave,
  onOpenPromptBuilder,
}: TemplateEditorDrawerProps) {
  const [tab, setTab] = useState<Tab>("basics");
  const [form, setForm] = useState<DocumentTemplateUpdate>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form when a new template is loaded into the drawer.
  useEffect(() => {
    if (template) {
      setForm({
        display_name: template.display_name,
        credit_cost: template.credit_cost,
        language_source: template.language_source,
        llm_provider: template.llm_provider,
        llm_model: template.llm_model,
        prompt_template: template.prompt_template,
        is_active: template.is_active,
      });
      setError(null);
      setTab("basics");
    }
  }, [template]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const modelsForProvider = useMemo(() => {
    const provider = form.llm_provider ?? template?.llm_provider ?? "openai";
    return llmModels
      .filter((m) => m.provider === provider && m.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [form.llm_provider, template?.llm_provider, llmModels]);

  if (!isOpen || !template) return null;

  const setField = <K extends keyof DocumentTemplateUpdate>(
    key: K,
    value: DocumentTemplateUpdate[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleProviderChange = (provider: string) => {
    const firstModel = llmModels
      .filter((m) => m.provider === provider && m.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)[0];
    setForm((prev) => ({
      ...prev,
      llm_provider: provider,
      llm_model: firstModel ? firstModel.model_id : "",
    }));
  };

  const handleSave = async () => {
    setError(null);

    // Client-side validation.
    if (form.display_name !== undefined && form.display_name.trim().length === 0) {
      setError("Anzeigename darf nicht leer sein.");
      setTab("basics");
      return;
    }
    if (
      form.credit_cost !== undefined &&
      (form.credit_cost < 0 || form.credit_cost > 10)
    ) {
      setError("Credit-Kosten müssen zwischen 0 und 10 liegen.");
      setTab("basics");
      return;
    }
    if (!form.llm_model || form.llm_model.length === 0) {
      setError("Bitte ein LLM-Modell auswählen.");
      setTab("llm");
      return;
    }
    if (form.prompt_template !== undefined && form.prompt_template.trim().length < 20) {
      setError("Prompt ist zu kurz — mindestens 20 Zeichen.");
      setTab("prompt");
      return;
    }

    try {
      setSaving(true);
      await onSave(form);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Speichern fehlgeschlagen. Bitte Logs prüfen."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className="w-full max-w-2xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Header */}
        <header className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="drawer-title"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate"
            >
              Template bearbeiten
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              <code className="font-mono">{template.doc_type}</code> ·{" "}
              {template.display_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 text-2xl leading-none"
            aria-label="Schliessen"
          >
            &times;
          </button>
        </header>

        {/* Tabs */}
        <nav className="px-6 border-b border-gray-200 dark:border-gray-800 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? "border-blue-600 text-blue-700 dark:text-blue-400"
                  : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {tab === "basics" && (
            <>
              <Field label="Anzeigename">
                <input
                  type="text"
                  value={form.display_name ?? ""}
                  onChange={(e) => setField("display_name", e.target.value)}
                  className={inputClasses}
                />
              </Field>
              <Field label="Credit-Kosten (0 bis 10)">
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={form.credit_cost ?? 1}
                  onChange={(e) =>
                    setField("credit_cost", Number.parseInt(e.target.value, 10))
                  }
                  className={inputClasses}
                />
                <HelpText>
                  0 = kostenlos. Orientiere dich an der Generierungsdauer und der
                  Modellkosten.
                </HelpText>
              </Field>
              <Field label="Aktiv">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active ?? true}
                    onChange={(e) => setField("is_active", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Dieses Template ist für Benutzer verfügbar
                  </span>
                </label>
              </Field>
            </>
          )}

          {tab === "language" && (
            <Field label="Sprachquelle">
              <select
                value={form.language_source ?? "documentation_language"}
                onChange={(e) =>
                  setField(
                    "language_source",
                    e.target.value as DocumentTemplate["language_source"]
                  )
                }
                className={inputClasses}
              >
                {(
                  Object.keys(LANGUAGE_SOURCE_LABELS) as Array<
                    DocumentTemplate["language_source"]
                  >
                ).map((key) => (
                  <option key={key} value={key}>
                    {LANGUAGE_SOURCE_LABELS[key]}
                  </option>
                ))}
              </select>
              <HelpText>
                {
                  LANGUAGE_SOURCE_HELP[
                    (form.language_source ??
                      "documentation_language") as DocumentTemplate["language_source"]
                  ]
                }
              </HelpText>
            </Field>
          )}

          {tab === "llm" && (
            <>
              <Field label="Provider">
                <select
                  value={form.llm_provider ?? "openai"}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className={inputClasses}
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="google">Google (Gemini)</option>
                </select>
              </Field>
              <Field label="Modell">
                {modelsForProvider.length === 0 ? (
                  <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 text-amber-900 dark:text-amber-200 px-3 py-2 text-sm">
                    Keine aktiven Modelle für diesen Provider. Füge welche unter
                    dem Bereich „LLM-Modelle" hinzu oder aktiviere sie dort.
                  </div>
                ) : (
                  <select
                    value={form.llm_model ?? ""}
                    onChange={(e) => setField("llm_model", e.target.value)}
                    className={inputClasses}
                  >
                    {modelsForProvider.map((m) => (
                      <option key={m.id} value={m.model_id}>
                        {m.display_name}
                        {m.context_window ? ` (${m.context_window} tok)` : ""}
                      </option>
                    ))}
                  </select>
                )}
                <HelpText>
                  Modelle werden in der DB-Tabelle <code>llm_models</code>{" "}
                  gepflegt. Neue Modelle kannst du unterhalb der Template-Liste
                  hinzufügen, ohne Code zu ändern.
                </HelpText>
              </Field>
            </>
          )}

          {tab === "prompt" && (
            <Field label="Prompt-Template">
              <textarea
                value={form.prompt_template ?? ""}
                onChange={(e) => setField("prompt_template", e.target.value)}
                rows={16}
                className={`${inputClasses} font-mono text-xs`}
                placeholder="Prompt-Template mit Placeholdern wie {language}, {cv_summary}, ..."
              />
              <div className="flex items-center justify-between mt-2">
                <HelpText>
                  Nutze Placeholder in geschweiften Klammern. Die verfügbaren
                  Placeholder findest du unten auf der Seite im „Placeholder
                  Explorer".
                </HelpText>
                {onOpenPromptBuilder && (
                  <button
                    type="button"
                    onClick={onOpenPromptBuilder}
                    className="px-3 py-1.5 rounded bg-purple-600 text-white text-xs hover:bg-purple-700 flex items-center gap-1 flex-shrink-0"
                  >
                    <span>🪄</span> Prompt Builder
                  </button>
                )}
              </div>
            </Field>
          )}

          {tab === "preview" && (
            <div className="space-y-3">
              <HelpText>
                Vorschau des Prompts, wie er mit den aktuellen Einstellungen
                gespeichert würde. Placeholder werden <em>nicht</em> ersetzt —
                das passiert erst beim Generieren.
              </HelpText>
              <pre className="rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 p-3 text-xs font-mono whitespace-pre-wrap text-gray-900 dark:text-gray-100 overflow-auto max-h-[60vh]">
                {form.prompt_template ?? "(leer)"}
              </pre>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Länge: {form.prompt_template?.length ?? 0} Zeichen · Modell:{" "}
                <code>{form.llm_provider}/{form.llm_model}</code>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-700 text-red-900 dark:text-red-200 px-3 py-2 text-sm"
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700"
            disabled={saving}
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? "Speichern..." : "Speichern"}
          </button>
        </footer>
      </aside>
    </div>
  );
}

// ---- Small presentational helpers --------------------------------------

const inputClasses =
  "w-full rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function HelpText({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
      {children}
    </p>
  );
}
