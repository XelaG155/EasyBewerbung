"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth-context";
import api, {
  DocumentCategory,
  DocumentTemplate,
  DocumentTemplateUpdate,
  DocumentType,
  DocumentTypeCreate,
  LlmModel,
  LlmModelCreate,
  LlmProvider,
} from "@/lib/api";
import PlaceholderExplorer from "@/components/PlaceholderExplorer";
import TemplateEditorDrawer from "@/components/TemplateEditorDrawer";
import LlmSyncCheckModal from "@/components/LlmSyncCheckModal";
import { adminBtn, statusBadge } from "@/lib/admin-ui";

type StatusMessage = { kind: "success" | "error"; text: string };

const CATEGORY_LABELS: Record<string, string> = {
  essential_pack: "Essential Pack",
  high_impact_addons: "High-Impact Add-ons",
  premium_documents: "Premium",
};

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

export default function AdminDocumentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [llmModels, setLlmModels] = useState<LlmModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const [editorTemplateId, setEditorTemplateId] = useState<number | null>(null);

  const editorTemplate = useMemo(
    () => templates.find((t) => t.id === editorTemplateId) ?? null,
    [templates, editorTemplateId]
  );

  // Map from DocumentType.key to its category (for the table to show category).
  const typeCategoryByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of documentTypes) map.set(t.key, t.category);
    return map;
  }, [documentTypes]);

  // LLM models grouped by provider (used by the management panel).
  const llmByProvider = useMemo(() => {
    const map: Record<string, LlmModel[]> = {};
    for (const m of llmModels) {
      if (!map[m.provider]) map[m.provider] = [];
      map[m.provider].push(m);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [llmModels]);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [tpl, dt, lm] = await Promise.all([
        api.getDocumentTemplates(),
        api.listDocumentTypes(true), // admin sees inactive too
        api.listLlmModels(true),
      ]);
      setTemplates(tpl);
      setDocumentTypes(dt);
      setLlmModels(lm);
    } catch (error) {
      console.error(error);
      setStatus({ kind: "error", text: "Fehler beim Laden der Daten." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && (!user || !user.is_admin)) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.is_admin) {
      loadAll();
    }
  }, [user, loadAll]);

  // Auto-dismiss toast after 5 seconds. Errors stay a bit longer (8 s) so the
  // admin has time to read them.
  useEffect(() => {
    if (!status) return;
    const ms = status.kind === "error" ? 8000 : 5000;
    const handle = setTimeout(() => setStatus(null), ms);
    return () => clearTimeout(handle);
  }, [status]);

  const [advancedSeedOpen, setAdvancedSeedOpen] = useState(false);

  /**
   * Initial-Seed: runs both seeders in the right order (catalog first so
   * templates can reference doc_type keys, then template prompts). This is
   * the button a non-developer admin should use; the force-update and
   * individual seeders are hidden behind an "Erweitert" section.
   */
  const handleInitialSeed = async () => {
    setSeeding(true);
    try {
      const catalog = await api.seedCatalog(false);
      const prompts = await api.seedDocumentTemplates(false);
      setStatus({
        kind: "success",
        text:
          `Seed abgeschlossen — Dokumenttypen: +${catalog.document_types.created}, ` +
          `LLM-Modelle: +${catalog.llm_models.created}, ` +
          `Template-Prompts: +${prompts.created} (${prompts.skipped} bereits vorhanden).`,
      });
      await loadAll();
    } catch (error) {
      console.error(error);
      setStatus({ kind: "error", text: "Initial-Seed fehlgeschlagen." });
    } finally {
      setSeeding(false);
    }
  };

  const handleSeedCatalog = async (forceUpdate: boolean) => {
    setSeeding(true);
    try {
      const result = await api.seedCatalog(forceUpdate);
      setStatus({
        kind: "success",
        text: `Katalog geseedet: Dokumenttypen +${result.document_types.created}/~${result.document_types.updated}, LLM-Modelle +${result.llm_models.created}/~${result.llm_models.updated}.`,
      });
      await loadAll();
    } catch (error) {
      console.error(error);
      setStatus({ kind: "error", text: "Seed fehlgeschlagen." });
    } finally {
      setSeeding(false);
    }
  };

  const handleSeedLegacyTemplates = async (forceUpdate: boolean) => {
    setSeeding(true);
    try {
      const result = await api.seedDocumentTemplates(forceUpdate);
      setStatus({
        kind: "success",
        text: `Template-Prompts: ${result.created} erstellt, ${result.updated} aktualisiert, ${result.skipped} übersprungen.`,
      });
      await loadAll();
    } catch (error) {
      console.error(error);
      setStatus({ kind: "error", text: "Seed der Prompts fehlgeschlagen." });
    } finally {
      setSeeding(false);
    }
  };

  const handleSaveTemplate = async (updates: DocumentTemplateUpdate) => {
    if (!editorTemplate) return;
    await api.updateDocumentTemplate(editorTemplate.id, updates);
    await loadAll();
    setEditorTemplateId(null);
    setStatus({ kind: "success", text: "Template gespeichert." });
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto p-6" aria-busy="true">
        <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-800 animate-pulse mb-4" />
        <div className="space-y-3">
          <div className="h-32 w-full rounded bg-gray-100 dark:bg-gray-900 animate-pulse" />
          <div className="h-32 w-full rounded bg-gray-100 dark:bg-gray-900 animate-pulse" />
          <div className="h-32 w-full rounded bg-gray-100 dark:bg-gray-900 animate-pulse" />
        </div>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Vorlagen und LLM-Modelle werden geladen…
        </p>
      </div>
    );
  }

  if (!user?.is_admin) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Dokument-Vorlagen verwalten
        </h1>
        <button
          onClick={() => router.push("/admin")}
          className={adminBtn.secondary("lg")}
        >
          <span aria-hidden="true">←</span> Zurück zur Admin-Konsole
        </button>
      </header>

      {/* === Template-Übersicht (kompakte Tabelle, Editor im Drawer) === */}
      <section className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Vorlagen
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              Klicken Sie auf <em>Bearbeiten</em>, um Credits, Sprachquelle, LLM-Modell
              und Prompt in einem fokussierten Editor anzupassen.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={handleInitialSeed}
              disabled={seeding}
              className={adminBtn.primary("lg")}
              title="Lädt alle Dokumenttypen, LLM-Modelle und Prompts aus dem Standardkatalog. Idempotent — sicher wiederholbar."
            >
              {seeding ? "Wird geladen..." : "Standardvorlagen laden"}
            </button>
            <button
              type="button"
              onClick={() => setAdvancedSeedOpen((o) => !o)}
              className="text-xs text-gray-600 dark:text-gray-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1"
              aria-expanded={advancedSeedOpen}
            >
              {advancedSeedOpen ? "Erweitert ausblenden" : "Erweitert…"}
            </button>
            {advancedSeedOpen && (
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  onClick={() => handleSeedCatalog(true)}
                  disabled={seeding}
                  className={adminBtn.warning("md")}
                  title="Überschreibt bestehende Dokumenttypen und LLM-Modelle mit den Code-Werten (destruktiv)."
                >
                  Katalog force-update
                </button>
                <button
                  onClick={() => handleSeedLegacyTemplates(true)}
                  disabled={seeding}
                  className={adminBtn.warning("md")}
                  title="Überschreibt bestehende Prompts mit document_prompts.json (destruktiv)."
                >
                  Prompts force-update
                </button>
              </div>
            )}
          </div>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Keine Vorlagen gefunden.</p>
            <p className="text-sm mt-2">
              Klicken Sie oben rechts auf <strong>„Standardvorlagen laden"</strong>,
              um die Dokumenttypen, LLM-Modelle und Prompts aus dem
              Standardkatalog zu importieren.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-left">
                  <th className="p-3 font-semibold text-gray-900 dark:text-gray-100">
                    Dokumenttyp
                  </th>
                  <th className="p-3 font-semibold text-gray-900 dark:text-gray-100">
                    Kategorie
                  </th>
                  <th className="p-3 font-semibold text-gray-900 dark:text-gray-100">
                    Credits
                  </th>
                  <th className="p-3 font-semibold text-gray-900 dark:text-gray-100">
                    LLM
                  </th>
                  <th className="p-3 font-semibold text-gray-900 dark:text-gray-100">
                    Aktiv
                  </th>
                  <th className="p-3 font-semibold text-gray-900 dark:text-gray-100">
                    Aktion
                  </th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => {
                  const category = typeCategoryByKey.get(template.doc_type);
                  return (
                    <tr
                      key={template.id}
                      className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                    >
                      <td className="p-3">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {template.display_name}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                          {template.doc_type}
                        </div>
                      </td>
                      <td className="p-3 text-gray-900 dark:text-gray-100">
                        {category ? CATEGORY_LABELS[category] ?? category : "—"}
                      </td>
                      <td className="p-3 font-mono text-gray-900 dark:text-gray-100">
                        {template.credit_cost}
                      </td>
                      <td className="p-3 text-gray-900 dark:text-gray-100">
                        <div className="text-xs">
                          {PROVIDER_LABELS[template.llm_provider as LlmProvider] ??
                            template.llm_provider}
                        </div>
                        <div className="text-xs font-mono text-gray-600 dark:text-gray-400">
                          {template.llm_model}
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={
                            template.is_active ? statusBadge.active : statusBadge.inactive
                          }
                        >
                          <span aria-hidden="true">
                            {template.is_active ? "●" : "○"}
                          </span>
                          {template.is_active ? "Aktiv" : "Inaktiv"}
                        </span>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => setEditorTemplateId(template.id)}
                          className={adminBtn.primary("md")}
                        >
                          Bearbeiten
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* === LLM-Modelle verwalten === */}
      <LlmModelsManager
        models={llmModels}
        modelsByProvider={llmByProvider}
        onRefresh={loadAll}
        setStatus={setStatus}
      />

      {/* === Dokumenttypen verwalten === */}
      <DocumentTypesManager
        types={documentTypes}
        onRefresh={loadAll}
        setStatus={setStatus}
        onDraftTemplateCreated={(id) => setEditorTemplateId(id)}
      />

      {/* Placeholder Explorer */}
      <PlaceholderExplorer />

      {/* Drawer-Editor für das ausgewählte Template */}
      <TemplateEditorDrawer
        isOpen={editorTemplateId !== null}
        template={editorTemplate}
        llmModels={llmModels}
        onClose={() => setEditorTemplateId(null)}
        onSave={handleSaveTemplate}
      />

      {/* Status-Toast — fixed bottom-right, auto-dismiss via useEffect.
          Positioned outside the scrollable content so it is always visible
          regardless of scroll position, which matters for confirmations on
          actions at the bottom of the page (e.g. deleting a document type). */}
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

