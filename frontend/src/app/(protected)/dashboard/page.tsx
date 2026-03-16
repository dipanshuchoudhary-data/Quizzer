"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Manrope } from "next/font/google"
import {
  Activity,
  AlarmClock,
  BookOpen,
  Clock3,
  FileText,
  Flame,
  ListChecks,
  Rocket,
  Sparkles,
} from "lucide-react"
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts"
import { dashboardApi } from "@/lib/api/dashboard"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/useAuthStore"
import { useAccountSettingsStore } from "@/stores/useAccountSettingsStore"

const dashboardFont = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"] })

const statusStyles: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  Published: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  Reviewing: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200",
  Draft: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-200",
  Alert: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200",
  Scheduled: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(media.matches)
    const handler = () => setReduced(media.matches)
    media.addEventListener?.("change", handler)
    return () => media.removeEventListener?.("change", handler)
  }, [])
  return reduced
}

function useCountUp(value: number, duration = 700) {
  const reducedMotion = usePrefersReducedMotion()
  const [display, setDisplay] = useState(value)
  const previous = useRef(value)

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(value)
      previous.current = value
      return
    }

    const startValue = previous.current
    const delta = value - startValue
    if (delta === 0) return

    const startTime = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const nextValue = Math.round(startValue + delta * progress)
      setDisplay(nextValue)
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        previous.current = value
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [duration, reducedMotion, value])

  return display
}

function formatDuration(minutes: number) {
  if (!minutes || minutes <= 0) return "-"
  return `${minutes} min`
}

function formatUpdatedAt(updatedAt?: string) {
  if (!updatedAt) return "Updated recently"
  const parsed = new Date(updatedAt)
  if (Number.isNaN(parsed.getTime())) return "Updated recently"
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsed)
}

function formatTimeRemaining(seconds: number | null) {
  if (seconds == null) return "No time limit"
  if (seconds <= 0) return "Ending now"
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hrs > 0) return `${hrs}h ${mins}m left`
  return `${mins}m left`
}

