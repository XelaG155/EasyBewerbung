"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import api, { DocumentTemplate, DocumentTemplateUpdate } from "@/lib/api";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

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
        <Button onClick={() => router.push("/admin")} variant="outline">
          Zurück zu Admin
        </Button>
      </div>

      {status && (
        <div className="rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-4 py-2 text-sm" role="status">
          {status}
        </div>
      )}

      <Card>
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
            <Button onClick={() => handleSeed(false)} disabled={seeding} variant="outline">
              {seeding ? "Seeding..." : "Seed Templates"}
            </Button>
            <Button onClick={() => handleSeed(true)} disabled={seeding} variant="outline">
              {seeding ? "Seeding..." : "Force Update"}
            </Button>
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
                <tr className="border-b border-gray-200 dark:border-gray-700">
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
                    <tr key={template.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-3">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{template.doc_type}</div>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.display_name || ""}
                            onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                            className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm bg-white dark:bg-gray-800"
                          />
                        ) : (
                          <div className="text-xs text-gray-500 dark:text-gray-400">{template.display_name}</div>
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
                            className="w-16 rounded border border-gray-300 dark:border-gray-600 px-2 py-1 bg-white dark:bg-gray-800"
                          />
                        ) : (
                          <span className="font-mono">{template.credit_cost}</span>
                        )}
                      </td>

                      {/* Language Source */}
                      <td className="p-3">
                        {isEditing ? (
                          <select
                            value={editForm.language_source || "documentation_language"}
                            onChange={(e) => setEditForm({ ...editForm, language_source: e.target.value as DocumentTemplateUpdate["language_source"] })}
                            className="rounded border border-gray-300 dark:border-gray-600 px-2 py-1 bg-white dark:bg-gray-800"
                          >
                            <option value="preferred_language">Preferred Language</option>
                            <option value="mother_tongue">Mother Tongue</option>
                            <option value="documentation_language">Documentation Language</option>
                          </select>
                        ) : (
                          <span className="text-xs">{template.language_source.replace(/_/g, " ")}</span>
                        )}
                      </td>

                      {/* LLM Provider */}
                      <td className="p-3">
                        {isEditing ? (
                          <select
                            value={editForm.llm_provider || "openai"}
                            onChange={(e) => setEditForm({ ...editForm, llm_provider: e.target.value })}
                            className="rounded border border-gray-300 dark:border-gray-600 px-2 py-1 bg-white dark:bg-gray-800"
                          >
                            <option value="openai">OpenAI</option>
                            <option value="anthropic">Anthropic (Claude)</option>
                            <option value="google">Google (Gemini)</option>
                          </select>
                        ) : (
                          <span className="capitalize">{template.llm_provider}</span>
                        )}
                      </td>

                      {/* LLM Model */}
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.llm_model || ""}
                            onChange={(e) => setEditForm({ ...editForm, llm_model: e.target.value })}
                            className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1 bg-white dark:bg-gray-800"
                            placeholder="z.B. gpt-4"
                          />
                        ) : (
                          <span className="font-mono text-xs">{template.llm_model}</span>
                        )}
                      </td>

                      {/* Prompt */}
                      <td className="p-3 max-w-xs">
                        {isEditing ? (
                          <textarea
                            value={editForm.prompt_template || ""}
                            onChange={(e) => setEditForm({ ...editForm, prompt_template: e.target.value })}
                            className="w-full rounded border border-gray-300 dark:border-gray-600 px-2 py-1 bg-white dark:bg-gray-800 text-xs"
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
                              <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto max-h-60 whitespace-pre-wrap">
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
                              className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs hover:bg-gray-300 dark:hover:bg-gray-600"
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
      </Card>

      {/* Help Section */}
      <Card>
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
            <strong className="text-gray-900 dark:text-gray-100">LLM Provider:</strong> Der KI-Anbieter für die Generierung.
            <ul className="list-disc ml-5 mt-1">
              <li><code>openai</code> - OpenAI (GPT-4, etc.)</li>
              <li><code>anthropic</code> - Anthropic (Claude)</li>
              <li><code>google</code> - Google (Gemini)</li>
            </ul>
          </div>
          <div>
            <strong className="text-gray-900 dark:text-gray-100">Prompt Template:</strong> Der Prompt für die LLM-Generierung.
            Verwende <code>{"{language}"}</code> als Platzhalter für die dynamische Sprache.
          </div>
        </div>
      </Card>
    </div>
  );
}
