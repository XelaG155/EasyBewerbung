"use client";

import { useState } from "react";
import api from "@/lib/api";

interface PromptBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (prompt: string) => void;
  currentProvider: string;
  currentModel: string;
  availableModels: Record<string, string[]>;
}

export default function PromptBuilderModal({
  isOpen,
  onClose,
  onApply,
  currentProvider,
  currentModel,
  availableModels,
}: PromptBuilderModalProps) {
  const [tone, setTone] = useState("formal");
  const [length, setLength] = useState("medium");
  const [focus, setFocus] = useState<string[]>(["qualifications", "motivation"]);
  const [audience, setAudience] = useState("hr_manager");
  const [description, setDescription] = useState("");
  const [llmProvider, setLlmProvider] = useState(currentProvider || "openai");
  const [llmModel, setLlmModel] = useState(currentModel || "gpt-4o");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPlaceholderHelp, setShowPlaceholderHelp] = useState(false);
  const [previewPrompt, setPreviewPrompt] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const toggleFocus = (value: string) => {
    if (focus.includes(value)) {
      setFocus(focus.filter((f) => f !== value));
    } else {
      setFocus([...focus, value]);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.generatePrompt({
        tone,
        length,
        focus,
        audience,
        description,
        llm_provider: llmProvider,
        llm_model: llmModel,
      });
      setGeneratedPrompt(result.generated_prompt);
    } catch (err) {
      setError("Fehler beim Generieren des Prompts. Bitte versuche es erneut.");
      console.error("Prompt generation error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (generatedPrompt) {
      onApply(generatedPrompt);
      onClose();
    }
  };

  const handlePreview = () => {
    if (!generatedPrompt) {
      setError("Bitte generiere zuerst einen Prompt.");
      return;
    }

    // Sample data for preview
    const sampleData = {
      role: "professional career consultant and CV/resume expert",
      task: "Help this candidate create compelling, honest, and effective job application documents",
      job_description: "Senior Software Engineer at TechCorp\n\nWe are looking for an experienced software engineer with 5+ years of experience in Python and web development. The ideal candidate should have strong problem-solving skills and experience with modern frameworks.",
      cv_text: "John Doe\nSoftware Engineer\n\nExperience:\n- 6 years of Python development\n- Expert in Django and FastAPI\n- Led team of 4 developers\n\nEducation:\n- M.Sc. Computer Science, ETH Zurich\n\nSkills: Python, JavaScript, React, PostgreSQL, Docker",
      cv_summary: "John Doe - Software Engineer with 6 years of Python development experience, expert in Django and FastAPI, led team of 4 developers...",
      language: "German - Write all content in German language",
      documentation_language: "German - Write all content in German language",
      company_profile_language: "German - Write all content in German language",
      instructions: "1. Focus on relevant experience\n2. Use professional tone\n3. Keep it concise\n4. Highlight key achievements\n5. Tailor to job requirements",
      reference_letters: "--- Reference Letter 1 ---\nJohn was an exceptional employee who consistently delivered high-quality work...\n\n--- Reference Letter 2 ---\nI highly recommend John for any senior engineering position..."
    };

    let preview = generatedPrompt;
    Object.entries(sampleData).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    });

    setPreviewPrompt(preview);
    setShowPreview(true);
  };

  const handleProviderChange = (provider: string) => {
    setLlmProvider(provider);
    const models = availableModels[provider];
    if (models && models.length > 0) {
      setLlmModel(models[0]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            🪄 Prompt Builder
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Structured Options */}
          <div className="grid grid-cols-2 gap-4">
            {/* Tone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tonalität
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full rounded border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="formal">Formell</option>
                <option value="friendly">Freundlich</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>

            {/* Length */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Länge
              </label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value)}
                className="w-full rounded border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="short">Kurz</option>
                <option value="medium">Mittel</option>
                <option value="detailed">Detailliert</option>
              </select>
            </div>
          </div>

          {/* Focus (Multi-select) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fokus
            </label>
            <div className="flex flex-wrap gap-3">
              {[
                { value: "qualifications", label: "Qualifikationen" },
                { value: "motivation", label: "Motivation" },
                { value: "soft_skills", label: "Soft Skills" },
              ].map((item) => (
                <label key={item.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={focus.includes(item.value)}
                    onChange={() => toggleFocus(item.value)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Audience */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Zielgruppe
            </label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full rounded border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="hr_manager">HR Manager</option>
              <option value="hiring_manager">Hiring Manager</option>
              <option value="ceo">CEO / Geschäftsführung</option>
              <option value="general">Allgemein</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Beschreibung (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschreibe in eigenen Worten, was das Dokument können soll..."
              rows={3}
              className="w-full rounded border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            />
          </div>

          {/* LLM Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                LLM Provider
              </label>
              <select
                value={llmProvider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full rounded border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="google">Google (Gemini)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Modell
              </label>
              <select
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                className="w-full rounded border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {availableModels[llmProvider]?.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-2 px-4 rounded bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Generiere..." : "🪄 Prompt generieren"}
          </button>

          {/* Error */}
          {error && (
            <div className="p-3 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Placeholder Help Section */}
          <div className="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowPlaceholderHelp(!showPlaceholderHelp)}
              className="w-full px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 font-medium text-sm flex items-center justify-between hover:bg-blue-100 dark:hover:bg-blue-900/30"
            >
              <span>ℹ️ Verfügbare Platzhalter anzeigen</span>
              <span>{showPlaceholderHelp ? "▼" : "▶"}</span>
            </button>
            {showPlaceholderHelp && (
              <div className="p-3 bg-white dark:bg-gray-800 border-t border-blue-200 dark:border-blue-700">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  Diese Platzhalter werden bei der Dokumentgenerierung mit echten Daten ersetzt:
                </p>
                <div className="space-y-2 text-xs">
                  <div>
                    <code className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1 rounded font-mono">{"{role}"}</code>
                    <p className="text-gray-600 dark:text-gray-400 ml-2 mt-1">→ &quot;professional career consultant and CV/resume expert&quot;</p>
                  </div>
                  <div>
                    <code className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1 rounded font-mono">{"{task}"}</code>
                    <p className="text-gray-600 dark:text-gray-400 ml-2 mt-1">→ &quot;Help this candidate create compelling, honest, and effective job application documents&quot;</p>
                  </div>
                  <div>
                    <code className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-1 rounded font-mono">{"{job_description}"}</code>
                    <p className="text-gray-600 dark:text-gray-400 ml-2 mt-1">→ Vollständige Stellenbeschreibung + Bewerbungskontext</p>
                  </div>
                  <div>
                    <code className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-1 rounded font-mono">{"{cv_text}"}</code>
                    <p className="text-gray-600 dark:text-gray-400 ml-2 mt-1">→ Vollständiger CV-Text des Kandidaten</p>
                  </div>
                  <div>
                    <code className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-1 rounded font-mono">{"{cv_summary}"}</code>
                    <p className="text-gray-600 dark:text-gray-400 ml-2 mt-1">→ Erste 500 Zeichen des CVs</p>
                  </div>
                  <div>
                    <code className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-1 rounded font-mono">{"{language}"}</code>
                    <p className="text-gray-600 dark:text-gray-400 ml-2 mt-1">→ Zielsprache (z.B. &quot;German - Write all content in German language&quot;)</p>
                  </div>
                  <div>
                    <code className="bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-1 rounded font-mono">{"{instructions}"}</code>
                    <p className="text-gray-600 dark:text-gray-400 ml-2 mt-1">→ Nummerierte Liste aller Formatierungs- und Inhaltsregeln</p>
                  </div>
                  <div>
                    <code className="bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-1 rounded font-mono">{"{reference_letters}"}</code>
                    <p className="text-gray-600 dark:text-gray-400 ml-2 mt-1">→ Inhalt der hochgeladenen Referenzschreiben</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Generated Prompt Preview */}
          {generatedPrompt && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Generierter Prompt (Template)
                </label>
                <button
                  onClick={handlePreview}
                  className="px-3 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700"
                >
                  🔍 Mit Beispieldaten testen
                </button>
              </div>
              <pre className="p-3 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs overflow-auto max-h-60 whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                {generatedPrompt}
              </pre>
            </div>
          )}

          {/* Preview with Sample Data */}
          {showPreview && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Preview: Prompt mit Beispieldaten
                </label>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xs"
                >
                  ✕ Schliessen
                </button>
              </div>
              <div className="p-3 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="text-xs text-green-800 dark:text-green-300 mb-2">
                  ℹ️ So wird der Prompt mit echten Daten aussehen:
                </p>
                <pre className="p-3 rounded bg-white dark:bg-gray-900 border border-green-300 dark:border-green-700 text-xs overflow-auto max-h-80 whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                  {previewPrompt}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Abbrechen
          </button>
          {generatedPrompt && (
            <>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-4 py-2 rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Neu generieren
              </button>
              <button
                onClick={handleApply}
                className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
              >
                Übernehmen
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
