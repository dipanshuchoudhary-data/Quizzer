"use client";

import { useCallback, useRef } from "react";
import { reportViolation as reportViolationApi } from "@/api/examApi";
import { useExamStore } from "@/store/examStore";
import type { ViolationType } from "@/types/exam";

const VIOLATION_THROTTLE_MS = 2500;

export function useViolationReporter() {
  const attemptId = useExamStore((state) => state.identity.attemptId);
  const attemptToken = useExamStore((state) => state.identity.attemptToken);
  const registerViolation = useExamStore((state) => state.registerViolation);
  const lastReported = useRef<Record<string, number>>({});

  const reportViolation = useCallback(
    async (violationType: ViolationType) => {
      if (!attemptId) {
        return;
      }

      const now = Date.now();
      if ((lastReported.current[violationType] ?? 0) + VIOLATION_THROTTLE_MS > now) {
        return;
      }
      lastReported.current[violationType] = now;

      registerViolation(violationType);

      try {
        await reportViolationApi(attemptId, violationType, attemptToken ?? undefined);
      } catch {
        // Violation reporting is best-effort on unstable networks.
      }
    },
    [attemptId, attemptToken, registerViolation]
  );

  return { reportViolation };
}
