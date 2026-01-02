"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/lib/auth-context";
import api from "@/lib/api";
import { formatUserDate } from "@/lib/date-utils";

type MatchingScore = {
  overall_score: number;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  story?: string;
  status?: string;
};

type GeneratedDoc = {
  id: number;
  doc_type: string;
  format: string;
  content: string;
  created_at: string;
};

export default function ApplicationDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const applicationId = parseInt(params.id as string);

  const [application, setApplication] = useState<any>(null);
  const [matchingScore, setMatchingScore] = useState<MatchingScore | null>(null);
  const [matchingScoreStatus, setMatchingScoreStatus] = useState<string>("not_calculated");
  const [matchingScoreTaskId, setMatchingScoreTaskId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingScore, setGeneratingScore] = useState(false);
  const [generatingDocs, setGeneratingDocs] = useState(false);
  const [error, setError] = useState("");
  const [availableDocs, setAvailableDocs] = useState<any[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [showDocSelector, setShowDocSelector] = useState(false);

  // Active generations tracking
  const [hasActiveGenerations, setHasActiveGenerations] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{ completed: number; total: number } | null>(null);
  const [newDocsAvailable, setNewDocsAvailable] = useState(false);

  // Language settings
  const [languageOptions, setLanguageOptions] = useState<{ code: string; label: string }[]>([]);
  const [savingLanguage, setSavingLanguage] = useState(false);

  // Document deletion
  const [selectedDocsToDelete, setSelectedDocsToDelete] = useState<number[]>([]);
  const [deletingDocs, setDeletingDocs] = useState(false);
  const [showDeleteMode, setShowDeleteMode] = useState(false);

  const toggleDocToDelete = (docId: number) => {
    setSelectedDocsToDelete(prev =>
      prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const handleDeleteSelectedDocuments = async () => {
    if (selectedDocsToDelete.length === 0) return;

    const confirmMessage = `Are you sure you want to delete ${selectedDocsToDelete.length} document(s)? This action cannot be undone.`;
    if (!confirm(confirmMessage)) return;

    setDeletingDocs(true);
    setError("");
    try {
      await api.deleteGeneratedDocuments(applicationId, selectedDocsToDelete);
      // Deletion is now async via Celery, wait a moment then reload
      setTimeout(async () => {
        await loadApplication();
        setSelectedDocsToDelete([]);
        setShowDeleteMode(false);
        setDeletingDocs(false);
      }, 1500);
    } catch (error: any) {
      setError(error.message || "Failed to delete documents");
      setDeletingDocs(false);
    }
  };

  const selectAllDocsToDelete = () => {
    if (application?.generated_documents) {
      setSelectedDocsToDelete(application.generated_documents.map((doc: GeneratedDoc) => doc.id));
    }
  };

  const deselectAllDocsToDelete = () => {
    setSelectedDocsToDelete([]);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && applicationId) {
      loadApplication();
      loadMatchingScore();
      loadAvailableDocs();
      loadLanguageOptions();
    }
  }, [user, applicationId]);

  const loadLanguageOptions = async () => {
    try {
      const langs = await api.listLanguages();
      setLanguageOptions(langs);
    } catch (error) {
      console.error("Failed to load languages:", error);
    }
  };

  const handleLanguageChange = async (newLanguage: string) => {
    if (!application) return;
    setSavingLanguage(true);
    try {
      const updated = await api.updateApplication(applicationId, {
        documentation_language: newLanguage,
      });
      setApplication(updated);
    } catch (error: any) {
      setError(error.message || "Failed to update language");
    } finally {
      setSavingLanguage(false);
    }
  };

  // Poll for active generations
  useEffect(() => {
    let retryCount: { [key: number]: number } = {};
    const MAX_RETRIES = 5;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const checkActiveGenerations = async () => {
      try {
        const activeTasksStr = localStorage.getItem("activeGenerationTasks");
        if (!activeTasksStr) {
          setHasActiveGenerations(false);
          setGenerationProgress(null);
          return;
        }

        const activeTasks: { appId: number; taskId: number }[] = JSON.parse(activeTasksStr);
        if (activeTasks.length === 0) {
          setHasActiveGenerations(false);
          setGenerationProgress(null);
          return;
        }

        console.log("🔍 Polling active tasks:", activeTasks);
        setHasActiveGenerations(true); // Show spinner while checking

        const stillActive: { appId: number; taskId: number }[] = [];
        let currentProgress: { completed: number; total: number } | null = null;

        for (const task of activeTasks) {
          try {
            const token = api.getToken();
            if (!token) {
              console.warn("⚠️ No auth token");
              continue;
            }

            const url = `${API_URL}/applications/${task.appId}/generation-status/${task.taskId}`;
            console.log("📡 Checking:", url);

            const response = await fetch(url, {
              headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
              const status = await response.json();
              console.log(`📊 Task ${task.taskId} status:`, status.status, `(${status.completed_docs}/${status.total_docs})`);
              retryCount[task.taskId] = 0;

              if (task.appId === applicationId && status.total_docs) {
                currentProgress = {
                  completed: status.completed_docs || 0,
                  total: status.total_docs
                };
              }

              if (status.status === "pending" || status.status === "processing") {
                stillActive.push(task);
              } else {
                console.log(`✅ Task ${task.taskId} finished with status: ${status.status}`);
                if (task.appId === applicationId) {
                  setNewDocsAvailable(true);
                  loadApplication();
                  setTimeout(() => setNewDocsAvailable(false), 5000);
                }
              }
            } else {
              console.error(`❌ Status check failed: ${response.status}`);
              retryCount[task.taskId] = (retryCount[task.taskId] || 0) + 1;
              if (retryCount[task.taskId] < MAX_RETRIES) {
                stillActive.push(task);
              }
            }
          } catch (err) {
            console.error(`❌ Exception checking task:`, err);
            retryCount[task.taskId] = (retryCount[task.taskId] || 0) + 1;
            if (retryCount[task.taskId] < MAX_RETRIES) {
              stillActive.push(task);
            }
          }
        }

        if (stillActive.length > 0) {
          localStorage.setItem("activeGenerationTasks", JSON.stringify(stillActive));
          setHasActiveGenerations(true);
          setGenerationProgress(currentProgress);
        } else {
          console.log("✔️ All tasks completed, clearing localStorage");
          localStorage.removeItem("activeGenerationTasks");
          setHasActiveGenerations(false);
          setGenerationProgress(null);
        }
      } catch (err) {
        console.error("❌ Polling error:", err);
        setHasActiveGenerations(false);
        setGenerationProgress(null);
      }
    };

    checkActiveGenerations();
    const interval = setInterval(checkActiveGenerations, 2000);
    return () => clearInterval(interval);
  }, [applicationId]);

  const loadAvailableDocs = async () => {
    try {
      const docs = await api.getAvailableDocTypes();
      setAvailableDocs(docs);
    } catch (error) {
      console.error("Failed to load document catalog:", error);
    }
  };

  const loadApplication = async () => {
    try {
      const app = await api.getApplication(applicationId);
      console.log('Loaded application:', app);
      console.log('Number of documents:', app.generated_documents?.length);
      if (app.generated_documents?.length > 0) {
        console.log('First document:', app.generated_documents[0]);
      }
      setApplication(app);
    } catch (error: any) {
      setError(error.message || "Failed to load application");
    } finally {
      setLoading(false);
    }
  };

  const loadMatchingScore = async () => {
    try {
      const response = await api.getMatchingScore(applicationId);
      if (response.status === "completed") {
        setMatchingScore(response);
        setMatchingScoreStatus("completed");
      } else {
        setMatchingScoreStatus(response.status || "not_calculated");
      }
    } catch (error: any) {
      console.error("Failed to load matching score:", error);
    }
  };

  const startMatchingScoreCalculation = async (recalculate: boolean = false) => {
    setGeneratingScore(true);
    setError("");
    try {
      const response = await api.calculateMatchingScore(applicationId, recalculate);
      if (response.status === "already_calculated") {
        // Score already exists, just load it
        await loadMatchingScore();
        setGeneratingScore(false);
      } else if (response.task_id) {
        // Task started, set up polling
        setMatchingScoreTaskId(response.task_id);
        setMatchingScoreStatus("pending");
      }
    } catch (error: any) {
      setError(error.message || "Failed to start matching score calculation");
      setGeneratingScore(false);
    }
  };

  // Poll for matching score task status
  useEffect(() => {
    if (!matchingScoreTaskId || matchingScoreStatus === "completed" || matchingScoreStatus === "failed") {
      return;
    }

    const pollStatus = async () => {
      try {
        const status = await api.getMatchingScoreStatus(applicationId, matchingScoreTaskId);
        setMatchingScoreStatus(status.status);

        if (status.status === "completed") {
          if (status.matching_score) {
            setMatchingScore(status.matching_score);
          }
          setGeneratingScore(false);
          setMatchingScoreTaskId(null);
        } else if (status.status === "failed") {
          setError(status.error_message || "Matching score calculation failed");
          setGeneratingScore(false);
          setMatchingScoreTaskId(null);
        }
      } catch (error) {
        console.error("Error polling matching score status:", error);
      }
    };

    // Poll every 2 seconds
    const interval = setInterval(pollStatus, 2000);
    // Initial poll
    pollStatus();

    return () => clearInterval(interval);
  }, [matchingScoreTaskId, matchingScoreStatus, applicationId]);

  const handleGenerateDocuments = async () => {
    if (selectedDocs.length === 0) {
      setError("Please select at least one document type");
      return;
    }

    setGeneratingDocs(true);
    setError("");
    try {
      const response = await api.generateDocuments(applicationId, selectedDocs);

      // Track the generation task in localStorage for polling
      console.log("📤 Generation response:", response);
      if (response && response.task_id) {
        const activeTasksStr = localStorage.getItem("activeGenerationTasks");
        const activeTasks: { appId: number; taskId: number }[] = activeTasksStr
          ? JSON.parse(activeTasksStr)
          : [];
        activeTasks.push({ appId: applicationId, taskId: response.task_id });
        localStorage.setItem("activeGenerationTasks", JSON.stringify(activeTasks));
        console.log("💾 Saved task to localStorage:", activeTasks);
      } else {
        console.warn("⚠️ No task_id in response!");
      }

      // Reload application to show new documents
      await loadApplication();
      setSelectedDocs([]);
      setShowDocSelector(false);
    } catch (error: any) {
      setError(error.message || "Failed to generate documents");
    } finally {
      setGeneratingDocs(false);
    }
  };

  const toggleDocSelection = (docKey: string) => {
    setSelectedDocs(prev =>
      prev.includes(docKey)
        ? prev.filter(k => k !== docKey)
        : [...prev, docKey]
    );
  };

  const handleCheckAll = () => {
    setSelectedDocs(availableDocs.map(doc => doc.key));
  };

  const handleUncheckAll = () => {
    setSelectedDocs([]);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center page-shell">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !application) return null;

  return (
    <div className="min-h-screen page-shell">
      {/* Header */}
      <header className="border-b border-muted">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={() => router.back()} variant="outline">
              ← Back
            </Button>
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="EasyBewerbung" className="w-8 h-8 rounded-lg" />
              <span className="text-xl font-bold">EasyBewerbung</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-muted flex items-center gap-2">
              {user.full_name || user.email}
              {hasActiveGenerations && (
                <svg
                  className="animate-spin h-5 w-5 text-emerald-400 cursor-help"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <title>
                    {generationProgress
                      ? `Generating documents: ${generationProgress.completed} of ${generationProgress.total} completed`
                      : "Generating documents..."}
                  </title>
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              )}
            </span>
            <span className="px-3 py-1 rounded chip text-sm text-success border border-success">
              Credits: {user.credits}
            </span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        {/* Application Info */}
        <section>
          <Card>
            <h1 className="text-3xl font-bold mb-4">{application.job_title}</h1>
            <p className="text-xl text-muted mb-4">{application.company}</p>
            {application.is_spontaneous && (
              <span className="inline-block mb-3 px-3 py-1 rounded bg-amber-900/50 text-amber-200 border border-amber-700 text-sm">
                Spontaneous outreach (no posting)
              </span>
            )}
            {application.job_offer_url && (
              <a
                href={application.job_offer_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:opacity-80"
              >
                View Job Posting →
              </a>
            )}
            {(application.job_description || application.opportunity_context) && (
              <div className="mt-4 p-4 rounded-lg chip border border-muted">
                <h3 className="font-semibold mb-2">Context</h3>
                <p className="text-muted whitespace-pre-wrap text-sm leading-relaxed">
                  {application.job_description || application.opportunity_context}
                </p>
              </div>
            )}
            <div className="mt-4 flex items-center gap-4">
              <span
                className={`px-3 py-1 rounded ${
                  application.applied
                    ? "bg-emerald-900/30 text-emerald-400"
                    : "chip text-muted"
                }`}
              >
                {application.applied ? "✓ Applied" : "Not Applied"}
              </span>
              {application.result && (
                <span className="px-3 py-1 rounded chip text-muted">
                  {application.result}
                </span>
              )}
            </div>
          </Card>
        </section>

        {error && (
          <div className="p-4 rounded-lg bg-red-900/20 border border-red-700 text-red-400">
            {error}
          </div>
        )}

        {newDocsAvailable && (
          <div className="p-4 rounded-lg bg-emerald-900/20 border border-emerald-700 text-emerald-400 flex items-center gap-2">
            <span className="text-xl">✨</span>
            <span>New documents have been generated! Check the documents section below.</span>
          </div>
        )}

        {/* Matching Score */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Matching Score</h2>
          <Card>
            {generatingScore ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
                <p className="text-muted">
                  {matchingScoreStatus === "pending" && "Waiting to start calculation..."}
                  {matchingScoreStatus === "processing" && "Calculating matching score..."}
                  {!["pending", "processing"].includes(matchingScoreStatus) && "Processing..."}
                </p>
                <p className="text-sm text-muted mt-2">This may take a few seconds</p>
              </div>
            ) : !matchingScore ? (
              <div className="text-center py-8">
                <p className="text-muted mb-4">
                  Calculate how well your CV matches this job's requirements
                </p>
                <Button
                  onClick={() => startMatchingScoreCalculation(false)}
                  disabled={generatingScore}
                  variant="primary"
                >
                  Calculate Matching Score
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-6xl font-bold text-accent mb-2">
                    {matchingScore.overall_score}%
                  </div>
                  <p className="text-muted">Overall Match</p>
                </div>

                <div>
                  <h3 className="font-semibold text-success mb-2">✓ Strengths</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {matchingScore.strengths.map((strength, i) => (
                      <li key={i}>{strength}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-amber-400 mb-2">⚠ Gaps</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {matchingScore.gaps.map((gap, i) => (
                      <li key={i}>{gap}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-accent mb-2">💡 Recommendations</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {matchingScore.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>

                {matchingScore.story && (
                  <div>
                    <h3 className="font-semibold text-indigo-400 mb-2">📖 Story</h3>
                    <p className="text-sm text-muted">{matchingScore.story}</p>
                  </div>
                )}

                <Button
                  onClick={() => startMatchingScoreCalculation(true)}
                  disabled={generatingScore}
                  variant="outline"
                  className="w-full mt-4"
                >
                  Recalculate
                </Button>
              </div>
            )}
          </Card>
        </section>

        {/* Document Generation */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Generated Documents</h2>
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted">Document Language:</label>
              <select
                value={application.documentation_language || "en"}
                onChange={(e) => handleLanguageChange(e.target.value)}
                disabled={savingLanguage}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {languageOptions.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
              {savingLanguage && (
                <span className="text-xs text-muted animate-pulse">Saving...</span>
              )}
            </div>
          </div>
          <Card>
            {application.generated_documents && application.generated_documents.length > 0 ? (
              <div className="space-y-4">
                {/* Delete mode controls */}
                <div className="flex items-center justify-between pb-2 border-b border-muted">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setShowDeleteMode(!showDeleteMode);
                        if (showDeleteMode) {
                          setSelectedDocsToDelete([]);
                        }
                      }}
                      className={`px-3 py-1 text-sm rounded ${showDeleteMode ? 'bg-red-700 text-white' : 'btn-secondary'}`}
                    >
                      {showDeleteMode ? "Cancel Delete Mode" : "🗑️ Manage Documents"}
                    </button>
                    {showDeleteMode && (
                      <>
                        <button
                          onClick={selectAllDocsToDelete}
                          className="btn-secondary px-3 py-1 text-sm rounded"
                        >
                          Select All
                        </button>
                        <button
                          onClick={deselectAllDocsToDelete}
                          className="btn-secondary px-3 py-1 text-sm rounded"
                        >
                          Deselect All
                        </button>
                      </>
                    )}
                  </div>
                  {showDeleteMode && selectedDocsToDelete.length > 0 && (
                    <button
                      onClick={handleDeleteSelectedDocuments}
                      disabled={deletingDocs}
                      className="px-3 py-1 text-sm rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                    >
                      {deletingDocs ? "Deleting..." : `Delete ${selectedDocsToDelete.length} Selected`}
                    </button>
                  )}
                </div>

                {application.generated_documents.map((doc: GeneratedDoc) => (
                  <div
                    key={doc.id}
                    className={`p-4 chip rounded-lg ${showDeleteMode && selectedDocsToDelete.includes(doc.id) ? 'ring-2 ring-red-500' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {showDeleteMode && (
                          <input
                            type="checkbox"
                            checked={selectedDocsToDelete.includes(doc.id)}
                            onChange={() => toggleDocToDelete(doc.id)}
                            className="w-4 h-4 accent-red-500"
                          />
                        )}
                        <h3 className="font-semibold">
                          {doc.doc_type.replace(/_/g, " ").toUpperCase()}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const blob = new Blob([doc.content || ''], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${doc.doc_type}_${application.company}_${application.job_title}.txt`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                          className="btn-primary px-3 py-1 text-sm rounded"
                        >
                          📥 Download
                        </button>
                        <span className="text-sm text-muted">
                          {formatUserDate(doc.created_at, user?.date_format)}
                        </span>
                      </div>
                    </div>
                    <details className="cursor-pointer">
                      <summary className="text-sm text-accent hover:opacity-80 mb-2">
                        📄 Show Preview
                      </summary>
                      <pre className="whitespace-pre-wrap text-sm card-surface p-3 rounded max-h-96 overflow-y-auto">
                        {doc.content || '(No content available)'}
                      </pre>
                    </details>
                  </div>
                ))}
                <Button
                  onClick={() => setShowDocSelector(!showDocSelector)}
                  variant="outline"
                  className="w-full"
                >
                  {showDocSelector ? "Hide Document Selection" : "Generate More Documents"}
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted mb-4">
                  No documents generated yet. Select documents to generate for this application.
                </p>
                <Button
                  onClick={() => setShowDocSelector(!showDocSelector)}
                  variant="primary"
                >
                  {showDocSelector ? "Hide Document Selection" : "Select Documents to Generate"}
                </Button>
              </div>
            )}

            {showDocSelector && (
              <div className="mt-6 p-4 chip rounded-lg border border-muted">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Select Documents to Generate</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCheckAll}
                      className="btn-secondary px-3 py-1 text-sm rounded"
                    >
                      Check All
                    </button>
                    <button
                      onClick={handleUncheckAll}
                      className="btn-secondary px-3 py-1 text-sm rounded"
                    >
                      Uncheck All
                    </button>
                  </div>
                </div>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {availableDocs.map((doc) => (
                    <label
                      key={doc.key}
                      className="flex items-start gap-3 p-3 rounded card-surface hover:opacity-90 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocs.includes(doc.key)}
                        onChange={() => toggleDocSelection(doc.key)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-semibold">{doc.title}</div>
                        <div className="text-sm text-muted">{doc.description}</div>
                        <div className="text-xs text-muted mt-1">
                          Output: {doc.outputs?.join(", ")}
                        </div>
                        {doc.notes && (
                          <div className="text-xs text-accent mt-1">💡 {doc.notes}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-muted">
                    {selectedDocs.length} document(s) selected • {selectedDocs.length} credit(s)
                  </span>
                  <Button
                    onClick={handleGenerateDocuments}
                    disabled={generatingDocs || selectedDocs.length === 0}
                    variant="primary"
                  >
                    {generatingDocs ? "Generating..." : "Generate Selected Documents"}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </section>
      </main>
    </div>
  );
}