function DashboardBadge({ label, pulse }: { label: string; pulse?: boolean }) {
  return (
    <Badge
      className={cn(
        "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors",
        statusStyles[label] ?? "bg-muted text-muted-foreground",
        pulse && "dash-pulse"
      )}
    >
      {label}
    </Badge>
  )
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { quiz_name: string; average_score: number } }> }) {
  if (!active || !payload?.length) return null
  const data = payload[0]?.payload
  return (
    <div className="rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-foreground">{data.quiz_name}</p>
      <p className="text-muted-foreground">Average score: {data.average_score}%</p>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { profile, hydrate } = useAccountSettingsStore()
  const router = useRouter()

  useEffect(() => {
    hydrate(user)
  }, [hydrate, user])

  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: dashboardApi.getSummary,
  })

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["dashboard-analytics"],
    queryFn: dashboardApi.getAnalytics,
  })

  const stats = useMemo(() => {
    const total = summary?.stats.total_quizzes ?? 0
    const published = summary?.stats.published_exams ?? 0
    const activeAttempts = summary?.active_exams.reduce((acc, exam) => acc + exam.active_students, 0) ?? 0
    const aiJobs = summary?.stats.ai_jobs_running ?? 0
    return { total, published, activeAttempts, aiJobs }
  }, [summary])

  const totalDisplay = useCountUp(stats.total)
  const publishedDisplay = useCountUp(stats.published)
  const activeAttemptsDisplay = useCountUp(stats.activeAttempts)
  const aiJobsDisplay = useCountUp(stats.aiJobs)

  const profileName = profile.name || (user?.email ? user.email.split("@")[0] : "Professor")

  const recentQuizzes = summary?.recent_quizzes ?? []

  const runningJobs = summary?.running_jobs ?? []
  const activeExams = summary?.active_exams ?? []

  const showJobsPanel = runningJobs.length > 0

  return (
    <div className={cn("space-y-6", dashboardFont.className)}>
      <section
        className="dashboard-fade-up rounded-3xl border bg-gradient-to-br from-background via-background to-muted/40 p-6 shadow-sm"
        style={{ animationDelay: "0ms" }}
      >
        <div className="flex flex-wrap items-start gap-6">
          <div className="min-w-[240px] flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Professor Dashboard</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Welcome back, {profileName}.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Monitor live exams, review recent quizzes, and track AI generation status at a glance.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={() => router.push("/quizzes/create")}>Create Quiz</Button>
              <Button variant="outline" onClick={() => router.push("/quizzes/create?source=ai")}>
                Generate Quiz with AI
              </Button>
              <Button variant="outline" onClick={() => router.push("/quizzes/create?source=import")}>
                Import Questions
              </Button>
              <Button variant="outline" onClick={() => router.push("/exams")}>
                Manage Exams
              </Button>
              <Button variant="outline" onClick={() => router.push("/live-exams")}>
                Monitor Live Exams
              </Button>
              <Button variant="outline" onClick={() => router.push("/published")}>
                Start Live Exam
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section
        className="dashboard-fade-up"
        style={{ animationDelay: "60ms" }}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={`stat-skeleton-${index}`} className="rounded-2xl border bg-card/70 p-4 shadow-sm">
                <div className="skeleton h-4 w-24" />
                <div className="mt-4 skeleton h-8 w-20" />
                <div className="mt-2 skeleton h-3 w-28" />
              </div>
            ))
          ) : (
            [
              {
                label: "Total Quizzes",
                value: totalDisplay,
                icon: BookOpen,
                hint: "All created quizzes",
                href: "/quizzes",
              },
              {
                label: "Published Exams",
                value: publishedDisplay,
                icon: Rocket,
                hint: "Live & scheduled",
                href: "/published",
              },
              {
                label: "Active Attempts",
                value: activeAttemptsDisplay,
                icon: Activity,
                hint: "Students in-session",
                href: "/live-exams",
              },
              {
                label: "AI Jobs Running",
                value: aiJobsDisplay,
                icon: Sparkles,
                hint: "Generation pipelines",
                href: "/jobs",
              },
            ].map((stat, index) => {
              const Icon = stat.icon
              return (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className={cn(
                    "dashboard-fade-up group rounded-2xl border bg-card/80 p-4 shadow-sm transition-all duration-150",
                    "hover:-translate-y-1 hover:scale-[1.02] hover:shadow-md hover:brightness-[1.02] active:scale-[0.99]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                  )}
                  style={{ animationDelay: `${120 + index * 60}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {stat.label}
                    </p>
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-foreground transition-colors group-hover:bg-muted">
                      <Icon className="size-4" />
                    </span>
                  </div>
                  <div className="mt-4 text-3xl font-semibold text-foreground">{stat.value}</div>
                  <p className="mt-2 text-xs text-muted-foreground">{stat.hint}</p>
                </Link>
              )
            })
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr,1.4fr]">
        <div className="dashboard-fade-up" style={{ animationDelay: "180ms" }}>
          <div className="rounded-3xl border bg-card/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Active exams</h2>
                <p className="text-sm text-muted-foreground">Live sessions requiring attention.</p>
              </div>
              <Link
                href="/live-exams"
                className="text-xs font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
              >
                View all
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={`exam-skeleton-${index}`} className="rounded-2xl border bg-background/80 p-4">
                    <div className="flex items-center justify-between">
                      <div className="skeleton h-4 w-40" />
                      <div className="skeleton h-5 w-16" />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="skeleton h-3 w-20" />
                      <div className="skeleton h-3 w-24" />
                    </div>
                  </div>
                ))
              ) : activeExams.length === 0 ? (
                <div className="rounded-2xl border bg-background/70 p-6 text-center text-sm text-muted-foreground">
                  No active exams right now. Launch a published exam to begin monitoring.
                </div>
              ) : (
                activeExams.map((exam) => {
                  const statusLabel = exam.time_remaining_seconds && exam.time_remaining_seconds > 0 ? "Active" : "Scheduled"
                  const hasAlert = exam.violations_count > 0
                  return (
                    <div
                      key={exam.id}
                      role="link"
                      tabIndex={0}
                      onClick={(event) => {
                        const target = event.target as HTMLElement | null
                        if (target?.closest("a")) return
                        router.push(`/quiz/${exam.id}?tab=monitoring`)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") router.push(`/quiz/${exam.id}?tab=monitoring`)
                      }}
                      className={cn(
                        "group rounded-2xl border bg-background/80 p-4 transition-all duration-150 focus-visible:outline-none",
                        "hover:-translate-y-1 hover:scale-[1.02] hover:border-primary/30 hover:bg-muted/50 hover:shadow-md hover:brightness-[1.01] active:scale-[0.99]",
                        "focus-visible:ring-2 focus-visible:ring-ring/70"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{exam.title}</p>
                          <p className="text-xs text-muted-foreground">{exam.submissions_count} submissions</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasAlert ? <DashboardBadge label="Alert" /> : null}
                          <DashboardBadge label={statusLabel} pulse={statusLabel === "Active"} />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                        <div className="flex items-center gap-2">
                          <ListChecks className="size-4 text-foreground/70" />
                          <span>{exam.active_students} active students</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Flame className="size-4 text-rose-500" />
                          <span>{exam.violations_count} violations</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock3 className="size-4 text-foreground/70" />
                          <span>{formatTimeRemaining(exam.time_remaining_seconds)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlarmClock className="size-4 text-foreground/70" />
                          <span>{exam.submissions_count} submissions</span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Tap to open monitoring</span>
                        <Link
                          href={`/quiz/${exam.id}?tab=monitoring`}
                          className="rounded-full border border-transparent bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition-all duration-150 hover:bg-primary/15 active:scale-[0.96]"
                        >
                          Open Monitoring
                        </Link>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <div className="dashboard-fade-up" style={{ animationDelay: "240ms" }}>
          <div className="rounded-3xl border bg-card/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Recent quizzes</h2>
                <p className="text-sm text-muted-foreground">Recently updated quiz workspaces.</p>
              </div>
              <Link
                href="/quizzes"
                className="text-xs font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
              >
                View all
              </Link>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={`quiz-skeleton-${index}`} className="rounded-2xl border bg-background/80 p-4">
                    <div className="skeleton h-4 w-36" />
                    <div className="mt-3 skeleton h-3 w-28" />
                    <div className="mt-4 skeleton h-8 w-full" />
                  </div>
                ))
              ) : recentQuizzes.length === 0 ? (
                <div className="rounded-2xl border bg-background/70 p-6 text-center text-sm text-muted-foreground md:col-span-2">
                  No recent quizzes yet. Create a quiz to get started.
                </div>
              ) : (
                recentQuizzes.slice(0, 6).map((quiz) => {
                  const statusLabel = quiz.is_published
                    ? "Published"
                    : quiz.ai_generation_status === "PROCESSING" || quiz.ai_generation_status === "REVIEWING"
                    ? "Reviewing"
                    : "Draft"

                  return (
                    <div
                      key={quiz.id}
                      role="link"
                      tabIndex={0}
                      onClick={(event) => {
                        const target = event.target as HTMLElement | null
                        if (target?.closest("a")) return
                        router.push(`/quiz/${quiz.id}`)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") router.push(`/quiz/${quiz.id}`)
                      }}
                      className={cn(
                        "group relative rounded-2xl border bg-background/80 p-4 transition-all duration-150 focus-visible:outline-none",
                        "hover:-translate-y-1 hover:scale-[1.02] hover:border-primary/30 hover:bg-muted/40 hover:shadow-md hover:brightness-[1.01] active:scale-[0.99]",
                        "focus-visible:ring-2 focus-visible:ring-ring/70"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <Link
                            href={`/quiz/${quiz.id}`}
                            className="text-sm font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-none"
                          >
                            {quiz.title}
                          </Link>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {quiz.description || "No description added yet."}
                          </p>
                        </div>
                        <DashboardBadge label={statusLabel} />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <FileText className="size-4 text-foreground/70" />
                          <span>{quiz.question_count} questions</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock3 className="size-4 text-foreground/70" />
                          <span>{formatDuration(quiz.duration_minutes)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock3 className="size-4 text-foreground/70" />
                          <span>Updated {formatUpdatedAt(quiz.updated_at)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Sparkles className="size-4 text-foreground/70" />
                          <span>{quiz.ai_generation_status.toLowerCase()}</span>
                        </div>
                      </div>

                      <div className="pointer-events-none absolute inset-x-4 bottom-4 flex translate-y-1.5 items-center gap-2 opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
                        <div className="flex flex-1 items-center justify-between rounded-full border bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm">
                          <span className="font-semibold text-foreground">Quick actions</span>
                          <div className="flex items-center gap-3">
                            <Link href={`/quiz/${quiz.id}`} className="pointer-events-auto font-medium text-foreground/70 transition-colors hover:text-foreground">Edit</Link>
                            <Link href={`/quiz/${quiz.id}?tab=monitoring`} className="pointer-events-auto font-medium text-foreground/70 transition-colors hover:text-foreground">Monitoring</Link>
                            <Link href={`/quiz/${quiz.id}?tab=results`} className="pointer-events-auto font-medium text-foreground/70 transition-colors hover:text-foreground">Results</Link>
                            <Link href={`/quiz/${quiz.id}?tab=settings`} className="pointer-events-auto font-medium text-foreground/70 transition-colors hover:text-foreground">Settings</Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={cn("grid gap-6", showJobsPanel ? "lg:grid-cols-[1.4fr,1fr]" : "lg:grid-cols-1")}>
        <div className="dashboard-fade-up" style={{ animationDelay: "300ms" }}>
          <div className="rounded-3xl border bg-card/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Score trend</h2>
                <p className="text-sm text-muted-foreground">Average performance across recent quizzes.</p>
              </div>
              <Link
                href="/analytics"
                className="text-xs font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
              >
                Open analytics
              </Link>
            </div>

            <div className="mt-4 h-64">
              {analyticsLoading ? (
                <div className="skeleton h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics?.score_distribution ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="quiz_name" tickLine={false} axisLine={false} hide />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <RechartsTooltip content={<ChartTooltip />} cursor={{ stroke: "hsl(var(--muted-foreground))" }} />
                    <Line
                      type="monotone"
                      dataKey="average_score"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={3}
                      dot={{ r: 3, stroke: "hsl(var(--chart-1))", strokeWidth: 2, fill: "hsl(var(--background))" }}
                      activeDot={{ r: 5 }}
                      isAnimationActive
                      animationDuration={300}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {showJobsPanel ? (
          <div className="dashboard-fade-up" style={{ animationDelay: "360ms" }}>
            <div className="rounded-3xl border bg-card/90 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">AI activity</h2>
                  <p className="text-sm text-muted-foreground">Generation tasks running now.</p>
                </div>
                <Sparkles className="size-4 text-muted-foreground" />
              </div>

              <div className="mt-4 space-y-4">
                {runningJobs.slice(0, 3).map((job) => {
                  const normalized = job.progress <= 1 ? job.progress * 100 : job.progress
                  const progress = Math.min(100, Math.max(0, normalized))
                  return (
                    <div key={job.id} className="rounded-2xl border bg-background/80 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{job.quiz_title}</p>
                          <p className="text-xs text-muted-foreground">{job.stage}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="h-2 w-2 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
                          {Math.round(progress)}%
                        </div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Estimated time left: {Math.max(0, Math.round(job.estimated_seconds / 60))} min
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="dashboard-fade-up" style={{ animationDelay: "420ms" }}>
        <div className="rounded-3xl border bg-card/90 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Quick actions</h2>
              <p className="text-sm text-muted-foreground">Jump back into core workflows.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Import quiz", href: "/quizzes", icon: BookOpen },
              { label: "Active monitoring", href: "/monitoring", icon: Activity },
              { label: "Result exports", href: "/results", icon: Clock3 },
            ].map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-2xl border bg-background/80 px-4 py-3 text-sm font-medium transition-all duration-150",
                    "hover:-translate-y-1 hover:scale-[1.02] hover:border-primary/30 hover:bg-muted/50 hover:shadow-md hover:brightness-[1.02] active:scale-[0.96]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                  )}
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted/70 text-foreground group-hover:bg-muted">
                    <Icon className="size-4" />
                  </span>
                  {action.label}
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <div className="dashboard-fade-up" style={{ animationDelay: "480ms" }}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-2 rounded-full border bg-background px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Active
          </span>
          <span className="flex items-center gap-2 rounded-full border bg-background px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            Published
          </span>
          <span className="flex items-center gap-2 rounded-full border bg-background px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-violet-500" />
            Reviewing
          </span>
          <span className="flex items-center gap-2 rounded-full border bg-background px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            Draft
          </span>
          <span className="flex items-center gap-2 rounded-full border bg-background px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Violation alert
          </span>
        </div>
      </div>
    </div>
  )
}
