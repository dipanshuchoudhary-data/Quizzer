"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { motion } from "framer-motion";

import { startExamAttempt } from "@/api/examApi";
import { useExamStore } from "@/store/examStore";
import type { ExamMode, StartExamPayload } from "@/types/exam";

interface StartExamPageProps {
  params: { quiz_id: string };
}

export default function StartExamPage({ params }: StartExamPageProps) {
  const router = useRouter();
  const quizId = params.quiz_id;

  const hydrated = useExamStore((state) => state.hydrated);
  const mode = useExamStore((state) => state.mode);
  const identity = useExamStore((state) => state.identity);
  const profile = useExamStore((state) => state.profile);
  const isSubmitted = useExamStore((state) => state.isSubmitted);
  const setMode = useExamStore((state) => state.setMode);
  const initializeAttempt = useExamStore((state) => state.initializeAttempt);
  const resetExamStore = useExamStore((state) => state.resetExamStore);

  const [studentName, setStudentName] = useState("");
  const [enrollment, setEnrollment] = useState("");
  const [course, setCourse] = useState("");
  const [section, setSection] = useState("");
  const [batch, setBatch] = useState("");
  const [semester, setSemester] = useState("");
  const [className, setClassName] = useState("");
  const [classSection, setClassSection] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (identity.quizId && identity.quizId !== quizId) {
      resetExamStore();
      return;
    }

    if (profile && identity.quizId === quizId && !isSubmitted) {
      setStudentName(profile.student_name ?? "");
      setEnrollment(profile.enrollment_number ?? "");
      setCourse(profile.course ?? "");
      setSection(profile.section ?? "");
      setBatch(profile.batch ?? "");
      setSemester(profile.semester ?? "");
      setClassName(profile.class_name ?? "");
      setClassSection(profile.class_section ?? "");
    }
  }, [hydrated, identity.quizId, isSubmitted, profile, quizId, resetExamStore]);

  const startMutation = useMutation({
    mutationFn: async (payload: StartExamPayload) => startExamAttempt(quizId, payload),
    onSuccess: (response, payload) => {
      const durationSeconds = response.duration_seconds ?? response.duration ?? 3600;
      const resolvedMode = response.academic_type ? response.academic_type : mode;
      initializeAttempt({
        quizId,
        attemptId: response.attempt_id,
        attemptToken: response.attempt_token,
        durationSeconds,
        quizTitle: response.quiz_title ?? null,
        questions: response.questions ?? [],
        profile: payload,
        mode: resolvedMode,
      });
      router.replace(`/exam/${quizId}/attempt`);
    },
    onError: (err) => {
      const apiError = err as AxiosError<{ detail?: string }>;
      const detail = apiError.response?.data?.detail;
      if (detail === "Multiple sessions detected" || detail === "ATTEMPT_ALREADY_ACTIVE") {
        setError("This attempt is already active in another session. Close the other session before retrying.");
        return;
      }
      if (detail === "College fields missing") {
        setError("Course, section, batch, and semester are required for this exam.");
        return;
      }
      if (detail === "Class name required for school") {
        setError("Class and section are required for this exam.");
        return;
      }
      setError(detail ?? "Unable to start the exam. Verify the details and retry.");
    },
  });

  const canStart = useMemo(() => {
    if (!studentName.trim() || !enrollment.trim()) {
      return false;
    }
    if (mode === "college") {
      return Boolean(course.trim() && section.trim() && batch.trim() && semester.trim());
    }
    return Boolean(className.trim() && classSection.trim());
  }, [studentName, enrollment, mode, course, section, batch, semester, className, classSection]);

  const hasActiveAttempt =
    hydrated &&
    identity.quizId === quizId &&
    Boolean(identity.attemptId) &&
    !isSubmitted;

  const handleStart = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const payload: StartExamPayload = {
      student_name: studentName.trim(),
      enrollment_number: enrollment.trim(),
      course: mode === "college" ? course.trim() : undefined,
      section: mode === "college" ? section.trim() : undefined,
      batch: mode === "college" ? batch.trim() : undefined,
      semester: mode === "college" ? semester.trim() : undefined,
      class_name: mode === "school" ? className.trim() : undefined,
      class_section: mode === "school" ? classSection.trim() : undefined,
    };

    if (!hasActiveAttempt) {
      resetExamStore();
    }

    await startMutation.mutateAsync(payload);
  };

  const setExamMode = (nextMode: ExamMode) => {
    setError(null);
    setMode(nextMode);
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
              Secure Assessment Session
            </span>
            <h1 className="mt-4 max-w-xl text-3xl font-bold tracking-tight text-white md:text-4xl">
              Enter the controlled exam environment and keep this window focused until submission.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              Quizzer locks the session to backend-authoritative timing, immediate violation reporting, and continuous heartbeat validation.
              The exam starts in fullscreen and every integrity event is recorded.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                "Fullscreen is required during the attempt.",
                "Copy, paste, context menu, and devtools shortcuts are blocked.",
                "Tab switching and fullscreen exit are reported immediately.",
                "Answers autosave continuously; final submission is not trusted alone.",
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
                <h2 className="text-2xl font-semibold">Student Verification</h2>
                <p className="mt-1 text-sm text-slate-600">Enter institution details exactly as registered for the exam.</p>
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

            <div className="mt-5 flex gap-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setExamMode("college")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === "college" ? "bg-slate-900 text-white" : "text-slate-700"}`}
              >
                College
              </button>
              <button
                type="button"
                onClick={() => setExamMode("school")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === "school" ? "bg-slate-900 text-white" : "text-slate-700"}`}
              >
                School
              </button>
            </div>

            <form onSubmit={handleStart} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Name</span>
                  <input
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-3"
                    autoComplete="name"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Enrollment Number</span>
                  <input
                    value={enrollment}
                    onChange={(e) => setEnrollment(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-3"
                    autoComplete="off"
                  />
                </label>
              </div>

              {mode === "college" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Course</span>
                    <input value={course} onChange={(e) => setCourse(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-3" />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Section</span>
                    <input value={section} onChange={(e) => setSection(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-3" />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Batch</span>
                    <input value={batch} onChange={(e) => setBatch(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-3" />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Semester</span>
                    <input value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-3" />
                  </label>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Class</span>
                    <input value={className} onChange={(e) => setClassName(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-3" />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Section</span>
                    <input value={classSection} onChange={(e) => setClassSection(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-3" />
                  </label>
                </div>
              )}

              {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                By starting the exam, you consent to fullscreen enforcement, tab visibility monitoring, answer autosave, and violation logging.
              </div>

              <button
                type="submit"
                disabled={!canStart || startMutation.isPending}
                className="w-full rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {startMutation.isPending ? "Preparing Secure Session..." : "Start Exam"}
              </button>
            </form>
          </section>
        </div>
      </motion.div>
    </main>
  );
}
