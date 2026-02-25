"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Clock3, Grid3X3, List, Rocket } from "lucide-react"
import { quizApi } from "@/lib/api/quiz"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LifecycleBadge } from "@/components/common/LifecycleBadge"

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")
  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ["quizzes"],
    queryFn: quizApi.getAll,
  })

  const stats = useMemo(() => {
    const published = quizzes.filter((quiz) => quiz.is_published).length
    const processing = quizzes.filter((quiz) => quiz.ai_generation_status === "PROCESSING").length
    return { total: quizzes.length, published, processing }
  }, [quizzes])

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-gradient-to-br from-background to-muted/40 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Professor Workspace</h1>
            <p className="text-sm text-muted-foreground">Calm overview of authoring, review, and active exam state.</p>
          </div>
          <p className="text-xs text-muted-foreground">Use top-right Create Quiz for new AI workflows.</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total quizzes</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{isLoading ? "-" : stats.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Published exams</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{isLoading ? "-" : stats.published}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">AI processing</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{isLoading ? "-" : stats.processing}</CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent quizzes</CardTitle>
            <div className="flex items-center gap-1 rounded-md border p-1">
              <Button size="icon" variant={viewMode === "grid" ? "secondary" : "ghost"} onClick={() => setViewMode("grid")}>
                <Grid3X3 size={14} />
              </Button>
              <Button size="icon" variant={viewMode === "table" ? "secondary" : "ghost"} onClick={() => setViewMode("table")}>
                <List size={14} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === "grid" ? (
              <div className="grid gap-3 md:grid-cols-2">
                {quizzes.slice(0, 6).map((quiz) => (
                  <Link href={`/quiz/${quiz.id}`} key={quiz.id} className="rounded-xl border p-4 hover:bg-muted/50">
                    <p className="font-medium">{quiz.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{quiz.description || "No description"}</p>
                    <div className="mt-2">
                      <LifecycleBadge lifecycle={quiz.ai_generation_status} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {quizzes.slice(0, 8).map((quiz) => (
                  <Link href={`/quiz/${quiz.id}`} key={quiz.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/40">
                    <span className="text-sm">{quiz.title}</span>
                    <LifecycleBadge lifecycle={quiz.ai_generation_status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/quizzes" className="flex items-center gap-2 rounded-md border p-3 text-sm hover:bg-muted/40">
              Import Quiz
            </Link>
            <Link href="/monitoring" className="flex items-center gap-2 rounded-md border p-3 text-sm hover:bg-muted/40">
              <Rocket size={14} />
              Active exams
            </Link>
            <Link href="/results" className="flex items-center gap-2 rounded-md border p-3 text-sm hover:bg-muted/40">
              <Clock3 size={14} />
              Result exports
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
