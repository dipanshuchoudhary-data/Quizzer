"use client";

import { useEffect } from "react";
import { AxiosError } from "axios";
import { getAttemptStatus } from "@/api/examApi";
import { useExamStore } from "@/store/examStore";

interface UseExamTimerOptions {
  enabled: boolean;
  onExpired?: (reason: "expired" | "submitted") => void;
}

export function useExamTimer({ enabled, onExpired }: UseExamTimerOptions) {
  const attemptId = useExamStore((state) => state.identity.attemptId);
  const attemptToken = useExamStore((state) => state.identity.attemptToken);
  const setRemainingTime = useExamStore((state) => state.setRemainingTime);
  const setConnectionLost = useExamStore((state) => state.setConnectionLost);

  useEffect(() => {
    if (!enabled || !attemptId) {
      return;
    }

    const tick = window.setInterval(() => {
      useExamStore.setState((state) => ({
        remainingTime: Math.max(0, state.remainingTime - 1),
      }));
    }, 1_000);

    return () => window.clearInterval(tick);
  }, [enabled, attemptId]);

  useEffect(() => {
    if (!enabled || !attemptId) {
      return;
    }

    let cancelled = false;

    const sync = async () => {
      try {
        const data = await getAttemptStatus(attemptId, attemptToken ?? undefined);
        if (cancelled) {
          return;
        }
        const serverRemaining = data.remaining_time ?? data.remaining_seconds ?? 0;
        setRemainingTime(serverRemaining);
        setConnectionLost(false);

        if (data.status === "SUBMITTED") {
          onExpired?.("submitted");
          return;
        }

        if (serverRemaining <= 0 || data.status === "EXPIRED") {
          onExpired?.("expired");
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

    sync();
    const interval = window.setInterval(sync, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [enabled, attemptId, attemptToken, onExpired, setRemainingTime, setConnectionLost]);
}
