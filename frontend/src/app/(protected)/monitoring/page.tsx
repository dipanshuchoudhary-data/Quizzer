"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { quizApi } from "@/lib/api/quiz"

export default function MonitoringLandingPage() {
  const {
    data: quizzes = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["quizzes"],
    queryFn: quizApi.getAll,
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Monitoring</h1>

      {isError && (
        <Card>
          <CardContent className="p-6 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Failed to load quizzes for monitoring.
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card>
          <CardContent className="p-6">Loading quizzes...</CardContent>
        </Card>
      )}

      {!isLoading && !isError && quizzes.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Create a quiz first. Monitoring is available inside each quiz workspace.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {quizzes.map((quiz) => (
          <Card key={quiz.id}>
            <CardContent className="p-6 space-y-3">
              <h2 className="font-semibold line-clamp-1">{quiz.title}</h2>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {quiz.description || "No description provided."}
              </p>
              <Link
                className={buttonVariants({ variant: "outline" })}
                href={`/quiz/${quiz.id}`}
              >
                Open Monitoring Tab
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
