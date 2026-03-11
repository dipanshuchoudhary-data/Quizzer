"use client";

import { useEffect } from "react";
import { AxiosError } from "axios";
import { heartbeatAttempt } from "@/api/examApi";
import { useExamStore } from "@/store/examStore";

export function useHeartbeat(enabled: boolean, onExpired?: (reason: "expired" | "submitted") => void) {
  const attemptId = useExamStore((state) => state.identity.attemptId);
  const attemptToken = useExamStore((state) => state.identity.attemptToken);
  const setConnectionLost = useExamStore((state) => state.setConnectionLost);

  useEffect(() => {
    if (!enabled || !attemptId) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        await heartbeatAttempt(attemptId, attemptToken ?? undefined);
        if (!cancelled) {
          setConnectionLost(false);
        }
      } catch (error) {
        const apiError = error as AxiosError<{ detail?: string }>;
        if (apiError.response?.status === 409) {
          onExpired?.("submitted");
          return;
        }
        if (apiError.response?.status === 410) {
          onExpired?.("expired");
          return;
        }
        if (!cancelled) {
          setConnectionLost(true);
        }
      }
    };

    run();
    const interval = window.setInterval(run, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [enabled, attemptId, attemptToken, onExpired, setConnectionLost]);
}
