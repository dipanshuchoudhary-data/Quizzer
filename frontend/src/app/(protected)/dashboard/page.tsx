"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Manrope } from "next/font/google"
import { Activity, BookOpen, Clock3, Flame, Rocket, Sparkles, Users } from "lucide-react"
import { dashboardApi } from "@/lib/api/dashboard"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/stores/useAuthStore"
import { getDisplayName } from "@/lib/user"

const dashboardFont = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"] })

const statusStyles: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  Published: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
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

export default function DashboardPage() {
  const { user } = useAuthStore()
  const router = useRouter()

  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: dashboardApi.getSummary,
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

  const displayName = getDisplayName(user)
  const activeExams = summary?.active_exams ?? []

  return (
    <div className={cn("space-y-8", dashboardFont.className)}>
      <section
        className="dashboard-fade-up rounded-3xl bg-gradient-to-br from-background via-background to-muted/40 p-6 shadow-sm"
        style={{ animationDelay: "0ms" }}
      >
        <div className="min-w-[240px]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Professor Dashboard</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Welcome back, {displayName}.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage exams, monitor students, and track performance.
          </p>
        </div>
      </section>

      <section className="dashboard-fade-up" style={{ animationDelay: "60ms" }}>
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
                href: "/exams",
              },
              {
                label: "Published Exams",
                value: publishedDisplay,
                icon: Rocket,
                hint: "Live & scheduled",
                href: "/exams",
              },
              {
                label: "Active Attempts",
                value: activeAttemptsDisplay,
                icon: Activity,
                hint: "Students in-session",
                href: "/exams",
              },
              {
                label: "AI Jobs Running",
                value: aiJobsDisplay,
                icon: Sparkles,
                hint: "Generation pipelines",
                href: "/exams#ai-jobs",
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

      <section className="dashboard-fade-up" style={{ animationDelay: "120ms" }}>
        <div className="rounded-3xl border bg-card/90 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Active exams</h2>
              <p className="text-sm text-muted-foreground">Live sessions requiring attention.</p>
            </div>
            <Link
              href="/exams"
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
                        <p className="text-xs text-muted-foreground">{exam.active_students} active students</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasAlert ? <DashboardBadge label="Alert" /> : null}
                        <DashboardBadge label={statusLabel} pulse={statusLabel === "Active"} />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
                      <div className="flex items-center gap-2">
                        <Users className="size-4 text-foreground/70" />
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
      </section>
    </div>
  )
}
