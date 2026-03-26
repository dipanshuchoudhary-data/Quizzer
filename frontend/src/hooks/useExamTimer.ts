"use client";

import { useEffect, useRef } from "react";
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
  const initialRemainingTime = useExamStore((state) => state.remainingTime);
  const setRemainingTime = useExamStore((state) => state.setRemainingTime);
  const setConnectionLost = useExamStore((state) => state.setConnectionLost);
  const deadlineAtRef = useRef<number | null>(null);
  const lastShownRemainingRef = useRef<number | null>(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!enabled || !attemptId) {
      deadlineAtRef.current = null;
      lastShownRemainingRef.current = null;
      expiredRef.current = false;
      return;
    }

    if (!deadlineAtRef.current) {
      deadlineAtRef.current = Date.now() + Math.max(0, initialRemainingTime) * 1_000;
      lastShownRemainingRef.current = initialRemainingTime;
    }

    const updateFromDeadline = () => {
      const deadlineAt = deadlineAtRef.current;
      if (!deadlineAt) {
        return;
      }

      const remaining = Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1_000));
      if (lastShownRemainingRef.current !== remaining) {
        lastShownRemainingRef.current = remaining;
        setRemainingTime(remaining);
      }

      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpired?.("expired");
      }
    };

    updateFromDeadline();
    const tick = window.setInterval(updateFromDeadline, 250);

    return () => window.clearInterval(tick);
  }, [enabled, attemptId, initialRemainingTime, onExpired, setRemainingTime]);

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
        const nextDeadlineAt = Date.now() + Math.max(0, serverRemaining) * 1_000;
        const currentDeadlineAt = deadlineAtRef.current;
        const currentRemaining = currentDeadlineAt
          ? Math.max(0, Math.ceil((currentDeadlineAt - Date.now()) / 1_000))
          : null;

        if (currentRemaining === null || Math.abs(currentRemaining - serverRemaining) > 2) {
          deadlineAtRef.current = nextDeadlineAt;
          lastShownRemainingRef.current = serverRemaining;
          setRemainingTime(serverRemaining);
        }
        setConnectionLost(false);

        if (data.status === "SUBMITTED") {
          onExpired?.("submitted");
          return;
        }

        if (serverRemaining <= 0 || data.status === "EXPIRED") {
          deadlineAtRef.current = Date.now();
          lastShownRemainingRef.current = 0;
          setRemainingTime(0);
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
