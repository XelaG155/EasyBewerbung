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

          {/* Generated Prompt Preview */}
          {generatedPrompt && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Generierter Prompt
              </label>
              <pre className="p-3 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs overflow-auto max-h-60 whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                {generatedPrompt}
              </pre>
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
