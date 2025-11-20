const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiError {
  detail: string;
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
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

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
  async register(email: string, password: string, fullName?: string, preferredLanguage = "en") {
    const data = await this.request<{
      access_token: string;
      token_type: string;
      user: any;
    }>("/users/register", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
        preferred_language: preferredLanguage,
      }),
    });

    this.setToken(data.access_token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request<{
      access_token: string;
      token_type: string;
      user: any;
    }>("/users/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    this.setToken(data.access_token);
    return data;
  }

  async getCurrentUser() {
    return this.request<any>("/users/me");
  }

  async updateUser(fullName?: string, preferredLanguage?: string) {
    return this.request<any>("/users/me", {
      method: "PATCH",
      body: JSON.stringify({
        full_name: fullName,
        preferred_language: preferredLanguage,
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
    return this.request<any[]>("/documents/");
  }

  async deleteDocument(id: number) {
    return this.request(`/documents/${id}`, { method: "DELETE" });
  }

  async getDocumentCatalog() {
    return this.request<any>("/documents/catalog");
  }

  // Jobs
  async analyzeJob(url: string) {
    return this.request<any>("/jobs/analyze", {
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
  }) {
    return this.request<any>("/applications/", {
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
    return this.request<any>(`/applications/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getApplication(id: number) {
    return this.request<any>(`/applications/${id}`);
  }

  async listApplications() {
    return this.request<any[]>("/applications/history");
  }

  async getRAVReport() {
    return this.request<any>("/applications/rav-report");
  }

  async attachDocuments(applicationId: number, documents: any[]) {
    return this.request<any>(`/applications/${applicationId}/documents`, {
      method: "POST",
      body: JSON.stringify({ documents }),
    });
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;
