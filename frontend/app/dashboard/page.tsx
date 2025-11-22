"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Modal } from "@/components/Modal";
import { useAuth } from "@/lib/auth-context";
import api, { LanguageOption } from "@/lib/api";

type DocumentRecord = {
  id: number;
  filename: string;
  doc_type: string;
  created_at?: string;
  has_text?: boolean;
};

type ApplicationRecord = {
  id: number;
  job_title: string;
  company: string;
  job_offer_url?: string | null;
  job_description?: string | null;
  applied: boolean;
  applied_at?: string | null;
  result?: string | null;
  ui_language: string;
  documentation_language: string;
  company_profile_language: string;
  created_at?: string;
};

const FALLBACK_LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", label: "English", direction: "ltr" },
  { code: "de", label: "Deutsch (German)", direction: "ltr" },
  { code: "fr", label: "Français (French)", direction: "ltr" },
  { code: "es", label: "Español (Spanish)", direction: "ltr" },
  { code: "ar", label: "Arabic", direction: "rtl" },
];

const findLanguageOption = (value: string | undefined | null, options: LanguageOption[]) => {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  return options.find(
    (option) => option.code.toLowerCase() === normalized || option.label.toLowerCase() === normalized
  );
};

const resolveLanguageCode = (
  value: string | undefined | null,
  options: LanguageOption[],
  fallbackOptions: LanguageOption[] = FALLBACK_LANGUAGE_OPTIONS
) => {
  const option = findLanguageOption(value, options) || findLanguageOption(value, fallbackOptions);
  return option?.code || options[0]?.code || fallbackOptions[0].code;
};

const ensureOptionList = (userLanguageValues: (string | undefined | null)[]): LanguageOption[] => {
  const uniqueOptions: LanguageOption[] = [...FALLBACK_LANGUAGE_OPTIONS];
  userLanguageValues
    .filter((val): val is string => Boolean(val))
    .forEach((val) => {
      const existing = findLanguageOption(val, uniqueOptions);
      if (!existing) {
        uniqueOptions.push({ code: val, label: val, direction: "ltr" });
      }
    });
  return uniqueOptions;
};