// ===========================================================================
// LLM Models Manager
// ===========================================================================

function LlmModelsManager({
  models,
  modelsByProvider,
  onRefresh,
  setStatus,
}: {
  models: LlmModel[];
  modelsByProvider: Record<string, LlmModel[]>;
  onRefresh: () => Promise<void>;
  setStatus: (s: StatusMessage) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [draft, setDraft] = useState<LlmModelCreate>({
    provider: "openai",
    model_id: "",
    display_name: "",
    is_active: true,
  });

  const handleCreate = async () => {
    if (!draft.model_id.trim() || !draft.display_name.trim()) {
      setStatus({ kind: "error", text: "Modell-ID und Anzeigename sind Pflicht." });
      return;
    }
    try {
      await api.createLlmModel(draft);
      setStatus({ kind: "success", text: "LLM-Modell hinzugefügt." });
      setDraft({
        provider: "openai",
        model_id: "",
        display_name: "",
        is_active: true,
      });
      setFormOpen(false);
      await onRefresh();
    } catch (e) {
      setStatus({
        kind: "error",
        text:
          e instanceof Error
            ? e.message
            : "Modell konnte nicht angelegt werden.",
      });
    }
  };

  const handleToggleActive = async (model: LlmModel) => {
    // Deactivating a model makes it unavailable in the template editor. Any
    // template already pointing at this model keeps working until an admin
    // changes it, but the model will no longer be offered for new templates.
    // Activating is non-destructive and does not need a confirm.
    if (
      model.is_active &&
      !window.confirm(
        `Modell ${model.provider}/${model.model_id} deaktivieren? ` +
          "Es wird im Template-Editor nicht mehr als Auswahl angeboten. " +
          "Bestehende Templates, die dieses Modell referenzieren, laufen weiter."
      )
    ) {
      return;
    }
    try {
      await api.updateLlmModel(model.id, { is_active: !model.is_active });
      await onRefresh();
    } catch (e) {
      setStatus({
        kind: "error",
        text:
          e instanceof Error
            ? e.message
            : "Modell konnte nicht aktualisiert werden.",
      });
    }
  };

  const handleDelete = async (model: LlmModel) => {
    if (
      !window.confirm(
        `Modell ${model.provider}/${model.model_id} wirklich löschen?`
      )
    )
      return;
    try {
      await api.deleteLlmModel(model.id);
      setStatus({ kind: "success", text: "LLM-Modell gelöscht." });
      await onRefresh();
    } catch (e) {
      setStatus({
        kind: "error",
        text:
          e instanceof Error ? e.message : "Modell konnte nicht gelöscht werden.",
      });
    }
  };

  return (
    <section className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-800">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            LLM-Modelle
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Liste der verfügbaren Modelle. Werden im Template-Editor als Auswahl
            angeboten. Neue Modelle können Sie hier ohne Deployment hinzufügen — oder
            über <em>LLM-Update prüfen</em> direkt von den Providern laden.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setSyncModalOpen(true)}
            className={
              "inline-flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium " +
              "bg-purple-600 text-white hover:bg-purple-700 transition-colors " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 " +
              "focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
            }
            title="Prüft live bei OpenAI, Anthropic und Google auf veraltete und neue Modelle."
          >
            LLM-Update prüfen
          </button>
          <button
            onClick={() => setFormOpen((o) => !o)}
            className={adminBtn.primary("md")}
          >
            {formOpen ? "Abbrechen" : "Neues Modell"}
          </button>
        </div>
      </div>

      {formOpen && (
        <div className="rounded border border-gray-200 dark:border-gray-800 p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Provider
            </span>
            <select
              value={draft.provider}
              onChange={(e) =>
                setDraft({ ...draft, provider: e.target.value as LlmProvider })
              }
              className="rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Modell-ID (API)
            </span>
            <input
              type="text"
              value={draft.model_id}
              onChange={(e) => setDraft({ ...draft, model_id: e.target.value })}
              placeholder="z.B. gpt-5.3"
              className="rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm font-mono"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Anzeigename
            </span>
            <input
              type="text"
              value={draft.display_name}
              onChange={(e) =>
                setDraft({ ...draft, display_name: e.target.value })
              }
              placeholder="z.B. GPT-5.3"
              className="rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </label>
          <div className="sm:col-span-2 flex justify-end">
            <button
              onClick={handleCreate}
              className={adminBtn.success("lg")}
            >
              Speichern
            </button>
          </div>
        </div>
      )}

      {models.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Noch keine LLM-Modelle hinterlegt. Klicken Sie oben rechts auf
          <strong> „Standardvorlagen laden"</strong>, um die Standardliste zu laden.
        </p>
      ) : (
        <div className="space-y-4">
          {(Object.keys(modelsByProvider) as LlmProvider[]).map((provider) => (
            <div key={provider}>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                {PROVIDER_LABELS[provider] ?? provider}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {modelsByProvider[provider].map((m) => (
                  <div
                    key={m.id}
                    className={
                      "flex items-center justify-between gap-2 rounded border px-3 py-2 text-sm " +
                      (m.is_active
                        ? "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                        : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40")
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {m.display_name}
                        </span>
                        <span
                          className={
                            m.is_active ? statusBadge.active : statusBadge.inactive
                          }
                        >
                          <span aria-hidden="true">
                            {m.is_active ? "●" : "○"}
                          </span>
                          {m.is_active ? "Aktiv" : "Inaktiv"}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate">
                        {m.model_id}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleToggleActive(m)}
                        className={adminBtn.secondary("sm")}
                        aria-label={
                          m.is_active
                            ? `Modell ${m.display_name} deaktivieren`
                            : `Modell ${m.display_name} aktivieren`
                        }
                      >
                        {m.is_active ? "Deaktivieren" : "Aktivieren"}
                      </button>
                      <button
                        onClick={() => handleDelete(m)}
                        className={adminBtn.dangerSubtle("sm")}
                        aria-label={`Modell ${m.display_name} löschen`}
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <LlmSyncCheckModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        onChanged={onRefresh}
        setStatus={setStatus}
      />
    </section>
  );
}

// ===========================================================================
// Document Types Manager (compact)
// ===========================================================================

function DocumentTypesManager({
  types,
  onRefresh,
  setStatus,
  onDraftTemplateCreated,
}: {
  types: DocumentType[];
  onRefresh: () => Promise<void>;
  setStatus: (s: StatusMessage) => void;
  /** Called after a new DocumentType was created and a draft template was
   *  auto-attached. The parent uses this to open the drawer on the draft. */
  onDraftTemplateCreated: (templateId: number) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<DocumentTypeCreate>({
    key: "",
    title: "",
    description: "",
    outputs: ["PDF"],
    category: "essential_pack",
    is_active: true,
  });

  const grouped = useMemo(() => {
    const map: Record<string, DocumentType[]> = {};
    for (const t of types) {
      if (!map[t.category]) map[t.category] = [];
      map[t.category].push(t);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [types]);

  const handleToggleActive = async (dt: DocumentType) => {
    // Deactivation is user-visible: the document type disappears from the
    // user's generation picker (see get_document_catalog_for_api on the
    // backend), so require confirmation.
    if (
      dt.is_active &&
      !window.confirm(
        `"${dt.title}" (${dt.key}) deaktivieren? ` +
          "Der Typ verschwindet sofort aus der Benutzeroberfläche. " +
          "Bereits generierte Dokumente dieses Typs bleiben erhalten."
      )
    ) {
      return;
    }
    try {
      await api.updateDocumentType(dt.id, { is_active: !dt.is_active });
      await onRefresh();
    } catch (e) {
      setStatus({
        kind: "error",
        text:
          e instanceof Error
            ? e.message
            : "Dokumenttyp konnte nicht aktualisiert werden.",
      });
    }
  };

  const handleDelete = async (dt: DocumentType) => {
    if (
      !window.confirm(
        `Dokumenttyp "${dt.title}" (${dt.key}) wirklich löschen? ` +
          "Vorhandene Templates mit diesem Key werden verwaist."
      )
    ) {
      return;
    }
    try {
      await api.deleteDocumentType(dt.id);
      setStatus({ kind: "success", text: "Dokumenttyp gelöscht." });
      await onRefresh();
    } catch (e) {
      setStatus({
        kind: "error",
        text:
          e instanceof Error
            ? e.message
            : "Dokumenttyp konnte nicht gelöscht werden.",
      });
    }
  };

  const handleCreate = async () => {
    const keyTrim = draft.key.trim();
    const titleTrim = draft.title.trim();
    if (!keyTrim || !titleTrim) {
      setStatus({ kind: "error", text: "Key und Titel sind Pflicht." });
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(keyTrim)) {
      setStatus({
        kind: "error",
        text: "Key muss mit Kleinbuchstabe starten und darf nur a-z, 0-9 und Unterstrich enthalten.",
      });
      return;
    }
    try {
      const result = await api.createDocumentType({
        ...draft,
        key: keyTrim,
        title: titleTrim,
        create_draft_template: true,
      });
      setStatus({
        kind: "success",
        text:
          "Dokumenttyp wurde angelegt. Ein Vorlagen-Entwurf wurde vorbereitet — " +
          "passen Sie im Editor Prompt und LLM an, und aktivieren Sie die Vorlage anschliessend.",
      });
      setDraft({
        key: "",
        title: "",
        description: "",
        outputs: ["PDF"],
        category: "essential_pack",
        is_active: true,
      });
      setFormOpen(false);
      await onRefresh();
      if (result.draft_template_id !== null) {
        onDraftTemplateCreated(result.draft_template_id);
      }
    } catch (e) {
      setStatus({
        kind: "error",
        text:
          e instanceof Error
            ? e.message
            : "Dokumenttyp konnte nicht angelegt werden.",
      });
    }
  };

  return (
    <section className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-800">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Dokumenttypen
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Das Modell: welche Dokumente die Plattform überhaupt generieren kann.
            Neue Typen können Sie hier direkt anlegen — beim Speichern wird
            automatisch ein inaktiver Vorlagen-Entwurf mit Standard-Prompt
            angelegt, den Sie danach im Editor anpassen.
          </p>
        </div>
        <button
          onClick={() => setFormOpen((o) => !o)}
          className={`${adminBtn.primary("md")} flex-shrink-0`}
        >
          {formOpen ? "Abbrechen" : "Neuer Typ"}
        </button>
      </div>

      {formOpen && (
        <div className="rounded border border-gray-200 dark:border-gray-800 p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-900 dark:text-blue-200">
            <strong>Ablauf:</strong> Nach dem Speichern wird automatisch ein
            inaktiver Vorlagen-Entwurf mit Standard-Prompt erstellt. Der
            Editor öffnet sich direkt — passen Sie dort Prompt, LLM und Credits an
            und setzen Sie die Vorlage dann auf <em>aktiv</em>.
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Key (Maschinenlesbar, snake_case)
            </span>
            <input
              type="text"
              value={draft.key}
              onChange={(e) => setDraft({ ...draft, key: e.target.value })}
              placeholder="z.B. salary_expectation_pdf"
              className="rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm font-mono"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Titel (angezeigt)
            </span>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="z.B. Lohnvorstellung (PDF)"
              className="rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Kategorie
            </span>
            <select
              value={draft.category}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  category: e.target.value as DocumentCategory,
                })
              }
              className="rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              <option value="essential_pack">Essential Pack</option>
              <option value="high_impact_addons">High-Impact Add-ons</option>
              <option value="premium_documents">Premium</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Outputs (komma-separiert, z.B. PDF, DOCX)
            </span>
            <input
              type="text"
              value={(draft.outputs ?? []).join(", ")}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  outputs: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="PDF"
              className="rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm font-mono"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Beschreibung (optional)
            </span>
            <textarea
              value={draft.description ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              rows={2}
              placeholder="Kurze Beschreibung für Admins und Endnutzer."
              className="rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </label>
          <div className="sm:col-span-2 flex justify-end">
            <button
              onClick={handleCreate}
              className={adminBtn.success("lg")}
            >
              Speichern
            </button>
          </div>
        </div>
      )}

      {types.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Keine Dokumenttypen vorhanden. Klicken Sie oben rechts auf
          <strong> „Standardvorlagen laden"</strong>, um den Standardkatalog zu laden.
        </p>
      ) : (
        <div className="space-y-4">
          {Object.keys(grouped)
            .sort()
            .map((cat) => (
              <div key={cat}>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                  {CATEGORY_LABELS[cat] ?? cat}
                </h3>
                <div className="space-y-1">
                  {grouped[cat].map((t) => (
                    <div
                      key={t.id}
                      className={
                        "flex items-center justify-between gap-2 rounded border px-3 py-2 text-sm " +
                        (t.is_active
                          ? "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                          : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40")
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {t.title}
                          </span>
                          <span
                            className={
                              t.is_active ? statusBadge.active : statusBadge.inactive
                            }
                          >
                            <span aria-hidden="true">
                              {t.is_active ? "●" : "○"}
                            </span>
                            {t.is_active ? "Aktiv" : "Inaktiv"}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate">
                          {t.key} · outputs: {t.outputs.join(", ") || "—"}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleToggleActive(t)}
                          className={adminBtn.secondary("sm")}
                          aria-label={
                            t.is_active
                              ? `Dokumenttyp ${t.title} deaktivieren`
                              : `Dokumenttyp ${t.title} aktivieren`
                          }
                        >
                          {t.is_active ? "Deaktivieren" : "Aktivieren"}
                        </button>
                        <button
                          onClick={() => handleDelete(t)}
                          className={adminBtn.dangerSubtle("sm")}
                          aria-label={`Dokumenttyp ${t.title} löschen`}
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
