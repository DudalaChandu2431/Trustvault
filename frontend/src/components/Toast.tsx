import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type Toast = {
  id: number;
  type: "success" | "error" | "info";
  message: string;
};

const icons = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const accents = {
  success: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  error: "text-red-400 border-red-500/30 bg-red-500/10",
  info: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
};

export function ToastContainer({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: number) => void;
}) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2.5 w-[min(92vw,360px)] pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = icons[t.type];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border backdrop-blur-xl p-3.5 shadow-2xl shadow-black/50 ${accents[t.type]}`}
              style={{ background: "rgba(15, 18, 29, 0.92)" }}
            >
              <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-200 leading-relaxed flex-1">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="text-slate-500 hover:text-white transition"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 4, ease: "linear" }}
                onAnimationComplete={() => dismiss(t.id)}
                className="absolute bottom-0 left-0 right-0 h-[2px] origin-left rounded-b-xl bg-current opacity-40"
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
