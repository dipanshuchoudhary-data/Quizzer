"use client";

import { useCallback, useEffect, useRef } from "react";
import { AxiosError } from "axios";
import { saveStudentAnswer } from "@/api/examApi";
import { useExamStore } from "@/store/examStore";

const DEBOUNCE_MS = 800;

export function useAutoSave(enabled: boolean, onLocked?: (reason: "expired" | "submitted") => void) {
  const attemptId = useExamStore((state) => state.identity.attemptId);
  const attemptToken = useExamStore((state) => state.identity.attemptToken);
  const answers = useExamStore((state) => state.answers);
  const dirtyQuestionIds = useExamStore((state) => state.dirtyQuestionIds);
  const setConnectionLost = useExamStore((state) => state.setConnectionLost);
  const markSaved = useExamStore((state) => state.markSaved);
  const setAnswer = useExamStore((state) => state.setAnswer);

  const debounceTimersRef = useRef<Record<string, number>>({});

  const flushQuestion = useCallback(
    async (questionId: string) => {
      if (!attemptId) {
        return;
      }
      const answer = answers[questionId] ?? "";

      try {
        await saveStudentAnswer({
          attemptId,
          questionId,
          answerText: answer,
          attemptToken: attemptToken ?? undefined,
        });
        markSaved(questionId);
        setConnectionLost(false);
      } catch (error) {
        const apiError = error as AxiosError<{ detail?: string }>;
        if (apiError.response?.status === 409) {
          onLocked?.("submitted");
          return;
        }
        if (apiError.response?.status === 410) {
          onLocked?.("expired");
          return;
        }
        setConnectionLost(true);
      }
    },
    [attemptId, attemptToken, answers, markSaved, onLocked, setConnectionLost]
  );

  const queueAutosave = useCallback(
    (questionId: string, value: string) => {
      setAnswer(questionId, value);
      const existing = debounceTimersRef.current[questionId];
      if (existing) {
        window.clearTimeout(existing);
      }

      debounceTimersRef.current[questionId] = window.setTimeout(() => {
        void flushQuestion(questionId);
      }, DEBOUNCE_MS);
    },
    [flushQuestion, setAnswer]
  );

  useEffect(() => {
    if (!enabled || !attemptId) {
      return;
    }

    const interval = window.setInterval(() => {
      Array.from(dirtyQuestionIds).forEach((questionId) => {
        void flushQuestion(questionId);
      });
    }, 15_000);

    return () => {
      window.clearInterval(interval);
      Object.values(debounceTimersRef.current).forEach((timer) => {
        window.clearTimeout(timer);
      });
      debounceTimersRef.current = {};
    };
  }, [enabled, attemptId, dirtyQuestionIds, flushQuestion]);

  return { queueAutosave, flushQuestion };
}
