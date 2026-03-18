"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Activity, Clock3, FileText, Sparkles } from "lucide-react"
import { quizApi } from "@/lib/api/quiz"
import { dashboardApi } from "@/lib/api/dashboard"
import { StatusBadge } from "@/components/common/StatusBadge"
import { cn } from "@/lib/utils"

function formatUpdatedAt(updatedAt?: string) {
  if (!updatedAt) return "Updated recently"
  const parsed = new Date(updatedAt)
  if (Number.isNaN(parsed.getTime())) return "Updated recently"
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsed)
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest("a, button, [role='button']"))
}

export default function ExamsPage() {
  const router = useRouter()

  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ["quizzes"],
    queryFn: quizApi.getAll,
  })

  const { data: liveData } = useQuery({
    queryKey: ["dashboard-live-exams"],
    queryFn: dashboardApi.getLiveExams,
    staleTime: 15_000,
  })

  const { data: summary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: dashboardApi.getSummary,
    staleTime: 30_000,
  })

  const liveQuizIds = useMemo(() => new Set(liveData?.items.map((item) => item.quiz_id)), [liveData])
  const runningJobs = summary?.running_jobs ?? []

  return (
    <section className="space-y-6">
      <div className="dashboard-fade-up rounded-3xl bg-gradient-to-br from-background via-background to-muted/40 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Exams Hub</p>
            <h1 className="text-2xl font-semibold tracking-tight">Exams</h1>
            <p className="text-sm text-muted-foreground">Every quiz is a workspace. Open one to manage questions, monitoring, results, and settings.</p>
          </div>
          <div className="rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
            {quizzes.length} total quizzes
          </div>
        </div>
      </div>

      {runningJobs.length > 0 ? (
        <div id="ai-jobs" className="dashboard-fade-up rounded-3xl border bg-card/80 p-5 shadow-sm" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">AI Jobs Running</h2>
              <p className="text-sm text-muted-foreground">Generation pipelines currently processing.</p>
            </div>
            <Sparkles className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {runningJobs.slice(0, 3).map((job) => {
              const normalized = job.progress <= 1 ? job.progress * 100 : job.progress
              const progress = Math.min(100, Math.max(0, normalized))
              return (
                <div key={job.id} className="rounded-2xl border bg-background/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{job.quiz_title}</p>
                      <p className="text-xs text-muted-foreground">{job.stage}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div key={`exam-skeleton-${index}`} className="dashboard-fade-up rounded-2xl border bg-card/70 p-4 shadow-sm" style={{ animationDelay: `${120 + index * 60}ms` }}>
                <div className="skeleton h-4 w-32" />
                <div className="mt-4 skeleton h-6 w-16" />
                <div className="mt-3 skeleton h-3 w-24" />
              </div>
            ))
          : quizzes.map((quiz, index) => {
              const status = liveQuizIds.has(quiz.id) ? "LIVE" : quiz.is_published ? "PUBLISHED" : "DRAFT"
              const questionCount = quiz.question_count ?? 0
              const durationLabel = quiz.duration_minutes ? `${quiz.duration_minutes} min` : "No time limit"
              return (
                <div
                  key={quiz.id}
                  role="link"
                  tabIndex={0}
                  onClick={(event) => {
                    if (isInteractiveTarget(event.target)) return
                    router.push(`/quiz/${quiz.id}`)
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return
                    if (isInteractiveTarget(event.target)) return
                    event.preventDefault()
                    router.push(`/quiz/${quiz.id}`)
                  }}
                  className={cn(
                    "dashboard-fade-up group relative cursor-pointer rounded-2xl border bg-card/80 p-4 shadow-sm transition-all duration-150",
                    "hover:-translate-y-1 hover:scale-[1.02] hover:border-primary/30 hover:shadow-md hover:brightness-[1.02]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                  )}
                  style={{ animationDelay: `${120 + index * 60}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-foreground line-clamp-1">{quiz.title}</p>
                      <p className="text-xs text-muted-foreground">Updated {formatUpdatedAt(quiz.updated_at)}</p>
                    </div>
                    <StatusBadge status={status} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-foreground/70" />
                      <span>{questionCount} questions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock3 className="size-4 text-foreground/70" />
                      <span>{durationLabel}</span>
                    </div>
                  </div>

                  <div className="pointer-events-none absolute inset-x-4 bottom-4 flex translate-y-2 items-center gap-2 opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                    <div className="flex w-full items-center justify-between rounded-full border bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm">
                      <span className="font-semibold text-foreground">Quick actions</span>
                      <div className="flex items-center gap-3">
                        <Link href={`/quiz/${quiz.id}`} className="pointer-events-auto font-medium text-foreground/70 transition-colors hover:text-foreground">Open</Link>
                        <Link href={`/quiz/${quiz.id}?tab=monitoring`} className="pointer-events-auto font-medium text-foreground/70 transition-colors hover:text-foreground">Monitor</Link>
                        <Link href={`/quiz/${quiz.id}?tab=results`} className="pointer-events-auto font-medium text-foreground/70 transition-colors hover:text-foreground">Results</Link>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
      </div>

      {!isLoading && quizzes.length === 0 ? (
        <div className="rounded-3xl border bg-background/80 p-10 text-center text-sm text-muted-foreground">
          No quizzes yet. Create your first quiz to begin.
        </div>
      ) : null}

      {liveData?.alerts?.length ? (
        <div className="dashboard-fade-up rounded-3xl border bg-card/80 p-5 shadow-sm" style={{ animationDelay: "180ms" }}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="size-4 text-foreground/70" />
            Live monitoring alerts
          </div>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            {liveData.alerts.map((alert, index) => (
              <div key={`${alert.quiz_id}-${index}`} className="rounded-xl border bg-background/80 px-3 py-2">
                <span className="font-medium text-foreground">{alert.quiz_name}:</span> {alert.message}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
