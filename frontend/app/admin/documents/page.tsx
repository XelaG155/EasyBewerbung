"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import api, { DocumentTemplate, DocumentTemplateUpdate } from "@/lib/api";

export default function AdminDocumentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<DocumentTemplateUpdate>({});
  const [expandedPrompt, setExpandedPrompt] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Available models for each provider (as of Dec 2025)
  const availableModels: Record<string, string[]> = {
    openai: [
      // GPT-5 Series (latest)
      "gpt-5.1",
      "gpt-5",
      "gpt-5-mini",
      "gpt-5-nano",
      "gpt-5-pro",
      // GPT-4o Series (multimodal)
      "gpt-4o",
      "gpt-4o-2024-05-13",
      "gpt-4o-mini"
    ],
    anthropic: [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307"
    ],
    google: [
      // Gemini 3 (latest)
      "gemini-3-pro-preview",
      // Gemini 2.5 (stable)
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      // Gemini 2.0
      "gemini-2.0-flash-exp",
      "gemini-2.0-flash"
    ]
  };

  useEffect(() => {
    if (!authLoading && (!user || !user.is_admin)) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.is_admin) {
      loadTemplates();
    }
  }, [user]);

  const loadTemplates = async () => {
    try {
      const data = await api.getDocumentTemplates();
      setTemplates(data);
    } catch (error) {
      console.error("Failed to load templates:", error);
      setStatus("Fehler beim Laden der Templates.");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (template: DocumentTemplate) => {
    setEditingId(template.id);
    setEditForm({
      display_name: template.display_name,
      credit_cost: template.credit_cost,
      language_source: template.language_source,
      llm_provider: template.llm_provider,
      llm_model: template.llm_model,
      prompt_template: template.prompt_template,
      is_active: template.is_active,
    });
  };

  const saveEdit = async (id: number) => {
    try {
      await api.updateDocumentTemplate(id, editForm);
      await loadTemplates();
      setEditingId(null);
      setEditForm({});
      setStatus("Template erfolgreich aktualisiert.");
    } catch (error) {
      console.error("Failed to update template:", error);
      setStatus("Fehler beim Aktualisieren des Templates.");
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSeed = async (forceUpdate: boolean = false) => {
    setSeeding(true);
    try {
      const result = await api.seedDocumentTemplates(forceUpdate);
      setStatus(`Seed abgeschlossen: ${result.created} erstellt, ${result.updated} aktualisiert, ${result.skipped} übersprungen.`);
      await loadTemplates();
    } catch (error) {
      console.error("Failed to seed templates:", error);
      setStatus("Fehler beim Seeden der Templates.");
    } finally {
      setSeeding(false);
    }
  };

  if (authLoading || loading) {
    return <div className="p-8 text-gray-700 dark:text-gray-200">Lade...</div>;
  }

  if (!user?.is_admin) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Document Templates Admin</h1>
        <button
          onClick={() => router.push("/admin")}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Zurück zu Admin
        </button>
      </div>

      {status && (
        <div className="rounded bg-green-100 text-green-800 px-4 py-2 text-sm" role="status">
          {status}
        </div>
      )}

      <section className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Dokumenten-Templates konfigurieren
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              Verwalte Credit-Kosten, Sprachquellen, LLM Provider und Prompts für jeden Dokumenttyp.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleSeed(false)}
              disabled={seeding}
              className="px-4 py-2 rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {seeding ? "Seeding..." : "Seed Templates"}
            </button>
            <button
              onClick={() => handleSeed(true)}
              disabled={seeding}
              className="px-4 py-2 rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {seeding ? "Seeding..." : "Force Update"}
            </button>
          </div>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Keine Templates gefunden.</p>
            <p className="text-sm mt-2">Klicke auf "Seed Templates" um die Templates aus dem Katalog zu laden.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="text-left p-3 font-semibold text-gray-900 dark:text-gray-100">Dokumenttyp</th>
                  <th className="text-left p-3 font-semibold text-gray-900 dark:text-gray-100">Credits</th>
                  <th className="text-left p-3 font-semibold text-gray-900 dark:text-gray-100">Sprachquelle</th>
                  <th className="text-left p-3 font-semibold text-gray-900 dark:text-gray-100">LLM Provider</th>
                  <th className="text-left p-3 font-semibold text-gray-900 dark:text-gray-100">Modell</th>
                  <th className="text-left p-3 font-semibold text-gray-900 dark:text-gray-100">Prompt</th>
                  <th className="text-left p-3 font-semibold text-gray-900 dark:text-gray-100">Aktiv</th>
                  <th className="text-left p-3 font-semibold text-gray-900 dark:text-gray-100">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => {
                  const isEditing = editingId === template.id;
                  const isExpanded = expandedPrompt === template.id;

                  return (
                    <tr key={template.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="p-3">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{template.doc_type}</div>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.display_name || ""}
                            onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                            className="mt-1 w-full rounded border border-gray-200 dark:border-gray-800 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                          />
                        ) : (
                          <div className="text-xs text-gray-600 dark:text-gray-400">{template.display_name}</div>
                        )}
                      </td>

                      {/* Credit Cost */}
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={editForm.credit_cost ?? 1}
                            onChange={(e) => setEditForm({ ...editForm, credit_cost: parseInt(e.target.value) })}
                            className="w-16 rounded border border-gray-200 dark:border-gray-800 px-2 py-1 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                          />
                        ) : (
                          <span className="font-mono text-gray-900 dark:text-gray-100">{template.credit_cost}</span>
                        )}
                      </td>

                      {/* Language Source */}
                      <td className="p-3">
                        {isEditing ? (
                          <select
                            value={editForm.language_source || "documentation_language"}
                            onChange={(e) => setEditForm({ ...editForm, language_source: e.target.value as DocumentTemplateUpdate["language_source"] })}
                            className="rounded border border-gray-200 dark:border-gray-800 px-2 py-1 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                          >
                            <option value="preferred_language">Preferred Language</option>
                            <option value="mother_tongue">Mother Tongue</option>
                            <option value="documentation_language">Documentation Language</option>
                          </select>
                        ) : (
                          <span className="text-xs text-gray-900 dark:text-gray-100">{template.language_source.replace(/_/g, " ")}</span>
                        )}
                      </td>

                      {/* LLM Provider */}
                      <td className="p-3">
                        {isEditing ? (
                          <select
                            value={editForm.llm_provider || "openai"}
                            onChange={(e) => {
                              const newProvider = e.target.value;
                              const firstModel = availableModels[newProvider]?.[0] || "";
                              setEditForm({ ...editForm, llm_provider: newProvider, llm_model: firstModel });
                            }}
                            className="rounded border border-gray-200 dark:border-gray-800 px-2 py-1 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                          >
                            <option value="openai">OpenAI</option>
                            <option value="anthropic">Anthropic (Claude)</option>
                            <option value="google">Google (Gemini)</option>
                          </select>
                        ) : (
                          <span className="capitalize text-gray-900 dark:text-gray-100">{template.llm_provider}</span>
                        )}
                      </td>

                      {/* LLM Model */}
                      <td className="p-3">
                        {isEditing ? (
                          <select
                            value={editForm.llm_model || ""}
                            onChange={(e) => setEditForm({ ...editForm, llm_model: e.target.value })}
                            className="w-full rounded border border-gray-200 dark:border-gray-800 px-2 py-1 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                          >
                            <option value="">Modell wählen...</option>
                            {availableModels[editForm.llm_provider || template.llm_provider]?.map((model) => (
                              <option key={model} value={model}>{model}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-mono text-xs text-gray-900 dark:text-gray-100">{template.llm_model}</span>
                        )}
                      </td>

                      {/* Prompt */}
                      <td className="p-3 max-w-xs">
                        {isEditing ? (
                          <textarea
                            value={editForm.prompt_template || ""}
                            onChange={(e) => setEditForm({ ...editForm, prompt_template: e.target.value })}
                            className="w-full rounded border border-gray-200 dark:border-gray-800 px-2 py-1 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs"
                            rows={6}
                            placeholder="Prompt template mit {language} placeholder"
                          />
                        ) : (
                          <div>
                            <button
                              onClick={() => setExpandedPrompt(isExpanded ? null : template.id)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs underline"
                            >
                              {isExpanded ? "Verbergen" : "Anzeigen"}
                            </button>
                            {isExpanded && (
                              <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded text-xs overflow-auto max-h-60 whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                                {template.prompt_template}
                              </pre>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Active Status */}
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="checkbox"
                            checked={editForm.is_active ?? true}
                            onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                            className="w-4 h-4 rounded"
                          />
                        ) : (
                          <span className={template.is_active ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                            {template.is_active ? "Ja" : "Nein"}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEdit(template.id)}
                              className="px-3 py-1 rounded bg-green-600 text-white text-xs hover:bg-green-700"
                            >
                              Speichern
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs hover:bg-gray-200 dark:hover:bg-gray-700"
                            >
                              Abbrechen
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(template)}
                            className="px-3 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700"
                          >
                            Bearbeiten
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Help Section */}
      <section className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Hilfe</h3>
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <strong className="text-gray-900 dark:text-gray-100">Credits:</strong> Kosten pro Dokumentgenerierung (0-10). 0 = kostenlos.
          </div>
          <div>
            <strong className="text-gray-900 dark:text-gray-100">Sprachquelle:</strong> Welches Benutzer-Sprachfeld für die Dokumentgenerierung verwendet wird.
            <ul className="list-disc ml-5 mt-1">
              <li><code>preferred_language</code> - Bevorzugte Sprache des Benutzers</li>
              <li><code>mother_tongue</code> - Muttersprache des Benutzers</li>
              <li><code>documentation_language</code> - Dokumentationssprache (Standard)</li>
            </ul>
          </div>
          <div>
            <strong className="text-gray-900 dark:text-gray-100">LLM Provider & Modelle:</strong> Der KI-Anbieter für die Generierung.
            <ul className="list-disc ml-5 mt-1">
              <li><code>openai</code> - OpenAI: gpt-5.1, gpt-5, gpt-5-mini, gpt-5-nano, gpt-5-pro, gpt-4o, gpt-4o-mini</li>
              <li><code>anthropic</code> - Anthropic (Claude): claude-3-5-sonnet, claude-3-5-haiku, claude-3-opus</li>
              <li><code>google</code> - Google (Gemini): gemini-3-pro-preview, gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash</li>
            </ul>
          </div>
          <div>
            <strong className="text-gray-900 dark:text-gray-100">Prompt Template:</strong> Der Prompt für die LLM-Generierung.
            Verwende <code>{"{language}"}</code> als Platzhalter für die dynamische Sprache.
          </div>
        </div>
      </section>
    </div>
  );
}
