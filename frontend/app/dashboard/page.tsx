"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
  application_type?: string; // fulltime, internship, apprenticeship
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
  const { t, locale } = useTranslation();
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
  const [applicationType, setApplicationType] = useState("fulltime"); // fulltime, internship, apprenticeship
  const [creatingSpontaneous, setCreatingSpontaneous] = useState(false);
  const [spontaneousError, setSpontaneousError] = useState("");

  // Status Modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [newStatus, setNewStatus] = useState("");

  // Active generations tracking
  const [hasActiveGenerations, setHasActiveGenerations] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{ completed: number; total: number } | null>(null);

  // Filtering and sorting
  const [filterApplied, setFilterApplied] = useState<string>("all"); // "all", "applied", "not-applied"
  const [filterMonth, setFilterMonth] = useState<string>("all"); // "all" or "YYYY-MM"
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Expanded job details tracking
  const [expandedJobs, setExpandedJobs] = useState<number[]>([]);

  // Destructive-action confirmation dialogs (replaces window.confirm()).
  type PendingDelete =
    | { kind: "document"; id: number; filename: string }
    | { kind: "application"; id: number; jobTitle: string };
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [confirmProcessing, setConfirmProcessing] = useState(false);

  const toggleJobExpanded = (appId: number) => {
    setExpandedJobs(prev => {
      if (prev.includes(appId)) {
        return prev.filter(id => id !== appId);
      } else {
        return [...prev, appId];
      }
    });
  };

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Restore scroll position when returning from detail page
  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem('dashboardScrollPosition');
    if (savedScrollPosition) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedScrollPosition, 10));
        sessionStorage.removeItem('dashboardScrollPosition');
      }, 100);
    }
  }, []);

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
        // Aggregate progress across ALL active tasks
        let totalCompleted = 0;
        let totalDocs = 0;

        for (const task of activeTasks) {
          try {
            const token = api.getToken();
            if (!token) {
              console.warn("No token available for polling");
              continue;
            }
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/applications/${task.appId}/generation-status/${task.taskId}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            if (response.ok) {
              const status = await response.json();

              // Aggregate progress from ALL active tasks
              if (status.total_docs && (status.status === "pending" || status.status === "processing")) {
                totalCompleted += status.completed_docs || 0;
                totalDocs += status.total_docs;
              }

              // Keep task if still processing
              if (status.status === "pending" || status.status === "processing") {
                stillActive.push(task);
              }
            } else {
              console.error(`Status check failed for task ${task.taskId}:`, response.status);
              // If error, keep task in list (will retry next poll)
              stillActive.push(task);
            }
          } catch (error) {
            console.error(`Exception checking task ${task.taskId}:`, error);
            // If error, keep task in list (will retry next poll)
            stillActive.push(task);
          }
        }

        // Update localStorage and state
        if (stillActive.length > 0) {
          localStorage.setItem("activeGenerationTasks", JSON.stringify(stillActive));
          setHasActiveGenerations(true);
          // Show aggregated progress across all active tasks
          setGenerationProgress(totalDocs > 0 ? { completed: totalCompleted, total: totalDocs } : null);
        } else {
          localStorage.removeItem("activeGenerationTasks");
          setHasActiveGenerations(false);
          setGenerationProgress(null);
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
        application_type: applicationType,
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
        application_type: applicationType,
        ui_language: resolveLanguageCode(user.mother_tongue || user.preferred_language, options),
        documentation_language: documentationLanguage,
        company_profile_language: companyProfileLanguage,
      });

      setTargetCompany("");
      setTargetRole("");
      setOpportunityContext("");
      setApplicationType("fulltime");
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

  const requestDeleteDocument = (id: number, filename: string) => {
    setPendingDelete({ kind: "document", id, filename });
  };

  const requestDeleteApplication = (id: number, jobTitle: string) => {
    setPendingDelete({ kind: "application", id, jobTitle });
  };

  const cancelPendingDelete = () => setPendingDelete(null);

  const performPendingDelete = async () => {
    if (!pendingDelete) return;
    setConfirmProcessing(true);
    try {
      if (pendingDelete.kind === "document") {
        await api.deleteDocument(pendingDelete.id);
      } else {
        await api.deleteApplication(pendingDelete.id);
      }
      await loadData();
      setPendingDelete(null);
    } catch (error: any) {
      const fallback =
        pendingDelete.kind === "document"
          ? (t("dashboard.deleteFailed") || "Dokument konnte nicht geloescht werden")
          : (t("dashboard.deleteApplicationFailed") || "Bewerbung konnte nicht geloescht werden");
      // Surface the failure to the existing error region instead of alert().
      // We reuse uploadError so the user sees it in the upload section header
      // for document deletes, and analysisError for application deletes.
      if (pendingDelete.kind === "document") {
        setUploadError(`${fallback}: ${error.message}`);
      } else {
        setAnalysisError(`${fallback}: ${error.message}`);
      }
      setPendingDelete(null);
    } finally {
      setConfirmProcessing(false);
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
      <div className="min-h-screen page-shell overflow-x-hidden">
        {/* Header */}
        <header className="border-b border-muted">
          <div className="container mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
                <img src="/logo.png" alt="EasyBewerbung" className="w-8 h-8 rounded-lg flex-shrink-0" />
                <span className="text-lg sm:text-xl font-bold truncate">EasyBewerbung</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                <span className="text-muted flex items-center gap-2 text-sm sm:text-base">
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
                          ? (t("dashboard.generatingProgress") || "Dokumente werden erstellt: {done} von {total}")
                              .replace("{done}", String(generationProgress.completed))
                              .replace("{total}", String(generationProgress.total))
                          : (t("dashboard.generating") || "Dokumente werden erstellt...")}
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
                <span className="px-2 sm:px-3 py-1 rounded bg-slate-800 text-xs sm:text-sm text-emerald-300 border border-emerald-700 whitespace-nowrap">
                  {t("common.credits") || "Credits"}: {user.credits}
                </span>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="btn-base btn-secondary flex items-center gap-2 text-sm px-2 sm:px-3 py-1.5 flex-shrink-0"
                  aria-pressed={theme === "light"}
                  aria-label={theme === "light"
                    ? (t("common.switchToDarkMode") || "Zu Dunkelmodus wechseln")
                    : (t("common.switchToLightMode") || "Zu Hellmodus wechseln")}
                  title={theme === "light"
                    ? (t("common.switchToDarkMode") || "Zu Dunkelmodus wechseln")
                    : (t("common.switchToLightMode") || "Zu Hellmodus wechseln")}
                >
                  <span aria-hidden>{theme === "light" ? "🌙" : "☀️"}</span>
                </button>
                {user.is_admin && (
                  <Button onClick={() => router.push("/admin")} variant="outline" className="hidden sm:inline-flex">
                    {t("common.admin") || "Admin"}
                  </Button>
                )}
                <Button onClick={() => router.push("/settings")} variant="outline" className="hidden sm:inline-flex">
                  {t("common.settings") || "Einstellungen"}
                </Button>
                <Button onClick={handleLogout} variant="outline" className="hidden sm:inline-flex">
                  {t("common.logout") || "Abmelden"}
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 sm:px-6 py-8 space-y-8 overflow-x-hidden">
          {/* Upload Section */}
          <section>
            <h2 className="text-2xl font-bold mb-4">{t("dashboard.uploadDocuments") || "Dokumente hochladen"}</h2>
            <Card>
              <div className="space-y-4">
                <div>
                  <label htmlFor="doc-type" className="block text-sm font-medium input-label mb-2">
                    {t("dashboard.documentType") || "Dokumenttyp"}
                  </label>
                  <select
                    id="doc-type"
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="input-base"
                  >
                    <option value="CV">{t("dashboard.docTypeCV") || "Lebenslauf"}</option>
                    <option value="REFERENCE">{t("dashboard.docTypeReference") || "Referenzschreiben"}</option>
                    <option value="DIPLOMA">{t("dashboard.docTypeDiploma") || "Diplom / Zeugnis"}</option>
                    <option value="COVER_LETTER">{t("dashboard.docTypeCoverLetter") || "Anschreiben"}</option>
                    <option value="OTHER">{t("dashboard.docTypeOther") || "Sonstiges"}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="file-input" className="block text-sm font-medium input-label mb-2">
                    {t("dashboard.selectFile") || "Datei auswaehlen (PDF, DOC, DOCX, TXT — max. 25 MB)"}
                  </label>
                  <input
                    id="file-input"
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.txt"
                    className="block w-full text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 file:cursor-pointer"
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
            <h2 className="text-2xl font-bold mb-4">{t("dashboard.yourDocuments") || "Ihre Dokumente"}</h2>
            {documents.length === 0 ? (
              <Card>
                <p className="text-muted text-center py-8">
                  {t("dashboard.noDocuments") || "Noch keine Dokumente hochgeladen. Laden Sie Ihren Lebenslauf hoch, um zu starten."}
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
                            {t("dashboard.textExtracted") || "✓ Text extrahiert"}
                          </p>
                        )}
                        <p className="text-xs text-muted mt-1">
                          {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => requestDeleteDocument(doc.id, doc.filename)}
                        className="text-red-400 hover:text-red-300 text-sm"
                        aria-label={
                          (t("dashboard.deleteDocumentAria") || "Dokument {name} loeschen")
                            .replace("{name}", doc.filename)
                        }
                      >
                        {t("common.delete") || "Loeschen"}
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
              <h2 className="text-2xl font-bold">{t("dashboard.spontaneousOutreach") || "Spontane Bewerbung"}</h2>
              <span className="text-sm text-muted">
                {t("dashboard.spontaneousSubtitle") || "Bewerben Sie sich proaktiv ohne Stelleninserat"}
              </span>
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
                    {t("dashboard.contextLabel") || "Kontext und Mehrwert"}
                    <span className="block text-xs text-muted">
                      {t("dashboard.contextHint")
                        || "Was macht Sie passend? Nennen Sie Abteilung, Probleme die Sie loesen, oder Projekte, die Sie pitchen wollen."}
                    </span>
                  </label>
                  <textarea
                    value={opportunityContext}
                    onChange={(e) => setOpportunityContext(e.target.value)}
                    className="input-base"
                    rows={4}
                    placeholder={
                      t("dashboard.contextPlaceholder")
                      || "Ich kann das Daten-Team beim Modernisieren der Analytics-Pipelines unterstuetzen und Stakeholder-Workshops leiten."
                    }
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <label className="text-sm input-label">
                    <span className="block mb-2">{t("dashboard.applicationType") || "Application Type"}</span>
                    <select
                      value={applicationType}
                      onChange={(e) => setApplicationType(e.target.value)}
                      className="input-base"
                    >
                      <option value="fulltime">{t("dashboard.fulltime") || "Full-time Position"}</option>
                      <option value="internship">{t("dashboard.internship") || "Internship (Praktikum)"}</option>
                      <option value="apprenticeship">{t("dashboard.apprenticeship") || "Apprenticeship (Lehrstelle)"}</option>
                    </select>
                    <span className="text-xs text-muted block mt-1">
                      {applicationType === "internship"
                        ? (t("dashboard.internshipHint") || "For practical training positions")
                        : applicationType === "apprenticeship"
                        ? (t("dashboard.apprenticeshipHint") || "For vocational training positions")
                        : ""}
                    </span>
                  </label>

                  <label className="text-sm input-label">
                    <span className="block mb-2">{t("dashboard.languageDocs") || "Sprache der generierten Dokumente"}</span>
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
                    <span className="block mb-2">{t("dashboard.languageProfile") || "Sprache des Firmenportraits"}</span>
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
            <h2 className="text-2xl font-bold mb-4">{t("dashboard.addJobOffer") || "Stellenangebot hinzufuegen"}</h2>
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

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <label className="text-sm input-label">
                    <span className="block mb-2">{t("dashboard.applicationType") || "Application Type"}</span>
                    <select
                      value={applicationType}
                      onChange={(e) => setApplicationType(e.target.value)}
                      className="input-base"
                    >
                      <option value="fulltime">{t("dashboard.fulltime") || "Full-time Position"}</option>
                      <option value="internship">{t("dashboard.internship") || "Internship (Praktikum)"}</option>
                      <option value="apprenticeship">{t("dashboard.apprenticeship") || "Apprenticeship (Lehrstelle)"}</option>
                    </select>
                  </label>

                  <label className="text-sm input-label">
                    <span className="block mb-2">{t("dashboard.languageDocs") || "Sprache der generierten Dokumente"}</span>
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
                    <span className="block mb-2">{t("dashboard.languageProfile") || "Sprache des Firmenportraits"}</span>
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
              <h2 className="text-2xl font-bold">{t("dashboard.yourApplications") || "Ihre Bewerbungen"}</h2>
              {applications.length > 0 && (
                <Button onClick={handleDownloadRAV} variant="outline">
                  {t("dashboard.downloadRAV") || "🇨🇭 RAV-Report herunterladen"}
                </Button>
              )}
            </div>

            {applications.length === 0 ? (
              <Card>
                <p className="text-muted text-center py-8">
                  {t("dashboard.noApplications") || "Noch keine Bewerbungen. Fuegen Sie ein Stellenangebot hinzu, um zu starten."}
                </p>
              </Card>
            ) : (
              <>
                {/* Filter and Sort Controls */}
                <Card>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium input-label mb-2">
                        {t("dashboard.filterByStatus") || "Nach Status filtern"}
                      </label>
                      <select
                        value={filterApplied}
                        onChange={(e) => setFilterApplied(e.target.value)}
                        className="input-base"
                      >
                        <option value="all">{t("dashboard.allApplications") || "Alle Bewerbungen"}</option>
                        <option value="applied">{t("dashboard.appliedOnly") || "Nur beworben"}</option>
                        <option value="not-applied">{t("dashboard.notAppliedOnly") || "Nicht beworben"}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium input-label mb-2">
                        {t("dashboard.filterByMonth") || "Nach Monat filtern"}
                      </label>
                      <select
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="input-base"
                      >
                        <option value="all">{t("dashboard.allMonths") || "Alle Monate"}</option>
                        {availableMonths.map((month) => (
                          <option key={month} value={month}>
                            {new Date(month + "-01").toLocaleDateString(locale, {
                              year: "numeric",
                              month: "long",
                            })}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium input-label mb-2">
                        {t("dashboard.sortByDate") || "Nach Datum sortieren"}
                      </label>
                      <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                        className="input-base"
                      >
                        <option value="desc">{t("dashboard.newestFirst") || "Neueste zuerst"}</option>
                        <option value="asc">{t("dashboard.oldestFirst") || "Aelteste zuerst"}</option>
                      </select>
                    </div>
                  </div>
                </Card>

                {filteredAndSortedApplications.length === 0 ? (
                  <Card>
                    <p className="text-muted text-center py-8">
                      {t("dashboard.noFilterMatch") || "Keine Bewerbungen entsprechen Ihren Filtern."}
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {filteredAndSortedApplications.map((app) => (
                  <Card key={app.id}>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <button
                              onClick={() => toggleJobExpanded(app.id)}
                              className="text-muted hover:text-foreground transition-colors mt-1 flex-shrink-0"
                              aria-label={expandedJobs.includes(app.id)
                                ? (t("dashboard.collapseDetails") || "Details einklappen")
                                : (t("dashboard.expandDetails") || "Details ausklappen")}
                              aria-expanded={expandedJobs.includes(app.id)}
                            >
                              <svg
                                className={`w-5 h-5 transition-transform ${expandedJobs.includes(app.id) ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-lg break-words" style={{ color: 'var(--foreground)' }}>
                                {app.job_title} - {app.company}
                              </h3>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Collapsible Job Details */}
                      {expandedJobs.includes(app.id) ? (
                        <div className="space-y-3 pl-7">
                          <div className="flex gap-2 flex-wrap">
                            {app.is_spontaneous && (
                              <span className="inline-block px-2 py-1 text-xs rounded bg-amber-900/50 text-amber-200 border border-amber-700">
                                {t("dashboard.spontaneousBadge") || "Spontanbewerbung"}
                              </span>
                            )}
                            {app.application_type === "internship" && (
                              <span className="inline-block px-2 py-1 text-xs rounded bg-purple-900/50 text-purple-200 border border-purple-700">
                                {t("dashboard.internshipBadge") || "Praktikum"}
                              </span>
                            )}
                            {app.application_type === "apprenticeship" && (
                              <span className="inline-block px-2 py-1 text-xs rounded bg-blue-900/50 text-blue-200 border border-blue-700">
                                {t("dashboard.apprenticeshipBadge") || "Lehrstelle"}
                              </span>
                            )}
                          </div>
                          {app.job_offer_url && (
                            <a
                              href={app.job_offer_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-indigo-400 hover:text-indigo-300 break-all block"
                            >
                              {t("dashboard.viewJobPosting") || "Stelleninserat ansehen"} →
                            </a>
                          )}

                          {/* Job Description - Formatted */}
                          {(app.job_description || app.opportunity_context) && (
                            <div className="p-4 rounded-lg space-y-3" style={{ backgroundColor: 'var(--input-background)' }}>
                              {(app.job_description || app.opportunity_context)!.split('\n\n').map((section: string, idx: number) => {
                                const trimmed = section.trim();
                                if (!trimmed) return null;

                                // Check if section is a header (ends with :)
                                const isHeader = trimmed.match(/^[^:]+:$/);

                                // Check if section contains bullet points
                                const lines = trimmed.split('\n');
                                const hasBullets = lines.some(line => line.trim().match(/^[•\-\*]\s/));

                                if (isHeader) {
                                  return (
                                    <h4 key={idx} className="font-semibold text-base mt-4 mb-2" style={{ color: 'var(--foreground)' }}>
                                      {trimmed}
                                    </h4>
                                  );
                                } else if (hasBullets) {
                                  return (
                                    <ul key={idx} className="list-disc list-inside space-y-1 text-sm ml-2" style={{ color: 'var(--foreground)' }}>
                                      {lines.map((line, lineIdx) => {
                                        const bulletMatch = line.trim().match(/^[•\-\*]\s*(.+)/);
                                        if (bulletMatch) {
                                          return <li key={lineIdx}>{bulletMatch[1]}</li>;
                                        }
                                        return line.trim() ? <li key={lineIdx}>{line.trim()}</li> : null;
                                      })}
                                    </ul>
                                  );
                                } else {
                                  return (
                                    <p key={idx} className="text-sm whitespace-pre-wrap break-words" style={{ color: 'var(--foreground)' }}>
                                      {trimmed}
                                    </p>
                                  );
                                }
                              })}
                            </div>
                          )}
                        </div>
                      ) : null}

                      <div className="flex items-center gap-4 text-sm flex-wrap">
                        <span
                          className={`px-3 py-1 rounded ${app.applied
                            ? "bg-emerald-900/30 text-emerald-400"
                            : "chip"
                            }`}
                        >
                          {app.applied
                            ? `✓ ${t("dashboard.applied") || "Beworben"}`
                            : (t("dashboard.notApplied") || "Nicht beworben")}
                        </span>

                        {app.result && (
                          <span className="px-3 py-1 rounded chip">
                            {app.result}
                          </span>
                        )}

                        {app.created_at && (
                          <span className="text-muted">
                            {t("dashboard.addedOn") || "Hinzugefuegt"}{" "}
                            {new Date(app.created_at).toLocaleString(locale, {
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
                          onClick={() => {
                            // Save scroll position before navigating
                            sessionStorage.setItem('dashboardScrollPosition', window.scrollY.toString());
                            router.push(`/applications/${app.id}`);
                          }}
                          className="text-sm px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          {t("dashboard.viewDetails") || "Details ansehen"} →
                        </button>

                        {!app.applied && (
                          <button
                            onClick={() => handleUpdateApplicationStatus(app.id, true)}
                            className="text-sm px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            {t("dashboard.markAsApplied") || "Als beworben markieren"}
                          </button>
                        )}

                        <button
                          onClick={() => openStatusModal(app.id, app.result ?? null)}
                          className="text-sm px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
                        >
                          {t("dashboard.updateStatus") || "Status aktualisieren"}
                        </button>

                        {app.job_offer_url && (
                          <a
                            href={app.job_offer_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white inline-block"
                            title={t("dashboard.viewOriginalPosting") || "Original-Inserat ansehen"}
                          >
                            🔗 {t("dashboard.viewOriginalPosting") || "Original-Inserat ansehen"}
                          </a>
                        )}
                        {app.job_offer_id && (
                          <button
                            onClick={() => handleDownloadOriginalJobPDF(app.job_offer_id!, app.job_title, app.company)}
                            className="text-sm px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white inline-block"
                            title={t("dashboard.downloadJobPdfTitle") || "Original-Stelleninserat als PDF herunterladen"}
                          >
                            📄 {t("dashboard.downloadJobPdf") || "Stelleninserat (PDF)"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => requestDeleteApplication(app.id, app.job_title)}
                          className="text-sm px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white"
                          title={t("dashboard.deleteThisApplication") || "Diese Bewerbung loeschen"}
                        >
                          🗑️ {t("common.delete") || "Loeschen"}
                        </button>
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
              placeholder={t("dashboard.statusPlaceholder") || "z.B. Interview, Abgesagt, Angebot"}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setStatusModalOpen(false)}>
                {t("common.cancel") || "Abbrechen"}
              </Button>
              <Button variant="primary" onClick={submitStatusUpdate}>
                {t("dashboard.updateStatus") || "Status aktualisieren"}
              </Button>
            </div>
          </div>
        </Modal>

        <ConfirmDialog
          isOpen={!!pendingDelete}
          title={
            pendingDelete?.kind === "application"
              ? (t("dashboard.confirmDeleteApplicationTitle") || "Bewerbung loeschen?")
              : (t("dashboard.confirmDeleteDocumentTitle") || "Dokument loeschen?")
          }
          description={
            pendingDelete?.kind === "application" ? (
              <>
                <p className="font-medium mb-2">
                  {(t("dashboard.confirmDeleteApplicationLead")
                    || "Sie sind dabei, die Bewerbung «{title}» dauerhaft zu loeschen.")
                    .replace("{title}", pendingDelete?.jobTitle ?? "")}
                </p>
                <p className="text-muted">
                  {t("dashboard.confirmDeleteApplicationConsequence")
                    || "Alle dafuer generierten Dokumente werden ebenfalls entfernt. Diese Aktion kann nicht rueckgaengig gemacht werden."}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium mb-2">
                  {(t("dashboard.confirmDeleteDocumentLead")
                    || "Sie sind dabei, das Dokument «{name}» dauerhaft zu loeschen.")
                    .replace("{name}", pendingDelete?.kind === "document" ? pendingDelete.filename : "")}
                </p>
                <p className="text-muted">
                  {t("dashboard.confirmDeleteDocumentConsequence")
                    || "Diese Aktion kann nicht rueckgaengig gemacht werden."}
                </p>
              </>
            )
          }
          confirmLabel={
            confirmProcessing
              ? (t("common.deleting") || "Wird geloescht…")
              : (t("common.delete") || "Loeschen")
          }
          cancelLabel={t("common.cancel") || "Abbrechen"}
          variant="danger"
          isProcessing={confirmProcessing}
          onConfirm={performPendingDelete}
          onCancel={cancelPendingDelete}
        />
      </div>
    </ErrorBoundary>
  );
}

