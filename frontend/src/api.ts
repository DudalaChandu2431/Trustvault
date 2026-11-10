const API_BASE = "http://127.0.0.1:8001/api/v1";

export interface User {
  id: number;
  email: string;
  role: string;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  sha256_hash: string;
  key_version: number;
  owner_id: number;
  created_at: string;
}

export interface Permission {
  id: number;
  document_id: string;
  user_id: number;
  user_email: string;
  permission_type: string;
  status: string;
  granted_by: number;
  granted_at: string;
  revoked_at?: string;
}

export interface AuditLog {
  id: number;
  sequence: number;
  timestamp: string;
  actor_id?: number;
  action: string;
  target_type: string;
  target_id?: string;
  payload_json: string;
  previous_hash: string;
  record_hash: string;
}

export interface VerifyChainResponse {
  status: "VERIFIED" | "TAMPERED";
  total_records?: number;
  broken_at_sequence?: number;
  detail?: string;
  message?: string;
}

export const api = {
  getToken: () => localStorage.getItem("tv_token") || "",
  setToken: (token: string) => localStorage.setItem("tv_token", token),
  clearToken: () => localStorage.removeItem("tv_token"),

  headers: () => ({
    "Content-Type": "application/json",
    ...(localStorage.getItem("tv_token") ? { Authorization: `Bearer ${localStorage.getItem("tv_token")}` } : {})
  }),

  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Login failed" }));
      throw new Error(err.detail || "Login failed");
    }
    const data = await res.json();
    this.setToken(data.access_token);
    return data;
  },

  async register(email: string, password: string, confirmPassword?: string, role = "USER") {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, confirm_password: confirmPassword ?? password, role })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Registration failed" }));
      throw new Error(err.detail || "Registration failed");
    }
    return res.json();
  },

  async getMe(): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: this.headers()
    });
    if (!res.ok) throw new Error("Failed to get profile");
    return res.json();
  },

  async getDocuments(): Promise<DocumentItem[]> {
    const res = await fetch(`${API_BASE}/documents`, {
      headers: this.headers()
    });
    if (!res.ok) throw new Error("Failed to load documents");
    return res.json();
  },

  async uploadDocument(file: File): Promise<DocumentItem> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/documents`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.getToken()}`
      },
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },

  async downloadDocument(docId: string, filename: string) {
    const res = await fetch(`${API_BASE}/documents/${docId}/download`, {
      headers: this.headers()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Download failed" }));
      throw new Error(err.detail || "Download failed / Access denied");
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  },

  async deleteDocument(docId: string) {
    const res = await fetch(`${API_BASE}/documents/${docId}`, {
      method: "DELETE",
      headers: this.headers()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Delete failed" }));
      throw new Error(err.detail || "Delete failed");
    }
    return res.json();
  },

  async getPermissions(docId: string): Promise<Permission[]> {
    const res = await fetch(`${API_BASE}/documents/${docId}/permissions`, {
      headers: this.headers()
    });
    if (!res.ok) throw new Error("Failed to load permissions");
    return res.json();
  },

  async grantPermission(docId: string, userEmail: string, permissionType = "READ"): Promise<Permission> {
    const res = await fetch(`${API_BASE}/documents/${docId}/permissions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ user_email: userEmail, permission_type: permissionType })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to grant permission" }));
      throw new Error(err.detail || "Failed to grant permission");
    }
    return res.json();
  },

  async revokePermission(docId: string, userId: number) {
    const res = await fetch(`${API_BASE}/documents/${docId}/permissions/${userId}`, {
      method: "DELETE",
      headers: this.headers()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to revoke permission" }));
      throw new Error(err.detail || "Failed to revoke permission");
    }
    return res.json();
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch(`${API_BASE}/audit/logs`, {
      headers: this.headers()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to load audit logs (Admin only)" }));
      throw new Error(err.detail || "Failed to load audit logs");
    }
    return res.json();
  },

  async verifyAuditChain(): Promise<VerifyChainResponse> {
    const res = await fetch(`${API_BASE}/audit/verify`, {
      method: "POST",
      headers: this.headers()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Verification failed (Admin only)" }));
      throw new Error(err.detail || "Verification failed");
    }
    return res.json();
  }
};
