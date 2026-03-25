"use client";

import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ViolationWarning } from "@/types/exam";

interface ViolationWarningModalProps {
  warning: ViolationWarning | null;
  onDismiss: () => void;
  violationCount?: number;
  violationLimit?: number;
  markDeductionPerViolation?: number;
}

function labelForViolation(type: ViolationWarning["type"]) {
  switch (type) {
    case "TAB_SWITCH":
      return "Tab switch detected";
    case "FULLSCREEN_EXIT":
      return "Fullscreen exited";
    case "WINDOW_BLUR":
      return "Window focus lost";
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

export function ViolationWarningModal({
  warning,
  onDismiss,
  violationCount = 0,
  violationLimit,
  markDeductionPerViolation,
}: ViolationWarningModalProps) {
  const open = Boolean(warning);
  const [countdown, setCountdown] = useState(3);

  const remainingViolations = violationLimit ? violationLimit - violationCount : null;
  const isNearLimit = remainingViolations !== null && remainingViolations <= 3;
  const isCritical = remainingViolations !== null && remainingViolations <= 1;

  const handleDismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  // Auto-dismiss after 3 seconds
  useEffect(() => {
    if (!open) {
      setCountdown(3);
      return;
    }

    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleDismiss();
          return 3;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, handleDismiss, warning?.lastAt]);

  // Determine colors based on severity
  const getBgColor = () => {
    if (isCritical) return "bg-red-50 border-red-400";
    if (isNearLimit) return "bg-orange-50 border-orange-400";
    return "bg-amber-50 border-amber-300";
  };

  const getHeaderColor = () => {
    if (isCritical) return "text-red-900";
    if (isNearLimit) return "text-orange-900";
    return "text-amber-900";
  };

  const getTextColor = () => {
    if (isCritical) return "text-red-800";
    if (isNearLimit) return "text-orange-800";
    return "text-amber-800";
  };

  const getButtonColor = () => {
    if (isCritical) return "border-red-400 bg-red-100 text-red-800 hover:bg-red-200";
    if (isNearLimit) return "border-orange-400 bg-orange-100 text-orange-800 hover:bg-orange-200";
    return "border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-200";
  };

  const getProgressColor = () => {
    if (isCritical) return "bg-red-500";
    if (isNearLimit) return "bg-orange-500";
    return "bg-amber-500";
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className={`fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-2xl border-2 p-4 shadow-2xl sm:left-auto sm:right-4 sm:mx-0 sm:w-96 ${getBgColor()}`}
        >
          {/* Auto-dismiss progress bar */}
          <div className="absolute left-0 top-0 h-1.5 w-full overflow-hidden rounded-t-2xl bg-black/10">
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 3, ease: "linear" }}
              className={`h-full ${getProgressColor()}`}
            />
          </div>

          <div className="flex gap-3">
            {/* Icon */}
            <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-xl ${
              isCritical ? "bg-red-100" : isNearLimit ? "bg-orange-100" : "bg-amber-100"
            }`}>
              {isCritical ? "🚨" : isNearLimit ? "⚠️" : "⚡"}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className={`text-sm font-bold sm:text-base ${getHeaderColor()}`}>
                {isCritical ? "Critical Warning!" : isNearLimit ? "Warning!" : "Integrity Alert"}
              </h4>

              <p className={`mt-1 text-xs sm:text-sm ${getTextColor()}`}>
                {warning ? labelForViolation(warning.type) : null}
              </p>

              {/* Mark deduction display */}
              {markDeductionPerViolation && markDeductionPerViolation > 0 && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                  <span>-{markDeductionPerViolation}</span>
                  <span>mark deducted</span>
                </div>
              )}

              {/* Violation count display */}
              {violationLimit && (
                <div className="mt-2 flex items-center gap-2">
                  <div className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isCritical ? "bg-red-200 text-red-800" :
                    isNearLimit ? "bg-orange-200 text-orange-800" :
                    "bg-amber-200 text-amber-800"
                  }`}>
                    {violationCount} / {violationLimit} violations
                  </div>
                  {remainingViolations !== null && remainingViolations > 0 && (
                    <span className="text-xs text-slate-600">
                      {remainingViolations} left
                    </span>
                  )}
                </div>
              )}

              {/* Critical warning message */}
              {isCritical && (
                <div className="mt-2 rounded-lg bg-red-100 p-2 text-xs font-bold text-red-800 sm:text-sm">
                  ⚠️ Exam will auto-submit on next violation!
                </div>
              )}

              {/* Repeat count */}
              {warning?.count && warning.count > 1 && (
                <p className="mt-2 text-xs italic text-slate-500">
                  Repeated {warning.count}x this session
                </p>
              )}
            </div>
          </div>

          {/* Dismiss button */}
          <button
            type="button"
            className={`mt-3 w-full rounded-lg border px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${getButtonColor()}`}
            onClick={handleDismiss}
          >
            Acknowledge ({countdown}s)
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
