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

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && applicationId) {
      loadApplication();
    }
  }, [user, applicationId]);

  const loadApplication = async () => {
    try {
      const app = await api.getApplication(applicationId);
      setApplication(app);
    } catch (error: any) {
      setError(error.message || "Failed to load application");
    } finally {
      setLoading(false);
    }
  };

  const loadMatchingScore = async () => {
    setGeneratingScore(true);
    setError("");
    try {
      const score = await api.getMatchingScore(applicationId);
      setMatchingScore(score);
    } catch (error: any) {
      setError(error.message || "Failed to calculate matching score");
    } finally {
      setGeneratingScore(false);
    }
  };

  const handleGenerateDocuments = async () => {
    setGeneratingDocs(true);
    setError("");
    try {
      await api.generateDocuments(applicationId, ["COVER_LETTER"]);
      await loadApplication();
      await user && (await api.getCurrentUser()).then(u => {
        // Refresh user to update credits
        window.location.reload();
      });
    } catch (error: any) {
      setError(error.message || "Failed to generate documents");
    } finally {
      setGeneratingDocs(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !application) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={() => router.push("/dashboard")} variant="outline">
              ← Back
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
                EB
              </div>
              <span className="text-xl font-bold">EasyBewerbung</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400">{user.full_name || user.email}</span>
            <span className="px-3 py-1 rounded bg-slate-800 text-sm text-emerald-300 border border-emerald-700">
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
            <p className="text-xl text-slate-300 mb-4">{application.company}</p>
            {application.job_offer_url && (
              <a
                href={application.job_offer_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300"
              >
                View Job Posting →
              </a>
            )}
            <div className="mt-4 flex items-center gap-4">
              <span
                className={`px-3 py-1 rounded ${
                  application.applied
                    ? "bg-emerald-900/30 text-emerald-400"
                    : "bg-slate-700 text-slate-300"
                }`}
              >
                {application.applied ? "✓ Applied" : "Not Applied"}
              </span>
              {application.result && (
                <span className="px-3 py-1 rounded bg-slate-700 text-slate-300">
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
                <p className="text-slate-400 mb-4">
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
                  <div className="text-6xl font-bold text-indigo-400 mb-2">
                    {matchingScore.overall_score}%
                  </div>
                  <p className="text-slate-400">Overall Match</p>
                </div>

                <div>
                  <h3 className="font-semibold text-emerald-400 mb-2">✓ Strengths</h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    {matchingScore.strengths.map((strength, i) => (
                      <li key={i}>{strength}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-amber-400 mb-2">⚠ Gaps</h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    {matchingScore.gaps.map((gap, i) => (
                      <li key={i}>{gap}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-indigo-400 mb-2">💡 Recommendations</h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    {matchingScore.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>

                <Button
                  onClick={loadMatchingScore}
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
                    className="p-4 bg-slate-700 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">
                        {doc.doc_type.replace("_", " ")}
                      </h3>
                      <span className="text-sm text-slate-400">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm text-slate-300 bg-slate-800 p-3 rounded max-h-96 overflow-y-auto">
                      {doc.content}
                    </pre>
                  </div>
                ))}
                <Button
                  onClick={handleGenerateDocuments}
                  disabled={generatingDocs}
                  variant="outline"
                  className="w-full"
                >
                  {generatingDocs ? "Generating..." : "Regenerate Documents (1 credit)"}
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-400 mb-4">
                  No documents generated yet. Generate a cover letter for this application.
                </p>
                <Button
                  onClick={handleGenerateDocuments}
                  disabled={generatingDocs}
                  variant="primary"
                >
                  {generatingDocs ? "Generating..." : "Generate Cover Letter (1 credit)"}
                </Button>
              </div>
            )}
          </Card>
        </section>
      </main>
    </div>
  );
}
