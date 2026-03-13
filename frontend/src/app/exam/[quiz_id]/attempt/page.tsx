"use client";

import { ExamLayout } from "@/components/exam/ExamLayout";

interface AttemptPageProps {
  params: { quiz_id: string };
}

export default function AttemptPage({ params }: AttemptPageProps) {
  return <ExamLayout quizId={params.quiz_id} />;
}
