import { redirect } from "next/navigation";

interface ExamRootPageProps {
  params: { quiz_id: string };
}

export default function ExamRootPage({ params }: ExamRootPageProps) {
  redirect(`/exam/${params.quiz_id}/start`);
}
