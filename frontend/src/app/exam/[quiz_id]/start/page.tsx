"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { motion } from "framer-motion";

import { fetchExamEntryConfig, startExamAttempt, startPublishedVerifiedExamAttempt } from "@/api/examApi";
import { getApiErrorMessage } from "@/lib/api/error";
import { useExamStore } from "@/store/examStore";
import type { ExamMode, StartExamPayload } from "@/types/exam";
import type { QuizVerificationField } from "@/types/quiz";

interface StartExamPageProps {
  params: { quiz_id: string };
}

function validateField(field: QuizVerificationField, value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return field.required ? `${field.label} is required.` : null;
  }

  if (field.type === "number" && !/^-?\d+$/.test(normalized)) {
    return `${field.label} must be a valid number.`;
  }

  if (field.type === "select" && field.options.length > 0 && !field.options.some((option) => option.value === normalized)) {
    return `${field.label} must use one of the listed options.`;
  }

  if (field.min_length && normalized.length < field.min_length) {
    return `${field.label} must be at least ${field.min_length} characters.`;
  }

  if (field.max_length && normalized.length > field.max_length) {
    return `${field.label} must be at most ${field.max_length} characters.`;
  }

  if (field.pattern) {
    const matcher = new RegExp(field.pattern);
    if (!matcher.test(normalized)) {
      return `${field.label} has an invalid format.`;
    }
  }

  return null;
}

