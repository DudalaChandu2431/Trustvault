import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  X,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";

/* ---------------------------------------------------------------------------
   Animated split-screen auth — inspired by 21st.dev auth patterns
   (ambient glow orbs + glass card + framer-motion micro-interactions)
--------------------------------------------------------------------------- */

const ease = [0.22, 1, 0.36, 1] as const;

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease } },
};

interface AuthScreenProps {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirmPassword?: string;
  setConfirmPassword?: (v: string) => void;
  isRegisterMode: boolean;
  setIsRegisterMode: (v: boolean) => void;
  authError: string;
  authLoading: boolean;
  onSubmit: (e?: React.FormEvent) => void;
  quickLogin: (email: string, pass: string) => void;
  onGoogle: () => void;
}

const quickAccounts = [
  { label: "Admin", sub: "Auditor Full", email: "admin@trustvault.local", pass: "Admin@123", tone: "text-amber-300" },
  { label: "Alice", sub: "Doc Owner", email: "alice@trustvault.local", pass: "Password@123", tone: "text-cyan-300" },
  { label: "Bob", sub: "ACL Viewer", email: "bob@trustvault.local", pass: "Password@123", tone: "text-emerald-300" },
];

const highlights = [
  { icon: Lock, title: "Argon2id + AES-256", sub: "Passwords hashed, files encrypted at rest" },
  { icon: ShieldCheck, title: "SHA-256 Audit Chain", sub: "Every action cryptographically tamper-evident" },
  { icon: KeyRound, title: "Zero-Knowledge REST", sub: "Server never sees plaintext secrets" },
  { icon: FileText, title: "Document Fortress", sub: "Upload, encrypt, grant & revoke in real time" },
];

