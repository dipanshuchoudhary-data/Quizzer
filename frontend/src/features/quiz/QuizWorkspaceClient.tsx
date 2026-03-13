"use client"

import { useQuery } from "@tanstack/react-query"
import { quizApi } from "@/lib/api/quiz"
import { QuizHeader } from "@/features/quiz/QuizHeader"
import { QuizTabs } from "@/features/quiz/QuizTabs"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function QuizWorkspaceClient({ quizId }: { quizId: string }) {
  const { data: quiz, isLoading, isError, refetch } = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: () => quizApi.getById(quizId),
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Loading workspace...</CardContent>
      </Card>
    )
  }

  if (isError || !quiz) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-6">
          <p className="text-sm text-muted-foreground">Unable to load quiz workspace.</p>
          <Button variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <QuizHeader quiz={quiz} />
      <QuizTabs quizId={quiz.id} />
    </div>
  )
}