export default function DashboardPage() {
  const { user, loading: authLoading, logout, refreshUser } = useAuth();
  const router = useRouter();

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("CV");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Job analysis
  const [jobUrl, setJobUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>(FALLBACK_LANGUAGE_OPTIONS);
  const [documentationLanguage, setDocumentationLanguage] = useState<string>(FALLBACK_LANGUAGE_OPTIONS[0].code);
  const [companyProfileLanguage, setCompanyProfileLanguage] = useState<string>(FALLBACK_LANGUAGE_OPTIONS[0].code);

  // Status Modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [newStatus, setNewStatus] = useState("");

  // Filtering and sorting
  const [filterApplied, setFilterApplied] = useState<string>("all"); // "all", "applied", "not-applied"
  const [filterMonth, setFilterMonth] = useState<string>("all"); // "all" or "YYYY-MM"
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Load data
  useEffect(() => {
    if (user) {
      api
        .listLanguages()
        .then((res) => setLanguageOptions(res))
        .catch((error) => {
          console.error("Failed to load languages", error);
          setLanguageOptions(
            ensureOptionList([
              user.preferred_language,
              user.mother_tongue,
              user.documentation_language,
            ])
          );
        });
      loadData();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const options = languageOptions.length
        ? languageOptions
        : ensureOptionList([
            user.preferred_language,
            user.mother_tongue,
            user.documentation_language,
          ]);
      setDocumentationLanguage(
        resolveLanguageCode(user.documentation_language || user.preferred_language, options)
      );
      setCompanyProfileLanguage(
        resolveLanguageCode(user.mother_tongue || user.preferred_language, options)
      );
    }
  }, [user, languageOptions]);

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
      await api.uploadDocument(uploadFile, docType);
      setUploadFile(null);
      setDocType("CV");
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
    if (!jobUrl || !user) return;

    setAnalyzing(true);
    setAnalysisError("");

    try {
      const result = await api.analyzeJob(jobUrl);
      const options = languageOptions.length
        ? languageOptions
        : ensureOptionList([
            user.preferred_language,
            user.mother_tongue,
            user.documentation_language,
          ]);
      // Create application from analyzed job
      await api.createApplication({
        job_title: result.title || "Unknown Position",
        company: result.company || "Unknown Company",
        job_offer_url: jobUrl,
        ui_language: resolveLanguageCode(user.mother_tongue || user.preferred_language, options),
        documentation_language: documentationLanguage,
        company_profile_language: companyProfileLanguage,
      });
      setJobUrl("");
      await loadData();
      await refreshUser();
    } catch (error: any) {
      const message = error.message || "Analysis failed";
      if (message.toLowerCase().includes("credit")) {
        setAnalysisError("You do not have enough credits. Please ask an admin to top up your account.");
      } else {
        setAnalysisError(message);
      }
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

  const handleUpdateApplicationStatus = async (
    id: number,
    applied: boolean,
    result?: string
  ) => {
    try {
      await api.updateApplication(id, {
        applied,
        applied_at: applied ? new Date().toISOString() : undefined,
        result,
      });
      await loadData();
    } catch (error: any) {
      alert("Update failed: " + error.message);
    }
  };

  const openStatusModal = (appId: number, currentStatus: string | null) => {
    setSelectedAppId(appId);
    setNewStatus(currentStatus || "");
    setStatusModalOpen(true);
  };

  const submitStatusUpdate = async () => {
    if (selectedAppId) {
      await handleUpdateApplicationStatus(selectedAppId, true, newStatus);
      setStatusModalOpen(false);
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

  const handleDownloadJobPDF = async (appId: number, jobTitle: string, company: string) => {
    try {
      const blob = await api.downloadJobDescriptionPDF(appId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `job_${company}_${jobTitle}.pdf`.replace(/\s+/g, "_");
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      alert("Failed to download PDF: " + error.message);
    }
  };

  // Filter and sort applications
  const filteredAndSortedApplications = applications
    .filter((app) => {
      // Filter by applied status
      if (filterApplied === "applied" && !app.applied) return false;
      if (filterApplied === "not-applied" && app.applied) return false;

      // Filter by month
      if (filterMonth !== "all" && app.created_at) {
        const appMonth = app.created_at.substring(0, 7); // YYYY-MM
        if (appMonth !== filterMonth) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

  // Get unique months from applications
  const availableMonths = Array.from(
    new Set(
      applications
        .filter((app) => app.created_at)
        .map((app) => app.created_at!.substring(0, 7))
    )
  ).sort((a, b) => b.localeCompare(a));

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
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Header */}
        <header className="border-b border-slate-800">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="EasyBewerbung" className="w-8 h-8 rounded-lg" />
              <span className="text-xl font-bold">EasyBewerbung</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-slate-400">
                {user.full_name || user.email}
              </span>
              <span className="px-3 py-1 rounded bg-slate-800 text-sm text-emerald-300 border border-emerald-700">
                Credits: {user.credits}
              </span>
              {user.is_admin && (
                <Button onClick={() => router.push("/admin")} variant="outline">
                  Admin
                </Button>
              )}
              <Button onClick={() => router.push("/settings")} variant="outline">
                Settings
              </Button>
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
                  <label htmlFor="doc-type" className="block text-sm font-medium text-slate-200 mb-2">
                    Document Type
                  </label>
                  <select
                    id="doc-type"
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-label="Select document type"
                  >
                    <option value="CV">CV / Resume</option>
                    <option value="REFERENCE">Reference Letter</option>
                    <option value="DIPLOMA">Diploma / Certificate</option>
                    <option value="COVER_LETTER">Cover Letter</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="file-input" className="block text-sm font-medium text-slate-200 mb-2">
                    Select File (PDF, DOC, DOCX, TXT - Max 25MB)
                  </label>
                  <input
                    id="file-input"
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.txt"
                    className="block w-full text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 file:cursor-pointer"
                    aria-label="Upload document file"
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
                        <p className="text-xs text-slate-500 mt-1">
                          {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                        aria-label={`Delete document ${doc.filename}`}
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

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="text-sm text-slate-200">
                    <span className="block mb-2">Language for generated documents</span>
                    <select
                      value={documentationLanguage}
                      onChange={(e) => setDocumentationLanguage(e.target.value)}
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
                    >
                      {languageOptions.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm text-slate-200">
                    <span className="block mb-2">Language for company profile</span>
                    <select
                      value={companyProfileLanguage}
                      onChange={(e) => setCompanyProfileLanguage(e.target.value)}
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
                    >
                      {languageOptions.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

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
              <>
                {/* Filter and Sort Controls */}
                <Card>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-200 mb-2">
                        Filter by Status
                      </label>
                      <select
                        value={filterApplied}
                        onChange={(e) => setFilterApplied(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="all">All Applications</option>
                        <option value="applied">Applied Only</option>
                        <option value="not-applied">Not Applied</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-200 mb-2">
                        Filter by Month
                      </label>
                      <select
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="all">All Months</option>
                        {availableMonths.map((month) => (
                          <option key={month} value={month}>
                            {new Date(month + "-01").toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "long",
                            })}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-200 mb-2">
                        Sort by Date
                      </label>
                      <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                        className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="desc">Newest First</option>
                        <option value="asc">Oldest First</option>
                      </select>
                    </div>
                  </div>
                </Card>

                {filteredAndSortedApplications.length === 0 ? (
                  <Card>
                    <p className="text-slate-400 text-center py-8">
                      No applications match your filters.
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {filteredAndSortedApplications.map((app) => (
                  <Card key={app.id}>
                    <div className="space-y-3">
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
                        </div>
                      </div>

                      {/* Job Description Preview */}
                      {app.job_description && (
                        <div className="mt-2 p-3 bg-slate-800 rounded-lg">
                          <p className="text-sm text-slate-400 line-clamp-3">
                            {(() => {
                              // Convert newlines and tabs to spaces, then limit length
                              const cleanText = app.job_description
                                .replace(/[\n\r\t]+/g, ' ')
                                .replace(/\s+/g, ' ')
                                .trim();
                              // Limit to ~300 characters for preview
                              return cleanText.length > 300
                                ? cleanText.substring(0, 300) + '...'
                                : cleanText;
                            })()}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-sm flex-wrap">
                        <span
                          className={`px-3 py-1 rounded ${app.applied
                            ? "bg-emerald-900/30 text-emerald-400"
                            : "bg-slate-700 text-slate-300"
                            }`}
                        >
                          {app.applied ? "✓ Applied" : "Not Applied"}
                        </span>

                        {app.result && (
                          <span className="px-3 py-1 rounded bg-slate-700 text-slate-300">
                            {app.result}
                          </span>
                        )}

                        {app.created_at && (
                          <span className="text-slate-500">
                            Added {new Date(app.created_at).toLocaleString(undefined, {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 flex-wrap pt-2 border-t border-slate-700">
                        <button
                          onClick={() => router.push(`/applications/${app.id}`)}
                          className="text-sm px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          View Details →
                        </button>

                        {!app.applied && (
                          <button
                            onClick={() => handleUpdateApplicationStatus(app.id, true)}
                            className="text-sm px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Mark as Applied
                          </button>
                        )}

                        <button
                          onClick={() => openStatusModal(app.id, app.result ?? null)}
                          className="text-sm px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
                        >
                          Update Status
                        </button>

                        {app.job_offer_url && (
                          <a
                            href={app.job_offer_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white inline-block"
                            title="View original job posting"
                          >
                            🔗 View Original Posting
                          </a>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
                )}
              </>
            )}
          </section>
        </main>

        <Modal
          isOpen={statusModalOpen}
          onClose={() => setStatusModalOpen(false)}
          title="Update Application Status"
        >
          <div className="space-y-4">
            <Input
              label="New Status"
              value={newStatus}
              onChange={setNewStatus}
              placeholder="e.g. Interview, Rejected, Offer"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setStatusModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={submitStatusUpdate}>
                Update Status
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </ErrorBoundary>
  );
}

