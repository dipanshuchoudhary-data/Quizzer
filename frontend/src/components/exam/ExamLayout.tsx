"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { motion } from "framer-motion";

import { submitAttempt } from "@/api/examApi";
import { ExamTimer } from "@/components/exam/ExamTimer";
import { QuestionNavigator } from "@/components/exam/QuestionNavigator";
import { QuestionRenderer } from "@/components/exam/QuestionRenderer";
import { SubmitDialog } from "@/components/exam/SubmitDialog";
import { ViolationWarningModal } from "@/components/exam/ViolationWarningModal";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useExamTimer } from "@/hooks/useExamTimer";
import { useHeartbeat } from "@/hooks/useHeartbeat";
import { useExamStore } from "@/store/examStore";
import { ContextMenuGuard } from "@/security/ContextMenuGuard";
import { FullscreenGuard } from "@/security/FullscreenGuard";
import { PasteDetector } from "@/security/PasteDetector";
import { TabSwitchDetector } from "@/security/TabSwitchDetector";
import { WindowBlurDetector } from "@/security/WindowBlurDetector";
import { useViolationReporter } from "@/hooks/useViolationReporter";

interface ExamLayoutProps {
  quizId: string;
}

export function ExamLayout({ quizId }: ExamLayoutProps) {
  const router = useRouter();

  const hydrated = useExamStore((state) => state.hydrated);
  const identity = useExamStore((state) => state.identity);
  const questions = useExamStore((state) => state.questions);
  const answers = useExamStore((state) => state.answers);
  const currentQuestionId = useExamStore((state) => state.currentQuestionId);
  const visited = useExamStore((state) => state.visited);
  const flagged = useExamStore((state) => state.flagged);
  const remainingTime = useExamStore((state) => state.remainingTime);
  const connectionLost = useExamStore((state) => state.connectionLost);
  const violationWarning = useExamStore((state) => state.violationWarning);
  const violationCount = useExamStore((state) => state.violationCount);
  const dirtyQuestionIds = useExamStore((state) => state.dirtyQuestionIds);
  const isSubmitted = useExamStore((state) => state.isSubmitted);

  const setCurrentQuestion = useExamStore((state) => state.setCurrentQuestion);
  const toggleFlag = useExamStore((state) => state.toggleFlag);
  const markSubmitted = useExamStore((state) => state.markSubmitted);
  const clearViolationWarning = useExamStore((state) => state.clearViolationWarning);
  const { reportViolation } = useViolationReporter();

  const [submitOpen, setSubmitOpen] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const answeredIds = useMemo(() => {
    const next = new Set<string>();
    Object.entries(answers).forEach(([questionId, value]) => {
      if (String(value || "").trim().length > 0) {
        next.add(questionId);
      }
    });
    return next;
  }, [answers]);

  const currentQuestionIndex = useMemo(
    () => questions.findIndex((q) => q.id === currentQuestionId),
    [questions, currentQuestionId]
  );

  const currentQuestion = useMemo(
    () => questions.find((q) => q.id === currentQuestionId) ?? null,
    [questions, currentQuestionId]
  );

  const gotoQuestionByOffset = (offset: number) => {
    if (!questions.length) {
      return;
    }
    const nextIndex = currentQuestionIndex < 0 ? 0 : Math.min(Math.max(currentQuestionIndex + offset, 0), questions.length - 1);
    const nextQuestion = questions[nextIndex];
    if (nextQuestion) {
      setCurrentQuestion(nextQuestion.id);
    }
  };

  const skipQuestion = () => {
    const startIndex = Math.max(currentQuestionIndex, 0) + 1;
    const fallbackIndex = Math.min(startIndex, Math.max(questions.length - 1, 0));
    const nextUnvisited = questions.slice(startIndex).find((question) => !visited.has(question.id)) ?? questions[fallbackIndex];
    if (nextUnvisited) {
      setCurrentQuestion(nextUnvisited.id);
    }
  };

  const handleLockedAttempt = (reason: "expired" | "submitted") => {
    markSubmitted();
    router.replace(`/exam/${quizId}/submitted?reason=${reason}`);
  };

  const { queueAutosave, flushQuestion } = useAutoSave(Boolean(identity.attemptId), handleLockedAttempt);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!identity.attemptId) {
        throw new Error("Attempt not initialized");
      }

      await Promise.all(Object.keys(answers).map((questionId) => flushQuestion(questionId)));
      return submitAttempt(identity.attemptId, identity.attemptToken ?? undefined);
    },
    onSuccess: () => {
      markSubmitted();
      router.replace(`/exam/${quizId}/submitted?reason=submitted`);
    },
    onError: (error) => {
      const apiError = error as AxiosError<{ detail?: string }>;
      const detail = apiError.response?.data?.detail;
      if (apiError.response?.status === 409) {
        handleLockedAttempt("submitted");
        return;
      }
      if (apiError.response?.status === 410) {
        handleLockedAttempt("expired");
        return;
      }
      setSubmissionError(detail ?? "Submission failed. Keep the page open and retry.");
    },
    onSettled: () => {
      setSubmitOpen(false);
    },
  });

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!identity.attemptId || identity.quizId !== quizId) {
      router.replace(`/exam/${quizId}/start`);
      return;
    }

    if (isSubmitted) {
      router.replace(`/exam/${quizId}/submitted?reason=submitted`);
    }
  }, [hydrated, identity.attemptId, identity.quizId, isSubmitted, quizId, router]);

  useEffect(() => {
    if (!identity.attemptId) {
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
      void reportViolation("WINDOW_BLUR");
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [identity.attemptId, reportViolation]);

  useEffect(() => {
    if (!identity.attemptId) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        gotoQuestionByOffset(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        gotoQuestionByOffset(-1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [identity.attemptId, currentQuestionIndex, questions]);

  useHeartbeat(Boolean(identity.attemptId), handleLockedAttempt);
  useExamTimer({
    enabled: Boolean(identity.attemptId),
    onExpired: (reason) => {
      if (reason === "submitted") {
        handleLockedAttempt("submitted");
        return;
      }
      handleLockedAttempt("expired");
    },
  });

  if (!hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm">Restoring secure session...</div>
      </main>
    );
  }

  if (!identity.attemptId || identity.quizId !== quizId) {
    return null;
  }

  return (
    <>
      <FullscreenGuard enabled={!submitMutation.isPending} />
      <TabSwitchDetector enabled={!submitMutation.isPending} />
      <WindowBlurDetector enabled={!submitMutation.isPending} />
      <PasteDetector enabled={!submitMutation.isPending} />
      <ContextMenuGuard enabled={!submitMutation.isPending} />

      <main className="min-h-screen bg-[linear-gradient(135deg,#020617_0%,#0f172a_40%,#1e293b_100%)] p-4 text-slate-100 md:p-6">
        <section className="mx-auto flex max-w-[1600px] flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-[1.5rem] border border-white/10 bg-white/5 px-5 py-4 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Secure Exam Session</p>
              <h1 className="mt-1 text-xl font-semibold text-white">{identity.quizTitle ?? "Quizzer Assessment"}</h1>
              <p className="mt-1 text-sm text-slate-300">
                Stay in fullscreen. Answers autosave continuously. Backend time and submission state are authoritative.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Attempt {identity.attemptId.slice(0, 8)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Saved {answeredIds.size}/{questions.length}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Pending Sync {dirtyQuestionIds.size}
              </span>
            </div>
          </div>

          {connectionLost ? (
            <div className="rounded-2xl border border-amber-300/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Network instability detected. The session is retrying heartbeat and timer sync. Do not close this tab.
            </div>
          ) : null}

          {submissionError ? (
            <div className="rounded-2xl border border-rose-300/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {submissionError}
            </div>
          ) : null}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 gap-4 lg:grid-cols-[19rem_minmax(0,1fr)_18rem]"
          >
            <QuestionNavigator
              questionIds={questions.map((q) => q.id)}
              currentQuestionId={currentQuestionId}
              answeredIds={answeredIds}
              visitedIds={visited}
              flaggedIds={flagged}
              onSelect={setCurrentQuestion}
            />

            <section className="space-y-4">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-200 backdrop-blur">
                {currentQuestion ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Current Question</p>
                      <p className="mt-1 font-medium text-white">
                        Question {currentQuestionIndex + 1} of {questions.length}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                        Type {currentQuestion.question_type.replaceAll("_", " ")}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                        {currentQuestion.marks ?? 1} mark(s)
                      </span>
                    </div>
                  </div>
                ) : (
                  <p>No question available for this attempt.</p>
                )}
              </div>

              <QuestionRenderer
                question={currentQuestion}
                answer={currentQuestion ? answers[currentQuestion.id] ?? "" : ""}
                onAnswerChange={(value) => {
                  if (!currentQuestion) {
                    return;
                  }
                  queueAutosave(currentQuestion.id, value);
                }}
              />

              <div className="grid grid-cols-2 gap-3 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm backdrop-blur md:grid-cols-4">
                <button
                  type="button"
                  onClick={() => gotoQuestionByOffset(-1)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-medium text-slate-100 transition duration-150 hover:brightness-110 hover:scale-[1.03] active:scale-[0.96]"
                >
                  Previous Question
                </button>
                <button
                  type="button"
                  onClick={() => gotoQuestionByOffset(1)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-medium text-slate-100 transition duration-150 hover:brightness-110 hover:scale-[1.03] active:scale-[0.96]"
                >
                  Next Question
                </button>
                <button
                  type="button"
                  onClick={skipQuestion}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-medium text-slate-100 transition duration-150 hover:brightness-110 hover:scale-[1.03] active:scale-[0.96]"
                >
                  Skip Question
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!currentQuestion) return;
                    queueAutosave(currentQuestion.id, "");
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-medium text-slate-100 transition duration-150 hover:brightness-110 hover:scale-[1.03] active:scale-[0.96]"
                >
                  Clear Answer
                </button>
              </div>
            </section>

            <ExamTimer
              remainingTime={remainingTime}
              savedCount={answeredIds.size}
              totalQuestions={questions.length}
              pendingSyncCount={dirtyQuestionIds.size}
              violationCount={violationCount}
              onSubmit={() => {
                setSubmitOpen(true);
              }}
              onPrevious={() => gotoQuestionByOffset(-1)}
              onNext={() => gotoQuestionByOffset(1)}
              onSkip={skipQuestion}
              onClearAnswer={() => {
                if (!currentQuestion) return;
                queueAutosave(currentQuestion.id, "");
              }}
              onFlag={() => {
                if (currentQuestionId) {
                  toggleFlag(currentQuestionId);
                }
              }}
              flagged={Boolean(currentQuestionId && flagged.has(currentQuestionId))}
              disableActions={submitMutation.isPending}
            />
          </motion.div>
        </section>
      </main>

      <SubmitDialog
        open={submitOpen}
        onCancel={() => setSubmitOpen(false)}
        onConfirm={() => {
          setSubmissionError(null);
          submitMutation.mutate();
        }}
        loading={submitMutation.isPending}
      />

      <ViolationWarningModal warning={violationWarning} onDismiss={clearViolationWarning} />
    </>
  );
}
