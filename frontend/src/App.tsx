import React, { useState, useEffect } from "react";
import {
  Shield,
  Lock,
  FileText,
  Key,
  Users,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Download,
  Trash2,
  UserCheck,
  ShieldAlert,
  LogOut,
  RefreshCw,
  Copy,
  Check,
  FileCheck,
  Settings as SettingsIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api, type User, type DocumentItem, type Permission, type AuditLog, type VerifyChainResponse } from "./api";
import AuthScreen from "./components/AuthScreen";
import Modal from "./components/Modal";
import { ToastContainer, type Toast } from "./components/Toast";
import DashboardPage, { type DashboardActivity } from "./components/DashboardPage";
import SettingsPage from "./components/SettingsPage";

const PAGE_EASE = [0.22, 1, 0.36, 1] as const;

let toastSeq = 0;

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("admin@trustvault.local");
  const [authPassword, setAuthPassword] = useState("Admin@123");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Tabs: 'dashboard' | 'vault' | 'access' | 'audit' | 'threats' | 'settings'
  const [activeTab, setActiveTab] = useState<"dashboard" | "vault" | "access" | "audit" | "threats" | "settings">("dashboard");

  // Documents
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [docError, setDocError] = useState("");

  // Permissions Modal
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permLoading, setPermLoading] = useState(false);
  const [grantEmail, setGrantEmail] = useState("");
  const [grantType, setGrantType] = useState("READ");
  const [permMsg, setPermMsg] = useState("");

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [chainStatus, setChainStatus] = useState<VerifyChainResponse | null>(null);
  const [verifyingChain, setVerifyingChain] = useState(false);

  // Copied hash state
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Toasts & OAuth popups
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [googleOpen, setGoogleOpen] = useState(false);
  const [twitterOpen, setTwitterOpen] = useState(false);
  const [oauthConfig, setOAuthConfig] = useState<{
    google_client_id: string;
    twitter_client_id: string;
    google_enabled: boolean;
    twitter_enabled: boolean;
  }>({
    google_client_id: "",
    twitter_client_id: "",
    google_enabled: false,
    twitter_enabled: false,
  });

  function notify(type: Toast["type"], message: string) {
    const id = ++toastSeq;
    setToasts((t) => [...t, { id, type, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }
  function dismissToast(id: number) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  useEffect(() => {
    if (api.getToken()) {
      loadProfile();
    }
    // Fetch OAuth availability
    api.getOAuthConfig().then((cfg) => {
      setOAuthConfig(cfg);
      // Dynamically load Google Identity Services script if client_id present
      if (cfg.google_client_id && !(window as any).google) {
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.defer = true;
        document.body.appendChild(s);
      }
    }).catch(() => {});

    // Check URL query parameters for OAuth callbacks (e.g. from Twitter / Google redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const oauthCode = urlParams.get("code");
    const oauthError = urlParams.get("error");

    if (oauthError) {
      notify("error", `OAuth error: ${oauthError}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (oauthCode) {
      const storedVerifier = sessionStorage.getItem("x_code_verifier") || undefined;
      setAuthLoading(true);
      api.loginWithTwitter(oauthCode, storedVerifier, window.location.origin + "/auth/callback")
        .then(() => {
          sessionStorage.removeItem("x_code_verifier");
          loadProfile();
          notify("success", "Signed in via X (Twitter)! Vault unlocked.");
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch((err) => {
          notify("error", err.message || "Twitter login failed");
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .finally(() => setAuthLoading(false));
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      if (activeTab === "vault" || activeTab === "dashboard") loadDocuments();
      if (activeTab === "audit" && currentUser.role === "ADMIN") {
        loadAuditLogs();
        verifyChain();
      }
      if (activeTab === "dashboard" && currentUser.role === "ADMIN") {
        verifyChain();
        loadAuditLogs();
      }
    }
  }, [currentUser, activeTab]);

  const dashboardActivity: DashboardActivity[] = auditLogs.map((log) => {
    let action = log.action;
    try {
      const p = JSON.parse(log.payload_json || "{}");
      if (p.email) action = `${log.action} · ${p.email}`;
      if (p.filename) action = `${log.action} · ${p.filename}`;
    } catch {
      /* keep raw action */
    }
    return {
      time: new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      action,
      actor: log.target_type,
      ok: !/REVOKE|DENIED|FAIL|ANOMAL/i.test(log.action),
    };
  });

  async function loadProfile() {
    try {
      const user = await api.getMe();
      setCurrentUser(user);
    } catch {
      api.clearToken();
      setCurrentUser(null);
    }
  }

  function handleGoogleTrigger() {
    if (oauthConfig.google_enabled && (window as any).google) {
      // Use Google Identity Services One Tap / Token Client
      const client = (window as any).google.accounts.id;
      client.initialize({
        client_id: oauthConfig.google_client_id,
        callback: async (response: any) => {
          if (response.credential) {
            setAuthLoading(true);
            try {
              await api.loginWithGoogle(response.credential);
              await loadProfile();
              notify("success", "Signed in via Google! Vault unlocked.");
            } catch (err: any) {
              notify("error", err.message || "Google sign-in failed");
            } finally {
              setAuthLoading(false);
            }
          }
        },
      });
      client.prompt();
    } else {
      setGoogleOpen(true);
    }
  }

  function handleTwitterTrigger() {
    if (oauthConfig.twitter_enabled && oauthConfig.twitter_client_id) {
      // PKCE Twitter OAuth 2.0 flow
      const array = new Uint8Array(32);
      window.crypto.getRandomValues(array);
      const verifier = Array.from(array, (byte) => ("0" + (byte & 0xff).toString(16)).slice(-2)).join("");
      sessionStorage.setItem("x_code_verifier", verifier);

      // Challenge = simple plain or sha256 (Twitter accepts plain for confidential clients or S256)
      const redirectUri = window.location.origin + "/auth/callback";
      const params = new URLSearchParams({
        response_type: "code",
        client_id: oauthConfig.twitter_client_id,
        redirect_uri: redirectUri,
        scope: "users.read tweet.read offline.access",
        state: "state_" + Math.random().toString(36).substring(2),
        code_challenge: verifier,
        code_challenge_method: "plain",
      });
      window.location.href = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
    } else {
      setTwitterOpen(true);
    }
  }

  async function handleLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      if (isRegisterMode) {
        if (authPassword !== authConfirmPassword) {
          throw new Error("Passwords do not match");
        }
        await api.register(authEmail, authPassword, authConfirmPassword);
      }
      await api.login(authEmail, authPassword);
      await loadProfile();
      notify("success", isRegisterMode ? "Account created — welcome to TrustVault!" : "Signed in securely. Vault unlocked.");
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed");
      notify("error", err.message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  }

  function quickLogin(email: string, pass: string) {
    setAuthEmail(email);
    setAuthPassword(pass);
    setAuthLoading(true);
    setAuthError("");
    api.login(email, pass)
      .then(() => {
        loadProfile();
        notify("success", "Signed in securely. Vault unlocked.");
      })
      .catch((err) => {
        setAuthError(err.message);
        notify("error", err.message);
      })
      .finally(() => setAuthLoading(false));
  }

  function handleLogout() {
    api.clearToken();
    setCurrentUser(null);
    setDocuments([]);
    setAuditLogs([]);
    setChainStatus(null);
  }

  async function loadDocuments() {
    setDocsLoading(true);
    setDocError("");
    try {
      const data = await api.getDocuments();
      setDocuments(data);
    } catch (err: any) {
      setDocError(err.message);
    } finally {
      setDocsLoading(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    setDocError("");
    setUploadSuccess("");
    try {
      await api.uploadDocument(uploadFile);
      setUploadSuccess(`File "${uploadFile.name}" encrypted with AES-256 and stored!`);
      setUploadFile(null);
      loadDocuments();
    } catch (err: any) {
      setDocError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(doc: DocumentItem) {
    try {
      await api.downloadDocument(doc.id, doc.filename);
    } catch (err: any) {
      alert(`Download Refused: ${err.message}`);
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm("Are you sure you want to permanently delete this encrypted document?")) return;
    try {
      await api.deleteDocument(docId);
      loadDocuments();
    } catch (err: any) {
      alert(`Delete Error: ${err.message}`);
    }
  }

  async function openPermissions(doc: DocumentItem) {
    setSelectedDoc(doc);
    setPermMsg("");
    setPermLoading(true);
    try {
      const perms = await api.getPermissions(doc.id);
      setPermissions(perms);
    } catch (err: any) {
      setPermMsg(`Error: ${err.message}`);
    } finally {
      setPermLoading(false);
    }
  }

  async function handleGrantPermission(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDoc || !grantEmail) return;
    setPermLoading(true);
    setPermMsg("");
    try {
      await api.grantPermission(selectedDoc.id, grantEmail, grantType);
      setPermMsg(`Access granted to ${grantEmail} (${grantType})`);
      setGrantEmail("");
      const perms = await api.getPermissions(selectedDoc.id);
      setPermissions(perms);
    } catch (err: any) {
      setPermMsg(err.message);
    } finally {
      setPermLoading(false);
    }
  }

  async function handleRevokePermission(userId: number) {
    if (!selectedDoc) return;
    setPermLoading(true);
    try {
      await api.revokePermission(selectedDoc.id, userId);
      setPermMsg("Permission revoked immediately.");
      const perms = await api.getPermissions(selectedDoc.id);
      setPermissions(perms);
    } catch (err: any) {
      setPermMsg(`Revocation failed: ${err.message}`);
    } finally {
      setPermLoading(false);
    }
  }

  async function loadAuditLogs() {
    try {
      const logs = await api.getAuditLogs();
      setAuditLogs(logs);
    } catch (err: any) {
      console.error(err);
    }
  }

  async function verifyChain() {
    setVerifyingChain(true);
    try {
      const res = await api.verifyAuditChain();
      setChainStatus(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setVerifyingChain(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  }

  return (
    <div className="min-h-screen bg-[#080C14] text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-semibold tracking-tight text-slate-100">
                  TrustVault
                </span>
                <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                  Zero-Knowledge Rest
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Cryptographic Tamper-Evident Document Fortress</p>
            </div>
          </div>

          {currentUser ? (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                <div className={`w-2 h-2 rounded-full ${currentUser.role === 'ADMIN' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                <span className="font-mono text-slate-300">{currentUser.email}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-800 text-cyan-400">
                  {currentUser.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-400 font-mono">Authentication Required</span>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {!currentUser ? (
          <AuthScreen
            email={authEmail}
            setEmail={setAuthEmail}
            password={authPassword}
            setPassword={setAuthPassword}
            confirmPassword={authConfirmPassword}
            setConfirmPassword={setAuthConfirmPassword}
            isRegisterMode={isRegisterMode}
            setIsRegisterMode={setIsRegisterMode}
            authError={authError}
            authLoading={authLoading}
            onSubmit={handleLogin}
            quickLogin={quickLogin}
            onGoogle={handleGoogleTrigger}
            onTwitter={handleTwitterTrigger}
          />
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 mb-8 gap-4">
              <nav className="flex items-center space-x-1 sm:space-x-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
                {(
                  [
                    { key: "dashboard", label: "Dashboard", icon: Shield, pill: "bg-emerald-500", text: "text-slate-950" },
                    { key: "vault", label: "Document Vault", icon: FileText, pill: "bg-emerald-500", text: "text-slate-950" },
                    { key: "audit", label: "Cryptographic Audit Trail", icon: ShieldCheckIcon, pill: "bg-cyan-500", text: "text-slate-950", adminOnly: true },
                    { key: "threats", label: "Threat Intelligence & Security", icon: ShieldAlert, pill: "bg-indigo-500", text: "text-white" },
                    { key: "settings", label: "Settings & Privacy", icon: SettingsIcon, pill: "bg-emerald-500", text: "text-slate-950" },
                  ] as const
                )
                  .filter((t) => !("adminOnly" in t) || currentUser.role === "ADMIN")
                  .map((tab) => {
                    const active = activeTab === tab.key;
                    const IconCmp = tab.icon;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as typeof activeTab)}
                        className="relative px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/60"
                      >
                        {active && (
                          <motion.span
                            layoutId="nav-pill"
                            transition={{ type: "spring", stiffness: 450, damping: 35 }}
                            className={`absolute inset-0 rounded-lg ${tab.pill} shadow-md`}
                          />
                        )}
                        <span
                          className={`relative flex items-center space-x-1.5 transition-colors ${
                            active ? tab.text : "text-slate-400 hover:text-white"
                          }`}
                        >
                          <IconCmp className="w-4 h-4" />
                          <span className="hidden sm:inline">{tab.label}</span>
                        </span>
                      </button>
                    );
                  })}
              </nav>

              <div className="flex items-center space-x-3 text-xs">
                <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>AES-256 At Rest</span>
                </div>
                <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <Key className="w-3.5 h-3.5" />
                  <span>SHA-256 Chained</span>
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 18, filter: "blur(5px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -12, filter: "blur(5px)" }}
                transition={{ duration: 0.35, ease: PAGE_EASE }}
              >
            {activeTab === "dashboard" && (
              <DashboardPage
                user={currentUser}
                documents={documents}
                chainStatus={chainStatus}
                activity={dashboardActivity}
                onNavigate={(t) => setActiveTab(t)}
                onVerify={() => {
                  if (currentUser.role === "ADMIN") {
                    notify("info", "Re-verifying hash chain…");
                    verifyChain().then(() => notify("success", "Chain verification complete."));
                  } else {
                    notify("info", "Chain verification requires admin role.");
                  }
                }}
              />
            )}

            {activeTab === "vault" && (
              <div className="space-y-8">
                <div className="glass-card rounded-2xl p-6 border border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-200 mb-2 flex items-center space-x-2">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span>Upload & Encrypt Document</span>
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Files are authenticated with SHA-256 checksums and encrypted at rest with AES-256 Fernet.
                  </p>

                  <form onSubmit={handleUpload} className="flex flex-col sm:flex-row items-center gap-4">
                    <label className="flex-1 w-full flex items-center justify-center px-6 py-4 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl cursor-pointer bg-slate-900/50 transition">
                      <div className="text-center">
                        <FileCheck className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                        <span className="text-xs text-slate-300 font-medium">
                          {uploadFile ? uploadFile.name : "Select document to encrypt (PDF, DOCX, TXT, IMG)"}
                        </span>
                        {uploadFile && (
                          <span className="block text-[10px] text-emerald-400 mt-0.5">
                            {(uploadFile.size / 1024).toFixed(1)} KB ready
                          </span>
                        )}
                      </div>
                      <input
                        type="file"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={!uploadFile || uploading}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-medium text-xs transition disabled:opacity-50 flex items-center justify-center space-x-2"
                    >
                      {uploading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Encrypting...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          <span>Encrypt & Store</span>
                        </>
                      )}
                    </button>
                  </form>

                  {uploadSuccess && (
                    <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{uploadSuccess}</span>
                    </div>
                  )}

                  {docError && (
                    <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{docError}</span>
                    </div>
                  )}
                </div>

                <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-white">Encrypted Vault Items</h3>
                      <p className="text-xs text-slate-400">Accessible documents governed by server-side BOLA/IDOR ACLs</p>
                    </div>
                    <button
                      onClick={loadDocuments}
                      className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs flex items-center space-x-1.5 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${docsLoading ? "animate-spin" : ""}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="py-3 px-6">Document</th>
                          <th className="py-3 px-6">Integrity Checksum (SHA-256)</th>
                          <th className="py-3 px-6">Size / Type</th>
                          <th className="py-3 px-6">Access Level</th>
                          <th className="py-3 px-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {documents.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-500 font-mono">
                              No encrypted documents in vault. Upload one above!
                            </td>
                          </tr>
                        ) : (
                          documents.map((doc) => {
                            const isOwner = doc.owner_id === currentUser.id;
                            return (
                              <tr key={doc.id} className="hover:bg-slate-800/30 transition">
                                <td className="py-4 px-6 font-medium text-slate-200">
                                  <div className="flex items-center space-x-2">
                                    <FileText className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                    <span className="truncate max-w-xs">{doc.filename}</span>
                                  </div>
                                </td>
                                <td className="py-4 px-6 font-mono text-[11px] text-slate-400">
                                  <button
                                    onClick={() => copyToClipboard(doc.sha256_hash)}
                                    className="flex items-center space-x-1 hover:text-white"
                                    title="Click to copy full SHA-256 checksum"
                                  >
                                    <span>{doc.sha256_hash.slice(0, 16)}...</span>
                                    {copiedHash === doc.sha256_hash ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3 text-slate-500" />
                                    )}
                                  </button>
                                </td>
                                <td className="py-4 px-6 text-slate-400">
                                  <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                    {doc.mime_type.split("/")[1] || "bin"}
                                  </span>
                                </td>
                                <td className="py-4 px-6">
                                  {isOwner ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      Owner (Full)
                                    </span>
                                  ) : currentUser.role === "ADMIN" ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                      Admin (Auditor)
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                      ACL Granted
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 px-6 text-right space-x-2">
                                  <button
                                    onClick={() => handleDownload(doc)}
                                    className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition"
                                    title="Download & Decrypt"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>

                                  {(isOwner || currentUser.role === "ADMIN") && (
                                    <button
                                      onClick={() => openPermissions(doc)}
                                      className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 transition"
                                      title="Manage Access Permissions"
                                    >
                                      <Users className="w-4 h-4" />
                                    </button>
                                  )}

                                  {(isOwner || currentUser.role === "ADMIN") && (
                                    <button
                                      onClick={() => handleDelete(doc.id)}
                                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition"
                                      title="Permanently Delete"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "audit" && currentUser.role === "ADMIN" && (
              <div className="space-y-6">
                <div className="glass-card rounded-2xl p-6 border border-slate-800">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <Shield className="w-5 h-5 text-cyan-400" />
                        <h3 className="text-base font-semibold text-white">
                          Cryptographic Hash-Chained Audit Trail
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400">
                        Formula: <code className="text-cyan-300 font-mono">Record_Hash = SHA256(Previous_Hash + Canonical_JSON)</code>.
                        Guarantees mathematical tamper-evidence.
                      </p>
                    </div>

                    <button
                      onClick={verifyChain}
                      disabled={verifyingChain}
                      className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium text-xs transition flex items-center space-x-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${verifyingChain ? "animate-spin" : ""}`} />
                      <span>Verify Entire Chain</span>
                    </button>
                  </div>

                  {chainStatus && (
                    <div
                      className={`mt-4 p-4 rounded-xl border flex items-center space-x-3 ${
                        chainStatus.status === "VERIFIED"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                          : "bg-red-500/10 border-red-500/30 text-red-300"
                      }`}
                    >
                      {chainStatus.status === "VERIFIED" ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
                      )}
                      <div>
                        <div className="text-sm font-bold">
                          {chainStatus.status === "VERIFIED"
                            ? "Audit Trail Integrity: 100% UNTAMPERED"
                            : `INTEGRITY COMPROMISED: Block ${chainStatus.broken_at_sequence}`}
                        </div>
                        <div className="text-xs opacity-90">
                          {chainStatus.message || chainStatus.detail} (Total Verified Blocks: {chainStatus.total_records || auditLogs.length})
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Immutable Event Blocks</span>
                    <span className="text-xs font-mono text-slate-400">{auditLogs.length} Records</span>
                  </div>

                  <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800 sticky top-0">
                        <tr>
                          <th className="py-3 px-4">Seq</th>
                          <th className="py-3 px-4">Timestamp</th>
                          <th className="py-3 px-4">Action</th>
                          <th className="py-3 px-4">Target</th>
                          <th className="py-3 px-4">Payload Details</th>
                          <th className="py-3 px-4">Block Hash (SHA-256)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {auditLogs.map((log) => {
                          const isAlert = log.action.includes("UNAUTHORIZED") || log.action.includes("BLOCKED");
                          return (
                            <tr key={log.id} className={`hover:bg-slate-800/30 transition ${isAlert ? "bg-red-500/5" : ""}`}>
                              <td className="py-3 px-4 text-slate-500 font-bold">#{log.sequence}</td>
                              <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    isAlert
                                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                      : log.action.includes("GRANT")
                                      ? "bg-cyan-500/20 text-cyan-300"
                                      : log.action.includes("REVOKE")
                                      ? "bg-amber-500/20 text-amber-300"
                                      : "bg-emerald-500/20 text-emerald-300"
                                  }`}
                                >
                                  {log.action}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-300">{log.target_type}</td>
                              <td className="py-3 px-4 text-slate-400 max-w-xs truncate" title={log.payload_json}>
                                {log.payload_json}
                              </td>
                              <td className="py-3 px-4 text-slate-500">
                                <button
                                  onClick={() => copyToClipboard(log.record_hash)}
                                  className="hover:text-cyan-400 flex items-center space-x-1"
                                >
                                  <span>{log.record_hash.slice(0, 12)}...</span>
                                  <Copy className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "threats" && (
              <div className="space-y-6">
                <div className="glass-card rounded-2xl p-6 border border-slate-800">
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center space-x-2">
                    <ShieldAlert className="w-5 h-5 text-indigo-400" />
                    <span>TrustVault Security Posture & Threat Mitigations</span>
                  </h3>
                  <p className="text-xs text-slate-400 mb-6">
                    Verified against OWASP Top 10 API Security Risks (2026 Edition)
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                      <div className="flex items-center space-x-2 text-emerald-400 text-sm font-semibold mb-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>BOLA / IDOR Protection</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Access control is strictly enforced on the server-side in SQLAlchemy queries. Requesting arbitrary document UUIDs without active ACL authorization returns HTTP 403 and triggers an automatic audit anomaly alert.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                      <div className="flex items-center space-x-2 text-cyan-400 text-sm font-semibold mb-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Cryptographic Tamper-Evidence</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Audit events are chained using SHA-256 blocks where each block incorporates the hash of its predecessor. Even direct database manipulation is immediately caught by the verification engine.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                      <div className="flex items-center space-x-2 text-indigo-400 text-sm font-semibold mb-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Authenticated At-Rest Encryption</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Files are never written to disk in plaintext. AES-256 Fernet (CBC + HMAC-SHA256) ensures both confidentiality and cryptographic authenticity at rest.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                      <div className="flex items-center space-x-2 text-amber-400 text-sm font-semibold mb-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Immediate Revocation Guarantee</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Document permissions are queried dynamically per download request. Once an owner revokes access, any subsequent download attempt is rejected synchronously within 0ms.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "settings" && (
              <SettingsPage
                user={currentUser}
                onSignOut={handleLogout}
                notify={(type, message) => notify(type, message)}
              />
            )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </main>

      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg rounded-2xl border border-slate-700 p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-cyan-400" />
                  <span>Access Control: {selectedDoc.filename}</span>
                </h3>
                <p className="text-xs text-slate-400">Grant or immediately revoke access permissions</p>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {permMsg && (
              <div className="mb-4 p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs">
                {permMsg}
              </div>
            )}

            <form onSubmit={handleGrantPermission} className="space-y-3 mb-6 bg-slate-900/90 p-4 rounded-xl border border-slate-800">
              <label className="block text-xs font-semibold text-slate-300">Grant New Access</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  placeholder="user@trustvault.local"
                  required
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
                <select
                  value={grantType}
                  onChange={(e) => setGrantType(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none"
                >
                  <option value="READ">READ</option>
                  <option value="EDIT">EDIT</option>
                </select>
                <button
                  type="submit"
                  disabled={permLoading || !grantEmail}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase transition disabled:opacity-50"
                >
                  Grant
                </button>
              </div>
            </form>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Active Permissions
              </h4>
              {permissions.length === 0 ? (
                <div className="p-4 rounded-lg bg-slate-900 text-center text-xs text-slate-500 font-mono">
                  No explicit permissions granted yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {permissions.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">{p.user_email}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Type: {p.permission_type} • Status: {p.status}
                        </div>
                      </div>

                      {p.status === "ACTIVE" ? (
                        <button
                          onClick={() => handleRevokePermission(p.user_id)}
                          disabled={permLoading}
                          className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[11px] font-semibold transition"
                        >
                          Revoke Access
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500 uppercase font-mono">Revoked</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedDoc(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} dismiss={dismissToast} />

      {/* Animated Google sign-in modal */}
      <Modal open={googleOpen} onClose={() => setGoogleOpen(false)} title="Continue with Google">
        <div className="text-center py-2">
          <div className="inline-flex p-3 rounded-2xl bg-white/10 border border-white/15 mb-4">
            <svg viewBox="0 0 24 24" className="w-7 h-7" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-white mb-1.5">
            Real Google Identity Service
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed mb-3">
            Add your OAuth 2.0 Client ID in <span className="font-mono text-emerald-400">backend/.env</span>:
          </p>
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 text-[11px] font-mono text-slate-300 text-left mb-4 break-all select-all">
            GOOGLE_CLIENT_ID=&lt;your-id&gt;.apps.googleusercontent.com
          </div>
          <p className="text-xs text-slate-400 mb-5 leading-normal">
            Once configured, clicking this button automatically renders Google's real One Tap & OAuth sign-in flow.
          </p>
          <button
            onClick={() => setGoogleOpen(false)}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-cyan-400"
          >
            Got it
          </button>
        </div>
      </Modal>

      {/* Animated Twitter / X sign-in modal */}
      <Modal open={twitterOpen} onClose={() => setTwitterOpen(false)} title="Continue with X (Twitter)">
        <div className="text-center py-2">
          <div className="inline-flex p-3 rounded-2xl bg-white/10 border border-white/15 mb-4">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="currentColor" aria-hidden>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-white mb-1.5">
            Real Twitter OAuth 2.0 PKCE
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed mb-3">
            Add your Twitter Developer Client ID in <span className="font-mono text-cyan-400">backend/.env</span>:
          </p>
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 text-[11px] font-mono text-slate-300 text-left mb-4 break-all select-all">
            TWITTER_CLIENT_ID=&lt;your-client-id&gt;<br />
            TWITTER_CLIENT_SECRET=&lt;your-secret&gt;
          </div>
          <p className="text-xs text-slate-400 mb-5 leading-normal">
            Redirects directly to <span className="text-slate-300 font-mono">twitter.com/i/oauth2/authorize</span> with PKCE and exchanges for user session.
          </p>
          <button
            onClick={() => setTwitterOpen(false)}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/25 transition hover:from-cyan-400 hover:to-blue-400"
          >
            Got it
          </button>
        </div>
      </Modal>

      <footer className="border-t border-slate-900 bg-slate-950/60 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 font-mono">
          TrustVault Enterprise • Snovasys Fresher Challenge 2026 • Built with FastAPI, SQLite, React & SHA-256
        </div>
      </footer>
    </div>
  );
}

function ShieldCheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
