import { motion } from "framer-motion";
import {
  Clock,
  Download,
  FileText,
  Key,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Upload,
  UserCheck,
} from "lucide-react";

/* ---------------------------------------------------------------------------
   Dashboard — welcome banner, animated stat cards, activity, quick actions
--------------------------------------------------------------------------- */

const ease = [0.22, 1, 0.36, 1] as const;

const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 24, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease, delay } },
});

interface Stat {
  title: string;
  value: string;
  subtitle: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: string;
  chip: string;
}

function StatCard({ stat, delay }: { stat: Stat; delay: number }) {
  return (
    <motion.div
      {...rise(delay)}
      whileHover={{ y: -4 }}
      className="rounded-xl p-5 border border-white/10 bg-[rgba(15,18,29,0.6)] backdrop-blur-xl shadow-xl shadow-black/40 relative overflow-hidden group"
    >
      <div
        aria-hidden
        className="absolute -right-8 -top-8 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: "radial-gradient(circle, rgba(16,185,129,0.18), transparent 70%)" }}
      />
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`inline-flex p-2 rounded-lg ${stat.chip}`}>
          <stat.Icon className={`w-4 h-4 ${stat.accent}`} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{stat.title}</span>
      </div>
      <p className="text-3xl font-bold text-white tracking-tight">{stat.value}</p>
      <p className="text-xs text-slate-500 mt-1.5 truncate">{stat.subtitle}</p>
    </motion.div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  accent = "text-emerald-400",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  accent?: string;
}) {
  return (
    <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
      <Icon className={`w-4 h-4 ${accent}`} />
      <span>{title}</span>
    </h3>
  );
}

function QuickAction({
  title,
  subtitle,
  Icon,
  onClick,
  tone,
  delay,
}: {
  title: string;
  subtitle: string;
  Icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  tone: "emerald" | "indigo";
  delay: number;
}) {
  const tones = {
    emerald: {
      border: "border-emerald-500/25 hover:border-emerald-500/50",
      bg: "bg-emerald-500/5 hover:bg-emerald-500/10",
      text: "text-emerald-400",
    },
    indigo: {
      border: "border-indigo-500/25 hover:border-indigo-500/50",
      bg: "bg-indigo-500/5 hover:bg-indigo-500/10",
      text: "text-indigo-300",
    },
  };
  const t = tones[tone];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease, delay }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      className={`text-left rounded-xl p-4 border ${t.border} ${t.bg} transition-colors group`}
    >
      <span className={`inline-flex p-2 rounded-lg bg-white/5 ${t.text} mb-2.5 group-hover:scale-110 transition-transform`}>
        <Icon className="w-4 h-4" />
      </span>
      <p className="text-xs font-semibold text-slate-200">{title}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
    </motion.button>
  );
}

export interface DashboardActivity {
  time: string;
  action: string;
  actor: string;
  ok: boolean;
}

