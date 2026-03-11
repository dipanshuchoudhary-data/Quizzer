"use client";

import { AnimatePresence, motion } from "framer-motion";

interface SubmitDialogProps {
  open: boolean;
  reason?: "manual" | "expired";
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function SubmitDialog({ open, reason = "manual", onCancel, onConfirm, loading }: SubmitDialogProps) {
  const isExpired = reason === "expired";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
        >
          <motion.div
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 18, opacity: 0 }}
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-slate-900">{isExpired ? "Time Expired" : "Submit Exam?"}</h3>
            <p className="mt-2 text-sm text-slate-600">
              {isExpired
                ? "The backend timer has ended. Submit now to close the attempt and prevent further changes."
                : "Submission is final. Unanswered questions will be graded as empty responses."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
              >
                {loading ? "Submitting..." : isExpired ? "Close Attempt" : "Submit"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
