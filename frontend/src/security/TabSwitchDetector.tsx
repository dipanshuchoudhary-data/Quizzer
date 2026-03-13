"use client";

import { useEffect } from "react";
import { useViolationReporter } from "@/hooks/useViolationReporter";

export function TabSwitchDetector({ enabled }: { enabled: boolean }) {
  const { reportViolation } = useViolationReporter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        void reportViolation("TAB_SWITCH");
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, reportViolation]);

  return null;
}