export default function AuthScreen({
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword = "",
  setConfirmPassword,
  isRegisterMode,
  setIsRegisterMode,
  authError,
  authLoading,
  onSubmit,
  quickLogin,
  onGoogle,
}: AuthScreenProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password rules validation for register mode
  const rules = [
    {
      id: "len",
      label: "Minimum 12 characters",
      met: password.length >= 12,
    },
    {
      id: "upper",
      label: "At least 1 capital letter (A–Z)",
      met: /[A-Z]/.test(password),
    },
    {
      id: "lower",
      label: "At least 1 small letter (a–z)",
      met: /[a-z]/.test(password),
    },
    {
      id: "num",
      label: "At least 1 digit (0–9)",
      met: /\d/.test(password),
    },
    {
      id: "spec",
      label: "At least 1 special char (@#$%&*!)",
      met: /[@#$%&*!]/.test(password),
    },
    {
      id: "spaces",
      label: "No leading or trailing spaces",
      met: password.length > 0 && password === password.trim(),
    },
  ];

  const passwordsMatch = Boolean(
    password && confirmPassword && password === confirmPassword
  );
  const allRulesPassed = rules.every((r) => r.met) && (!isRegisterMode || passwordsMatch);

  return (
    <div className="relative min-h-[78vh] flex items-center justify-center overflow-hidden">
      {/* Ambient background: dot matrix + dual glow orbs */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <motion.div
        aria-hidden
        className="absolute -top-32 -left-24 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(16,185,129,0.16) 0%, transparent 70%)", filter: "blur(60px)" }}
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-32 -right-24 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(6,182,212,0.14) 0%, transparent 70%)", filter: "blur(60px)" }}
        animate={{ x: [0, -40, 0], y: [0, -30, 0] }}
        transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-center w-full max-w-6xl px-4 sm:px-6">
        {/* ---------- Left: brand narrative ---------- */}
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="hidden lg:block">
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 mb-6">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[11px] font-semibold tracking-widest uppercase text-emerald-300">
              Zero-Knowledge REST
            </span>
          </motion.div>

          <motion.h1 variants={itemVariants} className="text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.12] text-white">
            The cryptographic{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              document fortress
            </span>{" "}
            for your most sensitive files.
          </motion.h1>

          <motion.p variants={itemVariants} className="mt-4 text-sm text-slate-400 max-w-md leading-relaxed">
            Upload, encrypt and share documents under a mathematically verifiable
            audit trail — tamper evidence you can prove, not promise.
          </motion.p>

          <div className="mt-8 grid grid-cols-2 gap-3 max-w-lg">
            {highlights.map((h, i) => (
              <motion.div
                key={h.title}
                variants={itemVariants}
                whileHover={{ y: -4, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="rounded-xl p-4 border border-white/10"
                style={{ background: "rgba(18,22,36,0.6)", backdropFilter: "blur(12px)" }}
              >
                <h.icon className={`w-4 h-4 mb-2 ${i % 2 === 0 ? "text-emerald-400" : "text-cyan-400"}`} />
                <p className="text-xs font-semibold text-slate-200">{h.title}</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">{h.sub}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ---------- Right: glass auth card ---------- */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease }}
          className="w-full max-w-md mx-auto"
        >
          <div
            className="rounded-2xl p-7 sm:p-8 border border-white/10 shadow-2xl shadow-black/60 relative overflow-hidden"
            style={{ background: "rgba(15,18,29,0.88)", backdropFilter: "blur(24px)" }}
          >
            {/* sheen sweep */}
            <motion.div
              aria-hidden
              className="absolute inset-x-0 -top-24 h-24 pointer-events-none"
              style={{ background: "linear-gradient(180deg, rgba(16,185,129,0.25), transparent)" }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="text-center mb-6 relative">
              <motion.div
                initial={{ rotate: -12, scale: 0.6, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.3 }}
                className="inline-flex p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3"
              >
                {isRegisterMode ? <UserPlus className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
              </motion.div>

              <motion.h2
                key={isRegisterMode ? "signup" : "login"}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease }}
                className="text-2xl font-bold tracking-tight text-white"
              >
                {isRegisterMode ? "Create Secure Account" : "Access TrustVault"}
              </motion.h2>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Argon2id hashing · AES-256 storage · cryptographic audit
              </p>
            </div>

            {/* Google sign-in */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={onGoogle}
              className="w-full py-2.5 rounded-xl bg-white/95 hover:bg-white text-slate-900 font-semibold text-sm transition flex items-center justify-center gap-2.5 shadow-lg shadow-black/30 mb-3"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </motion.button>

            <div className="flex items-center gap-3 my-4">
              <div className="h-px flex-1 bg-slate-700/70" />
              <span className="text-[10px] uppercase tracking-widest text-slate-500">or email</span>
              <div className="h-px flex-1 bg-slate-700/70" />
            </div>

            {/* Quick switch presets */}
            <div className="mb-5 bg-slate-900/70 p-3 rounded-xl border border-slate-800">
              <div className="text-slate-400 mb-2 text-[11px] font-medium flex items-center justify-between">
                <span>Fast Switch Test Credentials</span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> 1-Click
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {quickAccounts.map((a, i) => (
                  <motion.button
                    key={a.label}
                    type="button"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 + i * 0.08, ease }}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => quickLogin(a.email, a.pass)}
                    disabled={authLoading}
                    className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-left border border-slate-700/50 transition disabled:opacity-50"
                  >
                    <div className={`font-semibold text-[11px] ${a.tone}`}>{a.label}</div>
                    <div className="text-[9px] text-slate-400 truncate">{a.sub}</div>
                  </motion.button>
                ))}
              </div>
            </div>

            <AnimatePresence>
              {authError && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.25, ease }}
                  className="overflow-hidden"
                >
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{authError}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={onSubmit} className="space-y-4">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key="fields"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.18)] transition"
                      placeholder="name@trustvault.local"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.18)] transition"
                        placeholder={isRegisterMode ? "Min 12 chars, 1 upper, 1 lower, 1 digit, 1 special" : "••••••••"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isRegisterMode && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword && setConfirmPassword(e.target.value)}
                            required
                            className={`w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-900/90 border text-slate-100 text-sm focus:outline-none transition ${
                              confirmPassword
                                ? passwordsMatch
                                  ? "border-emerald-500 focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
                                  : "border-red-500 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.18)]"
                                : "border-slate-700 focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
                            }`}
                            placeholder="Re-enter your password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {confirmPassword && (
                          <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                            {passwordsMatch ? (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Passwords match
                              </span>
                            ) : (
                              <span className="text-red-400 flex items-center gap-1">
                                <X className="w-3.5 h-3.5" /> Passwords do not match
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Animated Password Rules Checklist */}
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1.5"
                      >
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Password Requirements
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {rules.map((rule) => (
                            <motion.div
                              key={rule.id}
                              animate={{
                                color: rule.met ? "#34d399" : "#94a3b8",
                              }}
                              className="flex items-center gap-1.5 text-[11px]"
                            >
                              <div
                                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors ${
                                  rule.met
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-slate-800 text-slate-500"
                                }`}
                              >
                                {rule.met ? (
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                                )}
                              </div>
                              <span className={rule.met ? "text-emerald-300" : "text-slate-400"}>
                                {rule.label}
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={authLoading || (isRegisterMode && !allRulesPassed)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 transition relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center space-x-2 relative z-10">
                  {authLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : isRegisterMode ? (
                    <UserPlus className="w-4 h-4" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  <span>{isRegisterMode ? "Create Account" : "Secure Login"}</span>
                  {!authLoading && (
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  )}
                </span>
                <motion.span
                  aria-hidden
                  className="absolute inset-0 bg-white/30"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "100%" }}
                  transition={{ duration: 0.6, ease }}
                />
              </motion.button>
            </form>

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => setIsRegisterMode(!isRegisterMode)}
                className="text-xs text-slate-400 hover:text-emerald-400 transition"
              >
                {isRegisterMode ? "Already registered? Login" : "Need an account? Register now"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
