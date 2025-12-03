"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Modal } from "@/components/Modal";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "@/lib/i18n-context";
import { useTheme } from "@/lib/theme-context";
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
  job_offer_id?: number | null;
  is_spontaneous?: boolean;
  opportunity_context?: string | null;
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
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
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

  // Spontaneous applications
  const [targetCompany, setTargetCompany] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [opportunityContext, setOpportunityContext] = useState("");
  const [creatingSpontaneous, setCreatingSpontaneous] = useState(false);
  const [spontaneousError, setSpontaneousError] = useState("");

  // Status Modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [newStatus, setNewStatus] = useState("");

  // Active generations tracking
  const [hasActiveGenerations, setHasActiveGenerations] = useState(false);

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

  // Poll for active generations
  useEffect(() => {
    const checkActiveGenerations = async () => {
      try {
        const activeTasksStr = localStorage.getItem("activeGenerationTasks");
        if (!activeTasksStr) {
          setHasActiveGenerations(false);
          return;
        }

        const activeTasks: { appId: number; taskId: number }[] = JSON.parse(activeTasksStr);
        if (activeTasks.length === 0) {
          setHasActiveGenerations(false);
          return;
        }

        // Check status of each task
        const stillActive: { appId: number; taskId: number }[] = [];
        for (const task of activeTasks) {
          try {
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/applications/${task.appId}/generation-status/${task.taskId}`,
              {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
              }
            );
            if (response.ok) {
              const status = await response.json();
              // Keep task if still processing
              if (status.status === "pending" || status.status === "processing") {
                stillActive.push(task);
              }
            }
          } catch (error) {
            // If error, keep task in list (will retry next poll)
            stillActive.push(task);
          }
        }

        // Update localStorage and state
        if (stillActive.length > 0) {
          localStorage.setItem("activeGenerationTasks", JSON.stringify(stillActive));
          setHasActiveGenerations(true);
        } else {
          localStorage.removeItem("activeGenerationTasks");
          setHasActiveGenerations(false);
        }
      } catch (error) {
        console.error("Error checking active generations:", error);
      }
    };

    // Initial check
    checkActiveGenerations();

    // Poll every 5 seconds
    const interval = setInterval(checkActiveGenerations, 5000);

    return () => clearInterval(interval);
  }, []);

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
      setUploadError(error.message || t("dashboard.uploadFailed"));
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
        job_title: result.title || t("dashboard.unknownPosition"),
        company: result.company || t("dashboard.unknownCompany"),
        job_offer_url: jobUrl,
        ui_language: resolveLanguageCode(user.mother_tongue || user.preferred_language, options),
        documentation_language: documentationLanguage,
        company_profile_language: companyProfileLanguage,
      });
      setJobUrl("");
      await loadData();
      await refreshUser();
    } catch (error: any) {
      const message = error.message || t("dashboard.analysisFailed");
      if (message.toLowerCase().includes("credit")) {
        setAnalysisError(t("dashboard.noCredits"));
      } else {
        setAnalysisError(message);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateSpontaneous = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCompany || !targetRole || !user) return;

    setCreatingSpontaneous(true);
    setSpontaneousError("");

    try {
      const options = languageOptions.length
        ? languageOptions
        : ensureOptionList([
            user.preferred_language,
            user.mother_tongue,
            user.documentation_language,
          ]);

      await api.createSpontaneousApplication({
        job_title: targetRole,
        company: targetCompany,
        opportunity_context: opportunityContext || undefined,
        ui_language: resolveLanguageCode(user.mother_tongue || user.preferred_language, options),
        documentation_language: documentationLanguage,
        company_profile_language: companyProfileLanguage,
      });

      setTargetCompany("");
      setTargetRole("");
      setOpportunityContext("");
      await loadData();
      await refreshUser();
    } catch (error: any) {
      const message = error.message || "Could not save spontaneous application";
      if (message.toLowerCase().includes("credit")) {
        setSpontaneousError(
          t("dashboard.noCredits")
        );
      } else {
        setSpontaneousError(message);
      }
    } finally {
      setCreatingSpontaneous(false);
    }
  };

  const handleDeleteDocument = async (id: number) => {
    if (!confirm(t("dashboard.deleteConfirm"))) return;

    try {
      await api.deleteDocument(id);
      await loadData();
    } catch (error: any) {
      alert(t("dashboard.deleteFailed") + ": " + error.message);
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
      alert(t("dashboard.updateFailed") + ": " + error.message);
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
      alert(t("dashboard.downloadFailed") + ": " + error.message);
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
      alert(t("dashboard.downloadPdfFailed") + ": " + error.message);
    }
  };

  const handleDownloadOriginalJobPDF = async (jobOfferId: number, jobTitle: string, company: string) => {
    try {
      const blob = await api.downloadOriginalJobPDF(jobOfferId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `original_${company}_${jobTitle}.pdf`.replace(/\s+/g, "_");
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(t("dashboard.downloadPdfFailed") + ": " + error.message);
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
      <div className="min-h-screen page-shell flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-muted">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <ErrorBoundary>
      <div className="min-h-screen page-shell">
        {/* Header */}
        <header className="border-b border-muted">
          <div className="container mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
                <img src="/logo.png" alt="EasyBewerbung" className="w-8 h-8 rounded-lg flex-shrink-0" />
                <span className="text-lg sm:text-xl font-bold truncate">EasyBewerbung</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                <span className="text-muted flex items-center gap-2 text-sm sm:text-base hidden sm:flex">
                  {user.full_name || user.email}
                  {hasActiveGenerations && (
                    <svg
                      className="animate-spin h-5 w-5 text-emerald-400"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
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
                <span className="px-2 sm:px-3 py-1 rounded bg-slate-800 text-xs sm:text-sm text-emerald-300 border border-emerald-700 whitespace-nowrap">
                  Credits: {user.credits}
                </span>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="btn-base btn-secondary flex items-center gap-2 text-sm px-2 sm:px-3 py-1.5 flex-shrink-0"
                  aria-pressed={theme === "light"}
                  title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
                >
                  <span aria-hidden>{theme === "light" ? "🌙" : "☀️"}</span>
                </button>
                {user.is_admin && (
                  <Button onClick={() => router.push("/admin")} variant="outline" className="hidden sm:inline-flex">
                    Admin
                  </Button>
                )}
                <Button onClick={() => router.push("/settings")} variant="outline" className="hidden sm:inline-flex">
                  Settings
                </Button>
                <Button onClick={handleLogout} variant="outline" className="hidden sm:inline-flex">
                  Log Out
                </Button>
              </div>
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
                  <label htmlFor="doc-type" className="block text-sm font-medium input-label mb-2">
                    Document Type
                  </label>
                  <select
                    id="doc-type"
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="input-base"
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
                  <label htmlFor="file-input" className="block text-sm font-medium input-label mb-2">
                    Select File (PDF, DOC, DOCX, TXT - Max 25MB)
                  </label>
                  <input
                    id="file-input"
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.txt"
                    className="block w-full text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 file:cursor-pointer"
                    aria-label="Upload document file"
                  />
                </div>

                {uploadFile && (
                  <div className="flex items-center gap-3">
                    <span style={{ color: 'var(--foreground)' }}>📄 {uploadFile.name}</span>
                    <Button
                      onClick={handleUpload}
                      disabled={uploading}
                      variant="primary"
                    >
                      {uploading ? t("dashboard.uploading") : t("dashboard.upload")}
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
                <p className="text-muted text-center py-8">
                  No documents uploaded yet. Upload your CV to get started!
                </p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {documents.map((doc) => (
                  <Card key={doc.id}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold" style={{ color: 'var(--foreground)' }}>{doc.filename}</p>
                        <p className="text-sm text-muted">{doc.doc_type}</p>
                        {doc.has_text && (
                          <p className="text-xs text-emerald-400 mt-1">
                            ✓ Text extracted
                          </p>
                        )}
                        <p className="text-xs text-muted mt-1">
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

          {/* Spontaneous Applications */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold">Spontaneous Outreach</h2>
              <span className="text-sm text-muted">Apply proactively without a job posting</span>
            </div>
            <Card>
              <form onSubmit={handleCreateSpontaneous} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label={t("dashboard.targetCompany")}
                    value={targetCompany}
                    onChange={setTargetCompany}
                    placeholder="ACME AG"
                    required
                  />

                  <Input
                    label={t("dashboard.targetRole")}
                    value={targetRole}
                    onChange={setTargetRole}
                    placeholder={t("dashboard.rolePlaceholder")}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium input-label mb-2">
                    Context & value proposition
                    <span className="block text-xs text-muted">
                      What makes you relevant? Mention business unit, pain points you solve, or projects to pitch.
                    </span>
                  </label>
                  <textarea
                    value={opportunityContext}
                    onChange={(e) => setOpportunityContext(e.target.value)}
                    className="input-base"
                    rows={4}
                    placeholder="I can help the data platform team modernize analytics pipelines and lead stakeholder workshops."
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="text-sm input-label">
                    <span className="block mb-2">Language for generated documents</span>
                    <select
                      value={documentationLanguage}
                      onChange={(e) => setDocumentationLanguage(e.target.value)}
                      className="input-base"
                    >
                      {languageOptions.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm input-label">
                    <span className="block mb-2">Language for company profile</span>
                    <select
                      value={companyProfileLanguage}
                      onChange={(e) => setCompanyProfileLanguage(e.target.value)}
                      className="input-base"
                    >
                      {languageOptions.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <Button type="submit" disabled={creatingSpontaneous || !targetCompany || !targetRole} variant="primary">
                  {creatingSpontaneous ? t("dashboard.saving") : t("dashboard.saveSpontaneous")}
                </Button>

                {spontaneousError && (
                  <p className="text-red-400 text-sm">{spontaneousError}</p>
                )}
              </form>
            </Card>
          </section>

          {/* Job Analysis */}
          <section>
            <h2 className="text-2xl font-bold mb-4">Add Job Offer</h2>
            <Card>
              <form onSubmit={handleAnalyzeJob} className="space-y-4">
                <Input
                  type="url"
                  label={t("dashboard.jobOfferUrl")}
                  value={jobUrl}
                  onChange={setJobUrl}
                  placeholder="https://example.com/job-posting"
                  required
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="text-sm input-label">
                    <span className="block mb-2">Language for generated documents</span>
                    <select
                      value={documentationLanguage}
                      onChange={(e) => setDocumentationLanguage(e.target.value)}
                      className="input-base"
                    >
                      {languageOptions.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm input-label">
                    <span className="block mb-2">Language for company profile</span>
                    <select
                      value={companyProfileLanguage}
                      onChange={(e) => setCompanyProfileLanguage(e.target.value)}
                      className="input-base"
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
                  {analyzing ? t("dashboard.analyzing") : t("dashboard.analyzeJob")}
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
                <p className="text-muted text-center py-8">
                  No applications yet. Add a job offer to get started!
                </p>
              </Card>
            ) : (
              <>
                {/* Filter and Sort Controls */}
                <Card>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium input-label mb-2">
                        Filter by Status
                      </label>
                      <select
                        value={filterApplied}
                        onChange={(e) => setFilterApplied(e.target.value)}
                        className="input-base"
                      >
                        <option value="all">All Applications</option>
                        <option value="applied">Applied Only</option>
                        <option value="not-applied">Not Applied</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium input-label mb-2">
                        Filter by Month
                      </label>
                      <select
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="input-base"
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
                      <label className="block text-sm font-medium input-label mb-2">
                        Sort by Date
                      </label>
                      <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                        className="input-base"
                      >
                        <option value="desc">Newest First</option>
                        <option value="asc">Oldest First</option>
                      </select>
                    </div>
                  </div>
                </Card>

                {filteredAndSortedApplications.length === 0 ? (
                  <Card>
                    <p className="text-muted text-center py-8">
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
                          <h3 className="font-semibold text-lg" style={{ color: 'var(--foreground)' }}>
                            {app.job_title}
                          </h3>
                          <p style={{ color: 'var(--foreground)' }}>{app.company}</p>
                          {app.is_spontaneous && (
                            <span className="inline-block mt-2 px-2 py-1 text-xs rounded bg-amber-900/50 text-amber-200 border border-amber-700">
                              Spontaneous outreach
                            </span>
                          )}
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
                      {(app.job_description || app.opportunity_context) && (
                        <div className="mt-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--input-background)' }}>
                          <p className="text-sm text-muted line-clamp-3">
                            {(() => {
                              // Convert newlines and tabs to spaces, then limit length
                              const previewSource = app.job_description || app.opportunity_context || "";
                              const cleanText = previewSource
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
                            : "chip"
                            }`}
                        >
                          {app.applied ? "✓ Applied" : t("dashboard.notApplied")}
                        </span>

                        {app.result && (
                          <span className="px-3 py-1 rounded chip">
                            {app.result}
                          </span>
                        )}

                        {app.created_at && (
                          <span className="text-muted">
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
                        {app.job_offer_id && (
                          <button
                            onClick={() => handleDownloadOriginalJobPDF(app.job_offer_id!, app.job_title, app.company)}
                            className="text-sm px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white inline-block"
                            title="Download original job posting PDF"
                          >
                            📄 Download Job PDF
                          </button>
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
          title={t("dashboard.updateApplicationStatus")}
        >
          <div className="space-y-4">
            <Input
              label={t("dashboard.newStatus")}
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

