const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiError {
  detail: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  preferred_language: string;
  mother_tongue: string;
  documentation_language: string;
  // Extended profile fields
  employment_status?: string | null; // "employed", "unemployed", "student", "transitioning"
  education_type?: string | null; // "wms", "bms", "university", "apprenticeship", "other"
  additional_profile_context?: string | null; // Free text for additional info
  credits: number;
  created_at: string;
  is_admin: boolean;
  is_active: boolean;
  last_login_at?: string | null;
  password_changed_at?: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Document {
  id: number;
  filename: string;
  doc_type: string;
  has_text: boolean;
  created_at?: string;
}

export interface JobAnalysisResponse {
  title: string | null;
  company: string | null;
  description: string | null;
  requirements: string | null;
  url: string;
  saved_id: number | null;
}

export interface GeneratedDocument {
  id: number;
  doc_type: string;
  format: string;
  storage_path: string;
  created_at: string;
}

export interface Application {
  id: number;
  job_title: string;
  company: string;
  job_offer_url: string | null;
  is_spontaneous: boolean;
  opportunity_context: string | null;
  application_type: string; // "fulltime", "internship", "apprenticeship"
  job_description: string | null;
  applied: boolean;
  applied_at: string | null;
  result: string | null;
  ui_language: string;
  documentation_language: string;
  company_profile_language: string;
  created_at: string;
  generated_documents: GeneratedDocument[];
}

export interface LanguageOption {
  code: string;
  label: string;
  direction: "ltr" | "rtl";
}

export type LanguageListResponse = LanguageOption[];

export interface AdminLanguageSetting {
  id: number;
  code: string;
  label: string;
  direction: "ltr" | "rtl";
  is_active: boolean;
  sort_order: number;
}

export interface AdminUserSummary {
  id: number;
  email: string;
  full_name?: string | null;
  is_admin: boolean;
  is_active: boolean;
  credits: number;
  last_login_at?: string | null;
}

export interface ActivityEntry {
  action: string;
  ip_address?: string | null;
  metadata?: string | null;
  created_at: string;
}

export interface AdminUserDetail {
  user: User;
  activity: ActivityEntry[];
}

export interface PromptTemplate {
  id: number;
  doc_type: string;
  name: string;
  content: string;
  updated_at: string;
}

export interface DocumentTemplate {
  id: number;
  doc_type: string;
  display_name: string;
  credit_cost: number;
  language_source: 'preferred_language' | 'mother_tongue' | 'documentation_language';
  llm_provider: string;
  llm_model: string;
  prompt_template: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface DocumentTemplateUpdate {
  display_name?: string;
  credit_cost?: number;
  language_source?: 'preferred_language' | 'mother_tongue' | 'documentation_language';
  llm_provider?: string;
  llm_model?: string;
  prompt_template?: string;
  is_active?: boolean;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;

    // Load token from localStorage if available
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("access_token");
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem("access_token", token);
      } else {
        localStorage.removeItem("access_token");
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    // Always try to get the latest token from localStorage if not in memory
    if (!this.token && typeof window !== "undefined") {
      this.token = localStorage.getItem("access_token");
    }

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: "An error occurred",
      }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Authentication
  async register(
    email: string,
    password: string,
    fullName?: string,
    preferredLanguage = "en",
    motherTongue = "en",
    documentationLanguage = "en",
    privacyPolicyAccepted = false,
  ) {
    const data = await this.request<TokenResponse>("/users/register", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
        preferred_language: preferredLanguage,
        mother_tongue: motherTongue,
        documentation_language: documentationLanguage,
        privacy_policy_accepted: privacyPolicyAccepted,
      }),
    });

    this.setToken(data.access_token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request<TokenResponse>("/users/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    this.setToken(data.access_token);
    return data;
  }

  async googleLogin(
    credential: string,
    preferredLanguage = "en",
    motherTongue = "en",
    documentationLanguage = "en",
    privacyPolicyAccepted = false,
  ) {
    const data = await this.request<TokenResponse>("/users/google", {
      method: "POST",
      body: JSON.stringify({
        credential,
        preferred_language: preferredLanguage,
        mother_tongue: motherTongue,
        documentation_language: documentationLanguage,
        privacy_policy_accepted: privacyPolicyAccepted,
      }),
    });

    this.setToken(data.access_token);
    return data;
  }

  async getPrivacyPolicy() {
    return this.request<{ policy: string }>("/users/privacy-policy");
  }

  async getCurrentUser() {
    return this.request<User>("/users/me");
  }

  async listLanguages() {
    return this.request<LanguageListResponse>("/users/languages");
  }

  async updateUser(
    fullName?: string,
    preferredLanguage?: string,
    motherTongue?: string,
    documentationLanguage?: string,
    employmentStatus?: string,
    educationType?: string,
    additionalProfileContext?: string,
  ) {
    return this.request<User>("/users/me", {
      method: "PATCH",
      body: JSON.stringify({
        full_name: fullName,
        preferred_language: preferredLanguage,
        mother_tongue: motherTongue,
        documentation_language: documentationLanguage,
        employment_status: employmentStatus,
        education_type: educationType,
        additional_profile_context: additionalProfileContext,
      }),
    });
  }

  logout() {
    this.setToken(null);
  }

  // Documents
  async uploadDocument(file: File, docType = "CV") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("doc_type", docType);

    const headers: HeadersInit = {};
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}/documents/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: "Upload failed",
      }));
      throw new Error(error.detail);
    }

    return response.json();
  }

  async listDocuments() {
    return this.request<Document[]>("/documents/");
  }

  async deleteDocument(id: number) {
    return this.request(`/documents/${id}`, { method: "DELETE" });
  }

  async getDocumentCatalog() {
    return this.request<any>("/documents/catalog");
  }

  async getAvailableDocTypes() {
    const catalog = await this.getDocumentCatalog();
    const allDocs = [
      ...(catalog.catalog?.essential_pack || []),
      ...(catalog.catalog?.high_impact_addons || []),
      ...(catalog.catalog?.premium_documents || [])
    ];
    return allDocs;
  }

  // Jobs
  async analyzeJob(url: string) {
    return this.request<JobAnalysisResponse>("/jobs/analyze", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
  }

  // Applications
  async createApplication(data: {
    job_title: string;
    company: string;
    job_offer_url?: string;
    is_spontaneous?: boolean;
    opportunity_context?: string;
    application_type?: string; // "fulltime", "internship", "apprenticeship"
    applied?: boolean;
    applied_at?: string;
    result?: string;
    ui_language?: string;
    documentation_language?: string;
    company_profile_language?: string;
  }) {
    return this.request<Application>("/applications/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async createSpontaneousApplication(data: {
    job_title: string;
    company: string;
    opportunity_context?: string;
    application_type?: string; // "fulltime", "internship", "apprenticeship"
    ui_language?: string;
    documentation_language?: string;
    company_profile_language?: string;
  }) {
    return this.createApplication({
      ...data,
      is_spontaneous: true,
    });
  }

  async updateApplication(
    id: number,
    data: {
      applied?: boolean;
      applied_at?: string;
      result?: string;
    }
  ) {
    return this.request<Application>(`/applications/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getApplication(id: number) {
    return this.request<Application>(`/applications/${id}`);
  }

  async listApplications() {
    return this.request<Application[]>("/applications/history");
  }

  async getRAVReport() {
    return this.request<any>("/applications/rav-report");
  }

  async attachDocuments(applicationId: number, documents: any[]) {
    return this.request<Application>(`/applications/${applicationId}/documents`, {
      method: "POST",
      body: JSON.stringify({ documents }),
    });
  }

  async getMatchingScore(applicationId: number, recalculate: boolean = false) {
    const params = recalculate ? "?recalculate=true" : "";
    return this.request<any>(`/applications/${applicationId}/matching-score${params}`);
  }

  async generateDocuments(applicationId: number, docTypes: string[]) {
    return this.request<any>(`/applications/${applicationId}/generate`, {
      method: "POST",
      body: JSON.stringify(docTypes),
    });
  }

  // Admin endpoints
  async adminListLanguages() {
    return this.request<AdminLanguageSetting[]>("/admin/languages");
  }

  async adminUpdateLanguages(payload: Pick<AdminLanguageSetting, "code" | "is_active" | "sort_order">[]) {
    return this.request<AdminLanguageSetting[]>("/admin/languages", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async adminSearchUsers(query?: string) {
    const suffix = query ? `?query=${encodeURIComponent(query)}` : "";
    return this.request<AdminUserSummary[]>(`/admin/users${suffix}`);
  }

  async adminGetUserDetail(userId: number) {
    return this.request<AdminUserDetail>(`/admin/users/${userId}`);
  }

  async adminUpdateCredits(userId: number, amount: number, reason?: string) {
    return this.request<AdminUserDetail>(`/admin/users/${userId}/credits`, {
      method: "POST",
      body: JSON.stringify({ amount, reason }),
    });
  }

  async adminToggleActive(userId: number, isActive: boolean) {
    return this.request<AdminUserDetail>(`/admin/users/${userId}/active`, {
      method: "POST",
      body: JSON.stringify({ is_active: isActive }),
    });
  }

  async adminToggleAdmin(userId: number, isAdmin: boolean) {
    return this.request<AdminUserDetail>(`/admin/users/${userId}/admin`, {
      method: "POST",
      body: JSON.stringify({ is_admin: isAdmin }),
    });
  }

  async adminListPrompts() {
    return this.request<PromptTemplate[]>("/admin/prompts");
  }

  async adminUpdatePrompt(promptId: number, name?: string, content?: string) {
    return this.request<PromptTemplate>(`/admin/prompts/${promptId}`, {
      method: "PUT",
      body: JSON.stringify({ name, content }),
    });
  }

  // Document Template endpoints
  async getDocumentTemplates() {
    return this.request<DocumentTemplate[]>("/admin/document-templates/");
  }

  async getDocumentTemplate(id: number) {
    return this.request<DocumentTemplate>(`/admin/document-templates/${id}`);
  }

  async updateDocumentTemplate(id: number, data: DocumentTemplateUpdate) {
    return this.request<DocumentTemplate>(`/admin/document-templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteDocumentTemplate(id: number) {
    return this.request<{ message: string }>(`/admin/document-templates/${id}`, {
      method: "DELETE",
    });
  }

  async seedDocumentTemplates(forceUpdate: boolean = false) {
    const params = forceUpdate ? "?force_update=true" : "";
    return this.request<{ message: string; created: number; updated: number; skipped: number; total: number }>(
      `/admin/document-templates/seed${params}`,
      { method: "POST" }
    );
  }

  async downloadJobDescriptionPDF(applicationId: number) {
    const headers: HeadersInit = {};
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}/applications/${applicationId}/job-description-pdf`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error("Failed to download PDF");
    }

    return response.blob();
  }

  async downloadOriginalJobPDF(jobOfferId: number) {
    const headers: HeadersInit = {};
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}/jobs/${jobOfferId}/original-pdf`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error("Failed to download original job PDF");
    }

    return response.blob();
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;
