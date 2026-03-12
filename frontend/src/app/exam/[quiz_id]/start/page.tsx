"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { motion } from "framer-motion";

import { startExamAttempt, startPublishedVerifiedExamAttempt } from "@/api/examApi";
import { useExamStore } from "@/store/examStore";
import type { ExamMode, StartExamPayload } from "@/types/exam";

interface StartExamPageProps {
  params: { quiz_id: string };
}

export default function StartExamPage({ params }: StartExamPageProps) {
  const router = useRouter();
  const quizId = params.quiz_id;
  const isPublicExam = !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(quizId);

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
    mutationFn: async (payload: StartExamPayload & { institution_type: ExamMode }) =>
      isPublicExam ? startPublishedVerifiedExamAttempt(quizId, payload) : startExamAttempt(quizId, payload),
    onSuccess: (response, payload) => {
      const durationSeconds = response.duration_seconds ?? response.duration ?? 3600;
      const resolvedMode = response.academic_type ? response.academic_type : payload.institution_type;
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
      if (detail === "You have already started or completed this exam.") {
        setError("You have already started or completed this exam.");
        return;
      }
      if (detail === "College fields missing") {
        setError("Course, section, batch, and semester are required before the exam can start.");
        return;
      }
      if (detail === "Institution type must be School or College") {
        setError("Choose a valid institution type before starting.");
        return;
      }
      if (detail === "Quiz not found") {
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
      setError(detail ?? "Unable to start the exam. Verify your details and retry.");
    },
  });

  const canStart = useMemo(() => {
    return Boolean(
      studentName.trim() &&
        enrollment.trim() &&
        course.trim() &&
        section.trim() &&
        semester.trim() &&
        batch.trim() &&
        mode
    );
  }, [studentName, enrollment, mode, course, section, batch, semester]);

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
      institution_type: mode,
      course: course.trim(),
      section: section.trim(),
      batch: batch.trim(),
      semester: semester.trim(),
      class_name: mode === "school" ? className.trim() : undefined,
      class_section: mode === "school" ? classSection.trim() : undefined,
    };

    if (!hasActiveAttempt) {
      resetExamStore();
    }

    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setError("Fullscreen permission is required before the exam can start.");
      return;
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
              Student Verification
            </span>
            <h1 className="mt-4 max-w-xl text-3xl font-bold tracking-tight text-white md:text-4xl">
              Verify your identity before entering the controlled exam environment.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              Your exam attempt is created only after verification is submitted. Keep this tab focused, allow fullscreen mode, and review the rules carefully before starting.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                "Fullscreen is required during the attempt.",
                "Copy, paste, tab switching, window blur, and devtools activity are recorded as violations.",
                "Leaving the page is logged and the backend timer continues running.",
                "Answers autosave continuously and pending sync status is visible during the exam.",
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
                <p className="mt-1 text-sm text-slate-600">All fields are required. Your verification details will be attached to the attempt record shown in professor results and monitoring.</p>
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

            <form onSubmit={handleStart} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block font-medium text-slate-700">Institution Type</span>
                  <select
                    value={mode}
                    onChange={(e) => setExamMode(e.target.value as ExamMode)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-3"
                  >
                    <option value="college">College</option>
                    <option value="school">School</option>
                  </select>
                </label>
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

              {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                By starting the exam, you consent to fullscreen enforcement, tab visibility monitoring, window blur tracking, answer autosave, and integrity violation logging.
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
