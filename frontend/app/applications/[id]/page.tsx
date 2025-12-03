"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/lib/auth-context";
import api from "@/lib/api";

type MatchingScore = {
  overall_score: number;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
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
  const [loading, setLoading] = useState(true);
  const [generatingScore, setGeneratingScore] = useState(false);
  const [generatingDocs, setGeneratingDocs] = useState(false);
  const [error, setError] = useState("");
  const [availableDocs, setAvailableDocs] = useState<any[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [showDocSelector, setShowDocSelector] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && applicationId) {
      loadApplication();
      loadMatchingScore(); // Also load matching score on mount
      loadAvailableDocs();
    }
  }, [user, applicationId]);

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

  const loadMatchingScore = async (recalculate: boolean = false) => {
    setGeneratingScore(true);
    setError("");
    try {
      const score = await api.getMatchingScore(applicationId, recalculate);
      setMatchingScore(score);
    } catch (error: any) {
      setError(error.message || "Failed to calculate matching score");
    } finally {
      setGeneratingScore(false);
    }
  };

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
      if (response && response.task_id) {
        const activeTasksStr = localStorage.getItem("activeGenerationTasks");
        const activeTasks: { appId: number; taskId: number }[] = activeTasksStr
          ? JSON.parse(activeTasksStr)
          : [];
        activeTasks.push({ appId: applicationId, taskId: response.task_id });
        localStorage.setItem("activeGenerationTasks", JSON.stringify(activeTasks));
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
            <Button onClick={() => router.push("/dashboard")} variant="outline">
              ← Back
            </Button>
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="EasyBewerbung" className="w-8 h-8 rounded-lg" />
              <span className="text-xl font-bold">EasyBewerbung</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-muted">{user.full_name || user.email}</span>
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

        {/* Matching Score */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Matching Score</h2>
          <Card>
            {!matchingScore ? (
              <div className="text-center py-8">
                <p className="text-muted mb-4">
                  Calculate how well your CV matches this job's requirements
                </p>
                <Button
                  onClick={loadMatchingScore}
                  disabled={generatingScore}
                  variant="primary"
                >
                  {generatingScore ? "Calculating..." : "Calculate Matching Score"}
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

                <Button
                  onClick={() => loadMatchingScore(true)}
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
          <h2 className="text-2xl font-bold mb-4">Generated Documents</h2>
          <Card>
            {application.generated_documents && application.generated_documents.length > 0 ? (
              <div className="space-y-4">
                {application.generated_documents.map((doc: GeneratedDoc) => (
                  <div
                    key={doc.id}
                    className="p-4 chip rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">
                        {doc.doc_type.replace(/_/g, " ").toUpperCase()}
                      </h3>
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
                          {new Date(doc.created_at + 'Z').toLocaleString(undefined, {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
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
