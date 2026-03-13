"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useViolationReporter } from "@/hooks/useViolationReporter";

export function FullscreenGuard({ enabled }: { enabled: boolean }) {
  const { reportViolation } = useViolationReporter();
  const [needsFullscreen, setNeedsFullscreen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const requestFullscreen = async () => {
      if (!document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen();
          setNeedsFullscreen(false);
        } catch {
          setNeedsFullscreen(true);
        }
      }
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setNeedsFullscreen(true);
        void reportViolation("FULLSCREEN_EXIT");
      } else {
        setNeedsFullscreen(false);
      }
    };

    void requestFullscreen();
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [enabled, reportViolation]);

  if (!enabled || !needsFullscreen) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-xl rounded-2xl border border-amber-300 bg-amber-50 p-6 shadow-2xl">
        <div>
          <h4 className="text-base font-semibold text-amber-950">Fullscreen mode is required for this exam.</h4>
          <p className="mt-1 text-sm text-amber-900">
            Please return to fullscreen to continue. Answering is blocked until fullscreen is restored, and exiting fullscreen is recorded as a violation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void document.documentElement.requestFullscreen().then(() => setNeedsFullscreen(false)).catch(() => {
              setNeedsFullscreen(true);
            });
          }}
          className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-amber-950"
        >
          Re-enter Fullscreen
        </button>
      </div>
    </motion.div>
  );
}
