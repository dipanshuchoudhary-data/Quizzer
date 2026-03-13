"use client";

import { useEffect } from "react";
import { useViolationReporter } from "@/hooks/useViolationReporter";

export function WindowBlurDetector({ enabled }: { enabled: boolean }) {
  const { reportViolation } = useViolationReporter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onBlur = () => {
      void reportViolation("WINDOW_BLUR");
    };

    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled, reportViolation]);

  return null;
}
