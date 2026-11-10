import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  ChevronRight,
  Eye,
  Fingerprint,
  Lock,
  LogOut,
  Palette,
  Shield,
  Trash2,
  User,
} from "lucide-react";
import type { User as UserT } from "../api";

/* ---------------------------------------------------------------------------
   Settings — account, appearance, security, privacy & data, danger zone
--------------------------------------------------------------------------- */

const ease = [0.22, 1, 0.36, 1] as const;

const sectionIn = (delay: number) => ({
  initial: { opacity: 0, y: 24, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease, delay } },
});

/* ---------------------------- animated toggle ---------------------------- */

function Toggle({
  checked,
  onChange,
  label,
  hint,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-4 py-3.5 px-1 text-left group rounded-lg hover:bg-white/[0.03] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50"
    >
      <span className="p-2 rounded-lg bg-white/5 text-slate-400 group-hover:text-emerald-400 transition-colors flex-shrink-0">
        <Icon className="w-4 h-4" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-slate-200">{label}</span>
        <span className="block text-[11px] text-slate-500 mt-0.5">{hint}</span>
      </span>
      <span
        className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-300 ${
          checked ? "bg-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.35)]" : "bg-white/10"
        }`}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
          style={{ left: checked ? 22 : 2 }}
        />
      </span>
    </button>
  );
}

/* ------------------------------- section ---------------------------------- */

function Section({
  icon: Icon,
  title,
  subtitle,
  accent,
  delay,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  accent: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      {...sectionIn(delay)}
      className="rounded-2xl border border-white/10 bg-[rgba(15,18,29,0.6)] backdrop-blur-xl overflow-hidden"
    >
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 bg-white/[0.02]">
        <span className={`p-2 rounded-lg ${accent}`}>
          <Icon className="w-4 h-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-[11px] text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="px-5 py-2">{children}</div>
    </motion.section>
  );
}

/* ------------------------------ main page --------------------------------- */

export default function SettingsPage({
  user,
  onSignOut,
  notify,
}: {
  user: UserT;
  onSignOut: () => void;
  notify: (type: "success" | "error" | "info", message: string) => void;
}) {
  const [prefs, setPrefs] = useState(() => {
    try {
      const raw = localStorage.getItem("tv_prefs");
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return { animations: true, compact: false, autoLock: true, auditAlerts: true, emailDigest: false };
  });

  useEffect(() => {
    try {
      localStorage.setItem("tv_prefs", JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);

  const set = (key: string) => (v: boolean) => setPrefs((p: Record<string, boolean>) => ({ ...p, [key]: v }));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-1.5">
            Preferences
          </p>
          <h2 className="text-2xl font-bold text-white tracking-tight">Settings & Privacy</h2>
        </div>
        <button
          onClick={onSignOut}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 hover:border-red-500/40 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </motion.div>

      {/* Account */}
      <Section
        icon={User}
        title="Account"
        subtitle="Identity bound to this vault session"
        accent="bg-emerald-500/10 text-emerald-400"
        delay={0.08}
      >
        <div className="flex items-center gap-4 py-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-emerald-300 uppercase">
              {user.email.slice(0, 2)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                {user.role}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                Argon2id
              </span>
            </div>
          </div>
        </div>
      </Section>

      {/* Security */}
      <Section
        icon={Lock}
        title="Security"
        subtitle="Session hardening & verification behavior"
        accent="bg-cyan-500/10 text-cyan-400"
        delay={0.16}
      >
        <Toggle
          checked={prefs.autoLock}
          onChange={set("autoLock")}
          label="Auto-lock idle session"
          hint="Requires re-authentication after 30 minutes of inactivity"
          icon={Fingerprint}
        />
        <Toggle
          checked={prefs.auditAlerts}
          onChange={set("auditAlerts")}
          label="Tamper alerts"
          hint="Surface a warning banner if the hash chain fails verification"
          icon={Shield}
        />
        <Toggle
          checked={prefs.emailDigest}
          onChange={set("emailDigest")}
          label="Email activity digest"
          hint="Weekly summary of grants, uploads and chain events"
          icon={Bell}
        />
      </Section>

      {/* Appearance */}
      <Section
        icon={Palette}
        title="Appearance"
        subtitle="Interface feel for this device"
        accent="bg-indigo-500/10 text-indigo-300"
        delay={0.24}
      >
        <Toggle
          checked={prefs.animations}
          onChange={set("animations")}
          label="Interface animations"
          hint="Entrance transitions, hover lifts and page motion"
          icon={Eye}
        />
        <Toggle
          checked={prefs.compact}
          onChange={set("compact")}
          label="Compact density"
          hint="Tighter spacing in document lists and tables"
          icon={ChevronRight}
        />
      </Section>

      {/* Privacy & Data */}
      <Section
        icon={Shield}
        title="Privacy & Data"
        subtitle="What TrustVault stores about you"
        accent="bg-emerald-500/10 text-emerald-400"
        delay={0.32}
      >
        <div className="py-4 space-y-4">
          {[
            {
              title: "Zero-knowledge storage",
              body: "File bytes are encrypted with AES-256 (Fernet) before they touch disk. The server never sees plaintext.",
            },
            {
              title: "Cryptographic audit trail",
              body: "Every action writes a SHA-256 chained audit record. Chains are append-only — edits break verification.",
            },
            {
              title: "No third-party tracking",
              body: "No analytics SDKs, no ad pixels, no external telemetry. All requests stay on this origin.",
            },
            {
              title: "Access is explicit",
              body: "Documents are private by default; visibility changes only through per-document ACL grants you approve.",
            },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, ease, delay: 0.38 + i * 0.07 }}
              className="flex gap-3 py-3 border-t border-white/5 first:border-t-0 first:pt-0"
            >
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-200">{item.title}</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Danger zone */}
      <motion.div
        {...sectionIn(0.42)}
        className="rounded-2xl border border-red-500/25 bg-red-500/[0.04] overflow-hidden"
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-red-500/15">
          <span className="p-2 rounded-lg bg-red-500/10 text-red-400">
            <Trash2 className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-red-200">Danger Zone</h3>
            <p className="text-[11px] text-red-300/60">Irreversible account actions</p>
          </div>
        </div>
        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-200">Sign out of this device</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Clears the session token. Documents and audit records stay untouched.
            </p>
          </div>
          <button
            onClick={() => {
              notify("info", "Session ended — vault locked.");
              onSignOut();
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-red-300 border border-red-500/40 hover:bg-red-500/15 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="text-center text-[11px] text-slate-600 pt-2 pb-4"
        >
          TrustVault · Zero-Knowledge REST · Preferences saved locally on this device
        </motion.p>
      </AnimatePresence>
    </div>
  );
}