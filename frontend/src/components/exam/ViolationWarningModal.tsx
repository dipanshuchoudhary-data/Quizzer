"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ViolationWarning } from "@/types/exam";

interface ViolationWarningModalProps {
  warning: ViolationWarning | null;
  onDismiss: () => void;
}

function labelForViolation(type: ViolationWarning["type"]) {
  switch (type) {
    case "TAB_SWITCH":
      return "Tab switch detected";
    case "FULLSCREEN_EXIT":
      return "Fullscreen exited";
    case "PASTE_ATTEMPT":
      return "Paste attempt blocked";
    case "LARGE_TEXT_INSERT":
      return "Large text insertion detected";
    case "COPY_ATTEMPT":
      return "Copy or cut blocked";
    case "CONTEXT_MENU":
      return "Context menu blocked";
    case "DEVTOOLS_SHORTCUT":
      return "Restricted shortcut blocked";
    default:
      return type;
  }
}

export function ViolationWarningModal({ warning, onDismiss }: ViolationWarningModalProps) {
  const open = Boolean(warning);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-4 right-4 z-40 w-[24rem] rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-lg"
        >
          <h4 className="text-sm font-semibold text-amber-900">Integrity Alert</h4>
          <p className="mt-1 text-xs text-amber-800">
            {warning ? labelForViolation(warning.type) : null}. This event was reported to the proctoring system.
          </p>
          {warning?.count && warning.count > 1 ? (
            <p className="mt-2 text-xs text-amber-900">Repeated {warning.count} times in this session.</p>
          ) : null}
          <button
            type="button"
            className="mt-3 rounded-md border border-amber-400 px-2 py-1 text-xs font-semibold text-amber-800"
            onClick={onDismiss}
          >
            Acknowledge
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