export default function StartExamPage({ params }: StartExamPageProps) {
  const router = useRouter();
  const quizId = params.quiz_id;
  const isPublicExam = !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(quizId);

  const hydrated = useExamStore((state) => state.hydrated);
  const identity = useExamStore((state) => state.identity);
  const profile = useExamStore((state) => state.profile);
  const isSubmitted = useExamStore((state) => state.isSubmitted);
  const setMode = useExamStore((state) => state.setMode);
  const initializeAttempt = useExamStore((state) => state.initializeAttempt);
  const resetExamStore = useExamStore((state) => state.resetExamStore);

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const entryConfigQuery = useQuery({
    queryKey: ["exam-entry-config", quizId, isPublicExam],
    queryFn: () => fetchExamEntryConfig(quizId, isPublicExam),
  });

  const verificationSchema = entryConfigQuery.data?.verification;

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (identity.quizId && identity.quizId !== quizId) {
      resetExamStore();
      return;
    }

    if (!verificationSchema) {
      return;
    }

    const baseValues = Object.fromEntries(verificationSchema.fields.map((field) => [field.key, ""]));
    const persistedValues =
      profile && identity.quizId === quizId && !isSubmitted
        ? { ...baseValues, ...(profile.verification_data ?? {}) }
        : baseValues;

    setFormData(persistedValues);
  }, [hydrated, identity.quizId, isSubmitted, profile, quizId, resetExamStore, verificationSchema]);

  const fieldErrors = useMemo(() => {
    if (!verificationSchema) return {};
    return Object.fromEntries(
      verificationSchema.fields
        .map((field) => [field.key, validateField(field, formData[field.key] ?? "")])
        .filter(([, message]) => Boolean(message))
    ) as Record<string, string>;
  }, [formData, verificationSchema]);

  const startMutation = useMutation({
    mutationFn: async (payload: StartExamPayload) =>
      isPublicExam ? startPublishedVerifiedExamAttempt(quizId, payload) : startExamAttempt(quizId, payload),
    onSuccess: (response, payload) => {
      const durationSeconds = response.duration_seconds ?? response.duration ?? 3600;
      const resolvedMode = (response.academic_type ?? entryConfigQuery.data?.verification.context ?? "college") as ExamMode;
      const primaryField = entryConfigQuery.data?.verification.identity_fields?.[0];
      initializeAttempt({
        quizId,
        attemptId: response.attempt_id,
        attemptToken: response.attempt_token,
        durationSeconds,
        quizTitle: response.quiz_title ?? entryConfigQuery.data?.quiz_title ?? null,
        questions: response.questions ?? [],
        profile: {
          verification_context: entryConfigQuery.data?.verification.context ?? resolvedMode,
          verification_data: payload.verification_data,
          student_name: payload.verification_data.student_name ?? "",
          display_identifier: primaryField ? payload.verification_data[primaryField] ?? "" : payload.verification_data.student_name ?? "",
        },
        mode: resolvedMode,
        violationLimit: response.violation_limit ?? entryConfigQuery.data?.violation_limit ?? null,
        markDeductionPerViolation: response.mark_deduction_per_violation ?? null,
      });
      setMode(resolvedMode);
      router.replace(`/exam/${quizId}/attempt`);
    },
    onError: (err) => {
      const apiError = err as AxiosError<{ detail?: string }>;
      const detail = apiError.response?.data?.detail;
      if (detail === "Multiple sessions detected" || detail === "ATTEMPT_ALREADY_ACTIVE") {
        setError("This attempt is already active in another session. Close the other session before retrying.");
        return;
      }
      if (detail === "You have already started or completed this exam.") {
        setError("You have already started or completed this exam.");
        return;
      }
      if (detail === "Quiz not found" || detail === "Quiz not available") {
        setError("Exam not available.");
        return;
      }
      if (detail === "Quiz not published") {
        setError("Exam not active.");
        return;
      }
      if (detail === "Exam has ended") {
        setError("This exam has ended.");
        return;
      }
      setError(getApiErrorMessage(err, "Unable to start the exam. Verify your details and retry."));
    },
  });

  const canStart = useMemo(() => {
    if (!verificationSchema || entryConfigQuery.isLoading || startMutation.isPending) {
      return false;
    }
    return Object.keys(fieldErrors).length === 0;
  }, [entryConfigQuery.isLoading, fieldErrors, startMutation.isPending, verificationSchema]);

  const hasActiveAttempt =
    hydrated &&
    identity.quizId === quizId &&
    Boolean(identity.attemptId) &&
    !isSubmitted;

  const handleStart = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!verificationSchema) {
      setError("Verification form is still loading. Please retry in a moment.");
      return;
    }

    if (Object.keys(fieldErrors).length > 0) {
      setError(Object.values(fieldErrors)[0]);
      return;
    }

    const payload: StartExamPayload = {
      verification_context: verificationSchema.context,
      verification_data: Object.fromEntries(
        verificationSchema.fields
          .map((field) => [field.key, (formData[field.key] ?? "").trim()])
          .filter(([, value]) => value.length > 0)
      ),
    };

    if (!hasActiveAttempt) {
      resetExamStore();
    }

    if (entryConfigQuery.data?.require_fullscreen !== false) {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        setError("Fullscreen permission is required before the exam can start.");
        return;
      }
    }

    await startMutation.mutateAsync(payload);
  };

  const renderField = (field: QuizVerificationField) => {
    const value = formData[field.key] ?? "";
    const message = fieldErrors[field.key];
    const commonClass = `w-full rounded-xl border px-3 py-3 ${message ? "border-rose-300" : "border-slate-300"}`;

    if (field.type === "select") {
      return (
        <select
          value={value}
          onChange={(event) => setFormData((current) => ({ ...current, [field.key]: event.target.value }))}
          className={commonClass}
        >
          <option value="">{field.placeholder ?? `Select ${field.label}`}</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        type={field.type === "number" ? "number" : "text"}
        value={value}
        onChange={(event) => setFormData((current) => ({ ...current, [field.key]: event.target.value }))}
        className={commonClass}
        autoComplete="off"
        placeholder={field.placeholder ?? ""}
      />
    );
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a_0%,#1e293b_25%,#e2e8f0_100%)] p-6 text-slate-100">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-5xl rounded-[2rem] border border-white/15 bg-slate-950/65 p-6 shadow-2xl backdrop-blur md:p-8"
      >
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section>
            <span className="inline-flex rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
              Student Verification
            </span>
            <h1 className="mt-4 max-w-xl text-3xl font-bold tracking-tight text-white md:text-4xl">
              {entryConfigQuery.data?.quiz_title ?? "Verify your identity before entering the controlled exam environment."}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              {verificationSchema?.description ?? "Your exam attempt is created only after verification is submitted. Keep this tab focused, allow fullscreen mode, and review the rules carefully before starting."}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                entryConfigQuery.data?.require_fullscreen === false ? "Fullscreen is optional for this quiz." : "Fullscreen is required during the attempt.",
                "Copy, paste, tab switching, window blur, and devtools activity are recorded as violations.",
                "Leaving the page is logged and the backend timer continues running.",
                `This quiz escalates after ${entryConfigQuery.data?.violation_limit ?? 3} integrity violations.`,
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-white/95 p-6 text-slate-900 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">{verificationSchema?.title ?? "Student Verification"}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Only the fields configured for this exam are required. These details are attached to the attempt record shown in teacher results and monitoring.
                </p>
              </div>
              {hasActiveAttempt ? (
                <Link
                  href={`/exam/${quizId}/attempt`}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  Resume Attempt
                </Link>
              ) : null}
            </div>

            {entryConfigQuery.isLoading ? <p className="mt-6 text-sm text-slate-600">Loading verification form...</p> : null}
            {entryConfigQuery.isError ? <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{getApiErrorMessage(entryConfigQuery.error, "Failed to load the exam verification form.")}</p> : null}

            {verificationSchema ? (
              <form onSubmit={handleStart} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {verificationSchema.fields.map((field) => (
                    <label key={field.key} className={`text-sm ${verificationSchema.fields.length % 2 === 1 && field.key === verificationSchema.fields[verificationSchema.fields.length - 1]?.key ? "sm:col-span-2" : ""}`}>
                      <span className="mb-1 block font-medium text-slate-700">
                        {field.label}
                        {field.required ? " *" : ""}
                      </span>
                      {renderField(field)}
                      <span className={`mt-1 block text-xs ${fieldErrors[field.key] ? "text-rose-600" : "text-slate-500"}`}>
                        {fieldErrors[field.key] ?? field.help_text ?? field.placeholder ?? " "}
                      </span>
                    </label>
                  ))}
                </div>

                {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                  By starting the exam, you consent to fullscreen enforcement, tab visibility monitoring, window blur tracking, answer autosave, and integrity violation logging.
                </div>

                <button
                  type="submit"
                  disabled={!canStart}
                  className="w-full rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {startMutation.isPending ? "Preparing Secure Session..." : "Start Exam"}
                </button>
              </form>
            ) : null}
          </section>
        </div>
      </motion.div>
    </main>
  );
}
