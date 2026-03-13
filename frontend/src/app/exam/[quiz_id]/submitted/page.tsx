"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

import { useExamStore } from "@/store/examStore";

interface SubmittedPageProps {
  params: { quiz_id: string };
}

export default function SubmittedPage({ params }: SubmittedPageProps) {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const resetExamStore = useExamStore((state) => state.resetExamStore);

  useEffect(() => {
    resetExamStore();
  }, [resetExamStore]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#0f172a_0%,#1e293b_35%,#cbd5e1_100%)] p-6">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl rounded-[2rem] border border-white/20 bg-slate-950/75 p-8 text-center text-slate-100 shadow-2xl backdrop-blur"
      >
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">Attempt Closed</p>
        <h1 className="mt-3 text-3xl font-bold text-white">
          {reason === "expired" ? "Exam time ended" : "Exam submitted successfully"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {reason === "expired"
            ? "The backend timer expired and the attempt was closed. Any saved responses have been retained for grading."
            : "Your responses were locked and sent for grading. This attempt cannot be reopened from this link."}
        </p>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
          You can close this window now. Returning to the exam start page will not restore access to the submitted attempt.
        </div>
        <Link
          href={`/exam/${params.quiz_id}/start`}
          className="mt-6 inline-block rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-slate-100"
        >
          Return to Start Page
        </Link>
      </motion.section>
    </main>
  );
}
