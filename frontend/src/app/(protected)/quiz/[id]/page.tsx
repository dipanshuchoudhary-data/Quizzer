import { redirect } from "next/navigation"
import { QuizWorkspaceClient } from "@/features/quiz/QuizWorkspaceClient"

interface Props {
  params: { id: string }
}

export default function QuizWorkspacePage({ params }: Props) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.id)
  if (!isUuid) {
    redirect(`/exam/${params.id}/start`)
  }
  return <QuizWorkspaceClient quizId={params.id} />
}

