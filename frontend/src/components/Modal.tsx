import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

/** Animated glass modal popup (framer-motion spring entrance + backdrop blur). */
export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          style={{ background: "rgba(3, 6, 12, 0.72)", backdropFilter: "blur(8px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 32 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: "spring", stiffness: 340, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl shadow-black/60 relative overflow-hidden"
            style={{ background: "rgba(15,18,29,0.95)", backdropFilter: "blur(24px)" }}
          >
            <motion.div
              aria-hidden
              className="absolute inset-x-0 top-0 h-1"
              style={{ background: "linear-gradient(90deg, #10b981, #06b6d4)" }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, ease }}
            />
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-base font-bold text-white">{title}</h3>
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-slate-500 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
