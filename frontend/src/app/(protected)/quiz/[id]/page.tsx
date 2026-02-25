import { QuizWorkspaceClient } from "@/features/quiz/QuizWorkspaceClient"

interface Props {
  params: { id: string }
}

export default function QuizWorkspacePage({ params }: Props) {
  return <QuizWorkspaceClient quizId={params.id} />
}

