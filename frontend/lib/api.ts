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
  credits: number;
  created_at: string;
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
    console.log("💾 Setting token:", token ? `${token.substring(0, 20)}...` : "null");
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem("access_token", token);
        console.log("✅ Token saved to localStorage");
      } else {
        localStorage.removeItem("access_token");
        console.log("🗑️ Token removed from localStorage");
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
      console.log("🔑 Loaded token from localStorage:", this.token ? `${this.token.substring(0, 20)}...` : "null");
    }

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
      console.log(`🚀 Making ${options.method || "GET"} request to ${endpoint} with token`);
    } else {
      console.log(`🚀 Making ${options.method || "GET"} request to ${endpoint} WITHOUT token`);
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
  ) {
    const data = await this.request<TokenResponse>("/users/google", {
      method: "POST",
      body: JSON.stringify({
        credential,
        preferred_language: preferredLanguage,
        mother_tongue: motherTongue,
        documentation_language: documentationLanguage,
      }),
    });

    this.setToken(data.access_token);
    return data;
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
  ) {
    return this.request<User>("/users/me", {
      method: "PATCH",
      body: JSON.stringify({
        full_name: fullName,
        preferred_language: preferredLanguage,
        mother_tongue: motherTongue,
        documentation_language: documentationLanguage,
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
}

export const api = new ApiClient(API_BASE_URL);
export default api;
