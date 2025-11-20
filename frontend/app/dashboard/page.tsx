"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { useAuth } from "@/lib/auth-context";
import api from "@/lib/api";

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [documents, setDocuments] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Job analysis
  const [jobUrl, setJobUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Load data
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      const [docs, apps] = await Promise.all([
        api.listDocuments(),
        api.listApplications(),
      ]);
      setDocuments(docs);
      setApplications(apps);
    } catch (error: any) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
      setUploadError("");
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;

    setUploading(true);
    setUploadError("");

    try {
      await api.uploadDocument(uploadFile);
      setUploadFile(null);
      await loadData();
      // Reset file input
      const fileInput = document.getElementById("file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (error: any) {
      setUploadError(error.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyzeJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobUrl) return;

    setAnalyzing(true);
    setAnalysisError("");

    try {
      const result = await api.analyzeJob(jobUrl);
      // Create application from analyzed job
      await api.createApplication({
        job_title: result.title || "Unknown Position",
        company: result.company || "Unknown Company",
        job_offer_url: jobUrl,
      });
      setJobUrl("");
      await loadData();
    } catch (error: any) {
      setAnalysisError(error.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteDocument = async (id: number) => {
    if (!confirm("Delete this document?")) return;

    try {
      await api.deleteDocument(id);
      await loadData();
    } catch (error: any) {
      alert("Delete failed: " + error.message);
    }
  };

  const handleDownloadRAV = async () => {
    try {
      const report = await api.getRAVReport();
      // Create a downloadable text file
      const blob = new Blob([report.report], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rav-report-${new Date().toISOString().split("T")[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      alert("Failed to generate report: " + error.message);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/");
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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
              EB
            </div>
            <span className="text-xl font-bold">EasyBewerbung</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400">
              {user.full_name || user.email}
            </span>
            <Button onClick={handleLogout} variant="outline">
              Log Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        {/* Upload Section */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Upload Documents</h2>
          <Card>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Select File (PDF, DOC, DOCX, TXT - Max 10MB)
                </label>
                <input
                  id="file-input"
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.txt"
                  className="block w-full text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 file:cursor-pointer"
                />
              </div>

              {uploadFile && (
                <div className="flex items-center gap-3">
                  <span className="text-slate-300">📄 {uploadFile.name}</span>
                  <Button
                    onClick={handleUpload}
                    disabled={uploading}
                    variant="primary"
                  >
                    {uploading ? "Uploading..." : "Upload"}
                  </Button>
                </div>
              )}

              {uploadError && (
                <p className="text-red-400 text-sm">{uploadError}</p>
              )}
            </div>
          </Card>
        </section>

        {/* Documents List */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Your Documents</h2>
          {documents.length === 0 ? (
            <Card>
              <p className="text-slate-400 text-center py-8">
                No documents uploaded yet. Upload your CV to get started!
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {documents.map((doc) => (
                <Card key={doc.id}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-white">{doc.filename}</p>
                      <p className="text-sm text-slate-400">{doc.doc_type}</p>
                      {doc.has_text && (
                        <p className="text-xs text-emerald-400 mt-1">
                          ✓ Text extracted
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Job Analysis */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Add Job Offer</h2>
          <Card>
            <form onSubmit={handleAnalyzeJob} className="space-y-4">
              <Input
                type="url"
                label="Job Offer URL"
                value={jobUrl}
                onChange={setJobUrl}
                placeholder="https://example.com/job-posting"
                required
              />

              <Button
                type="submit"
                disabled={analyzing || !jobUrl}
                variant="primary"
              >
                {analyzing ? "Analyzing..." : "Analyze Job"}
              </Button>

              {analysisError && (
                <p className="text-red-400 text-sm">{analysisError}</p>
              )}
            </form>
          </Card>
        </section>

        {/* Applications */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Your Applications</h2>
            {applications.length > 0 && (
              <Button onClick={handleDownloadRAV} variant="outline">
                🇨🇭 Download RAV Report
              </Button>
            )}
          </div>

          {applications.length === 0 ? (
            <Card>
              <p className="text-slate-400 text-center py-8">
                No applications yet. Add a job offer to get started!
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {applications.map((app) => (
                <Card key={app.id}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white text-lg">
                        {app.job_title}
                      </h3>
                      <p className="text-slate-300">{app.company}</p>
                      {app.job_offer_url && (
                        <a
                          href={app.job_offer_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-indigo-400 hover:text-indigo-300"
                        >
                          View Job Posting →
                        </a>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span
                          className={`px-2 py-1 rounded ${
                            app.applied
                              ? "bg-emerald-900/30 text-emerald-400"
                              : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {app.applied ? "Applied" : "Not Applied"}
                        </span>
                        {app.result && (
                          <span className="text-slate-400">
                            Result: {app.result}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