function ActivityRow({ entry, index }: { entry: DashboardActivity; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, ease, delay: 0.15 + index * 0.07 }}
      className="flex items-center gap-3 py-2.5 border-t border-white/5 first:border-t-0"
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${entry.ok ? "bg-emerald-400" : "bg-amber-400"}`} />
      <p className="text-xs text-slate-300 flex-1 truncate">{entry.action}</p>
      <p className="text-[10px] font-mono text-slate-500 flex-shrink-0">{entry.time}</p>
      <p className="text-[10px] text-slate-500 w-16 truncate text-right">{entry.actor}</p>
    </motion.div>
  );
}

export default function DashboardPage({
  user,
  documents,
  chainStatus,
  activity,
  onNavigate,
  onVerify,
}: {
  user: { email: string; role: string };
  documents: unknown[];
  chainStatus: { status: "VERIFIED" | "TAMPERED"; total_records?: number; broken_at_sequence?: number } | null;
  activity: DashboardActivity[];
  onNavigate: (tab: "vault" | "threats" | "audit") => void;
  onVerify: () => void;
}) {
  const stats: Stat[] = [
    {
      title: "Encrypted Documents",
      value: String(documents.length),
      subtitle: "AES-256 (Fernet) at rest",
      Icon: FileText,
      accent: "text-emerald-400",
      chip: "bg-emerald-500/10",
    },
    {
      title: "Hash Chain Records",
      value: chainStatus ? String(chainStatus.total_records) : "—",
      subtitle: "SHA-256 tamper-evident",
      Icon: ShieldCheck,
      accent: "text-cyan-400",
      chip: "bg-cyan-500/10",
    },
    {
      title: "Chain Integrity",
      value: chainStatus ? (chainStatus.status === "VERIFIED" ? "Verified" : "TAMPERED") : "—",
      subtitle: chainStatus ? (chainStatus.status === "VERIFIED" ? "No tampering detected" : `Broken at seq ${chainStatus.broken_at_sequence ?? "?"}`) : "Run verification",
      Icon: Lock,
      accent: chainStatus && chainStatus.status !== "VERIFIED" ? "text-amber-400" : "text-emerald-400",
      chip: "bg-indigo-500/10",
    },
    {
      title: "Session",
      value: user.role,
      subtitle: user.email,
      Icon: UserCheck,
      accent: "text-indigo-400",
      chip: "bg-white/5",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="rounded-2xl p-5 sm:p-6 border border-white/10 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(16,185,129,0.10) 0%, rgba(6,182,212,0.06) 50%, rgba(15,18,29,0.9) 100%)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400 mb-1.5">
              Vault Status · Online
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Welcome back,{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                {user.email.split("@")[0]}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {documents.length} documents encrypted · {chainStatus?.total_records ?? 0} audit records chained
            </p>
          </div>
          <motion.div
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex-shrink-0"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-300">
              {chainStatus
                ? chainStatus.status === "VERIFIED"
                  ? "Audit Chain Verified"
                  : "Chain Compromised"
                : "All Systems Secure"}
            </span>
          </motion.div>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <StatCard key={s.title} stat={s} delay={0.1 + i * 0.08} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity timeline */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.35 }}
          className="lg:col-span-2 rounded-2xl p-5 border border-white/10 bg-[rgba(15,18,29,0.6)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between">
            <SectionHeading icon={Clock} title="Recent Audit Activity" />
            <button
              onClick={() => onNavigate("audit")}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 transition -mt-4"
            >
              View all →
            </button>
          </div>
          {activity.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-xs text-slate-500">
                No recorded activity yet — upload a document to start the chain.
              </p>
            </div>
          ) : (
            <div>
              {activity.slice(0, 6).map((e, i) => (
                <ActivityRow key={i} entry={e} index={i} />
              ))}
            </div>
          )}
        </motion.div>

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.45 }}
          className="rounded-2xl p-5 border border-white/10 bg-[rgba(15,18,29,0.6)] backdrop-blur-xl"
        >
          <SectionHeading icon={Key} title="Quick Actions" accent="text-indigo-400" />
          <div className="grid grid-cols-1 gap-3">
            <QuickAction
              title="Upload & Encrypt"
              subtitle="Add a document to the vault"
              Icon={Upload}
              onClick={() => onNavigate("vault")}
              tone="emerald"
              delay={0.5}
            />
            <QuickAction
              title="Verify Hash Chain"
              subtitle="Re-validate audit integrity"
              Icon={ShieldCheck}
              onClick={onVerify}
              tone="indigo"
              delay={0.58}
            />
            <QuickAction
              title="Security Posture"
              subtitle="Review threat intelligence"
              Icon={ShieldAlert}
              onClick={() => onNavigate("threats")}
              tone="indigo"
              delay={0.66}
            />
            <QuickAction
              title="Export Audit Log"
              subtitle="Download chain records"
              Icon={Download}
              onClick={() => onNavigate("audit")}
              tone="emerald"
              delay={0.74}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}