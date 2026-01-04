"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import api, { DocumentTemplate, DocumentTemplateUpdate } from "@/lib/api";
import PromptBuilderModal from "@/components/PromptBuilderModal";

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
  const [promptBuilderOpen, setPromptBuilderOpen] = useState(false);

  // Available models for each provider (as of Jan 2026)
  const availableModels: Record<string, string[]> = {
    openai: [
      // GPT-5.2 Series (latest)
      "gpt-5.2",
      "gpt-5.2-pro",
      "gpt-5.2-mini",
      "gpt-5.2-nano",
      // GPT-5.1 Series
      "gpt-5.1",
      "gpt-5.1-mini",
      // GPT-5 Base
      "gpt-5",
      "gpt-5-mini",
      // GPT-4o Series (multimodal)
      "gpt-4o",
      "gpt-4o-mini"
    ],
    anthropic: [
      // Claude 4.5 Series (latest)
      "claude-opus-4-5-20251101",
      "claude-sonnet-4-5-20250929",
      "claude-haiku-4-5-20251001",
      // Claude 4.1 Series
      "claude-opus-4-1-20250805",
      // Claude 3.5 Series
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      // Claude 3 Series (legacy)
      "claude-3-opus-20240229"
    ],
    google: [
      // Gemini 3 (latest preview)
      "gemini-3-pro-preview",
      // Gemini 2.5 (stable)
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      // Gemini 2.0
      "gemini-2.0-flash-exp",
      "gemini-2.0-flash",
      // Gemini 1.5 (legacy)
      "gemini-1.5-pro",
      "gemini-1.5-flash"
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
                          <div className="space-y-2">
                            <textarea
                              value={editForm.prompt_template || ""}
                              onChange={(e) => setEditForm({ ...editForm, prompt_template: e.target.value })}
                              className="w-full rounded border border-gray-200 dark:border-gray-800 px-2 py-1 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs"
                              rows={6}
                              placeholder="Prompt template mit {language} placeholder"
                            />
                            <button
                              onClick={() => setPromptBuilderOpen(true)}
                              type="button"
                              className="px-2 py-1 rounded bg-purple-600 text-white text-xs hover:bg-purple-700 flex items-center gap-1"
                            >
                              <span>🪄</span> Prompt Builder
                            </button>
                          </div>
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
              <li><code>openai</code> - OpenAI: gpt-5.2, gpt-5.2-pro, gpt-5.2-mini, gpt-5.2-nano, gpt-5.1, gpt-5, gpt-4o</li>
              <li><code>anthropic</code> - Anthropic (Claude): claude-opus-4-5, claude-sonnet-4-5, claude-haiku-4-5, claude-3-5-sonnet</li>
              <li><code>google</code> - Google (Gemini): gemini-3-pro-preview, gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Placeholder Reference Section */}
      <section className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Verfügbare Platzhalter für Prompt Templates</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Diese Platzhalter werden bei der Dokumentgenerierung automatisch mit den echten Daten ersetzt:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left p-2 font-semibold text-gray-900 dark:text-gray-100">Platzhalter</th>
                <th className="text-left p-2 font-semibold text-gray-900 dark:text-gray-100">Beschreibung</th>
                <th className="text-left p-2 font-semibold text-gray-900 dark:text-gray-100">Beispiel</th>
              </tr>
            </thead>
            <tbody className="text-gray-600 dark:text-gray-400">
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-2"><code className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1 rounded">{"{role}"}</code></td>
                <td className="p-2">KI-Rolle/Persona</td>
                <td className="p-2 text-xs">&quot;experienced career coach&quot;</td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-2"><code className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1 rounded">{"{task}"}</code></td>
                <td className="p-2">Hauptaufgabe</td>
                <td className="p-2 text-xs">&quot;Write a professional cover letter&quot;</td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-2"><code className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-1 rounded">{"{job_description}"}</code></td>
                <td className="p-2">Stellenbeschreibung + Kontext</td>
                <td className="p-2 text-xs">Jobanforderungen, Firma, Bewerbungstyp</td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-2"><code className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-1 rounded">{"{cv_text}"}</code></td>
                <td className="p-2">Vollständiger CV-Text</td>
                <td className="p-2 text-xs">Gesamter Inhalt des hochgeladenen CVs</td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-2"><code className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-1 rounded">{"{cv_summary}"}</code></td>
                <td className="p-2">CV-Kurzfassung (2000 Zeichen)</td>
                <td className="p-2 text-xs">Kurzübersicht der Qualifikationen</td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-2"><code className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-1 rounded">{"{language}"}</code></td>
                <td className="p-2">Zielsprache für Dokument</td>
                <td className="p-2 text-xs">&quot;German&quot;, &quot;English&quot;, &quot;French&quot;</td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-2"><code className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-1 rounded">{"{documentation_language}"}</code></td>
                <td className="p-2">Dokumentationssprache des Users</td>
                <td className="p-2 text-xs">Wie {"{language}"}</td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-2"><code className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-1 rounded">{"{company_profile_language}"}</code></td>
                <td className="p-2">Sprache für Firmenprofil</td>
                <td className="p-2 text-xs">Für Company Intelligence Dokumente</td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-2"><code className="bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-1 rounded">{"{instructions}"}</code></td>
                <td className="p-2">Formatierte Anweisungsliste</td>
                <td className="p-2 text-xs">Nummerierte Liste aller Regeln</td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-2"><code className="bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-1 rounded">{"{reference_letters}"}</code></td>
                <td className="p-2">Referenzschreiben-Inhalt</td>
                <td className="p-2 text-xs">Text der hochgeladenen Referenzen</td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-2"><code className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-1 rounded">{"{doc_type}"}</code></td>
                <td className="p-2">Technischer Dokumenttyp</td>
                <td className="p-2 text-xs">&quot;cover_letter&quot;, &quot;tailored_cv_pdf&quot;, &quot;motivation_letter&quot;</td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-2"><code className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-1 rounded">{"{doc_type_display}"}</code></td>
                <td className="p-2">Anzeigename des Dokuments</td>
                <td className="p-2 text-xs">&quot;Anschreiben&quot;, &quot;Tailored CV PDF&quot;, &quot;Motivationsschreiben&quot;</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            <strong className="text-gray-900 dark:text-gray-100">Automatisch hinzugefügt (keine Platzhalter nötig):</strong>
          </p>
          <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc ml-4 space-y-1">
            <li>Bewerbungstyp (Vollzeit / Praktikum / Lehrstelle)</li>
            <li>Beschäftigungsstatus des Users</li>
            <li>Ausbildungstyp des Users</li>
            <li>Zusätzlicher Profilkontext</li>
          </ul>
        </div>
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-gray-700 dark:text-gray-300">
            <strong>Beispiel-Prompt:</strong>
          </p>
          <pre className="mt-2 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono">
{`You are a {role}. {task}.

Job Details:
{job_description}

Candidate CV:
{cv_text}

Language: {language}

IMPORTANT INSTRUCTIONS:
{instructions}

Begin the cover letter now:`}
          </pre>
        </div>
      </section>

      {/* Prompt Builder Modal */}
      <PromptBuilderModal
        isOpen={promptBuilderOpen}
        onClose={() => setPromptBuilderOpen(false)}
        onApply={(generatedPrompt) => {
          setEditForm({ ...editForm, prompt_template: generatedPrompt });
        }}
        currentProvider={editForm.llm_provider || "openai"}
        currentModel={editForm.llm_model || "gpt-4o"}
        availableModels={availableModels}
      />
    </div>
  );
}
