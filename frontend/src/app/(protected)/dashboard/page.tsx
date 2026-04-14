"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Manrope } from "next/font/google"
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Rocket,
  Sparkles,
  Users,
} from "lucide-react"
import { dashboardApi } from "@/lib/api/dashboard"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { KpiCard, PageHeader, SectionHeader, StatusPill, pageCardClass, pageIcons, statusToneStyles } from "@/components/page/page-system"
import { useAuthStore } from "@/stores/useAuthStore"
import { getDisplayName } from "@/lib/user"

const dashboardFont = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"] })

const statusStyles: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  Scheduled: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  Idle: "bg-muted text-foreground",
  Issues: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200",
}

function isRecent(dateText?: string, days = 7) {
  if (!dateText) return false
  const parsed = new Date(dateText)
  if (Number.isNaN(parsed.getTime())) return false
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return parsed.getTime() >= cutoff
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

type TrendDirection = "up" | "down" | "flat"

const ctaPrimaryClass =
  "!bg-slate-900 !text-white hover:!bg-slate-800 focus-visible:ring-2 focus-visible:ring-ring dark:!bg-slate-100 dark:!text-slate-950 dark:hover:!bg-white"
const ctaSecondaryClass =
  "!bg-muted !text-foreground border border-border hover:!bg-accent"
const ctaOutlineClass =
  "!bg-background !text-foreground border border-border hover:!bg-accent"

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

  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: dashboardApi.getSummary,
    staleTime: 30_000,
  })

  const { data: liveExamsData } = useQuery({
    queryKey: ["dashboard-live-exams"],
    queryFn: dashboardApi.getLiveExams,
    staleTime: 15_000,
  })

  const snapshot = useMemo(() => {
    const total = summary?.stats.total_quizzes ?? 0
    const published = summary?.stats.published_exams ?? 0
    const activeExams = summary?.active_exams ?? []
    const activeAttempts = activeExams.reduce((acc, exam) => acc + exam.active_students, 0)
    const aiJobs = summary?.stats.ai_jobs_running ?? 0

    const totalUpdatedThisWeek = summary?.recent_quizzes.filter((quiz) => isRecent(quiz.updated_at)).length ?? 0
    const publishedThisWeek =
      summary?.recent_quizzes.filter((quiz) => quiz.is_published && isRecent(quiz.updated_at)).length ?? 0
    const attemptActivityThisWeek =
      summary?.recent_activity.filter((item) => isRecent(item.updated_at) && /attempt|submission|started/i.test(item.event)).length ??
      0
    const jobsThisWeek = summary?.running_jobs.filter((job) => isRecent(job.created_at)).length ?? 0

    return {
      total,
      published,
      activeAttempts,
      aiJobs,
      trends: {
        total: totalUpdatedThisWeek,
        published: publishedThisWeek,
        activeAttempts: attemptActivityThisWeek,
        aiJobs: jobsThisWeek,
      },
    }
  }, [summary])

  const totalDisplay = useCountUp(snapshot.total)
  const publishedDisplay = useCountUp(snapshot.published)
  const activeAttemptsDisplay = useCountUp(snapshot.activeAttempts)
  const aiJobsDisplay = useCountUp(snapshot.aiJobs)

  const displayName = getDisplayName(user)
  const activeExams = summary?.active_exams ?? []
  const draftQuiz = summary?.recent_quizzes.find((quiz) => !quiz.is_published && !quiz.is_archived)
  const publishedQuiz = summary?.recent_quizzes.find((quiz) => quiz.is_published && !quiz.is_archived)

  const todayOverview = useMemo(() => {
    const activeNow = activeExams.filter((exam) => (exam.time_remaining_seconds ?? 0) > 0)
    const endingSoonIds = new Set(
      activeNow.filter((exam) => exam.time_remaining_seconds != null && exam.time_remaining_seconds <= 30 * 60).map((exam) => exam.id)
    )
    const violationIds = new Set(activeExams.filter((exam) => exam.violations_count > 0).map((exam) => exam.id))
    const needsAttention = new Set([...endingSoonIds, ...violationIds]).size
    const scheduled = Math.max(snapshot.published - activeNow.length, 0)

    return {
      activeNow: activeNow.length,
      scheduled,
      needsAttention,
      endingSoon: endingSoonIds.size,
      withViolations: violationIds.size,
    }
  }, [activeExams, snapshot.published])

  const activeNowDisplay = useCountUp(todayOverview.activeNow, 450)
  const scheduledDisplay = useCountUp(todayOverview.scheduled, 450)
  const needsAttentionDisplay = useCountUp(todayOverview.needsAttention, 450)

  const alertCards = useMemo(() => {
    const alerts = [
      ...(liveExamsData?.alerts ?? []).map((alert) => ({
        message: `${alert.quiz_name}: ${alert.message}`,
        severity: alert.severity,
      })),
      ...(todayOverview.endingSoon > 0
        ? [{ message: `${todayOverview.endingSoon} exam${todayOverview.endingSoon > 1 ? "s" : ""} ending soon`, severity: "warning" }]
        : []),
      ...(todayOverview.withViolations > 0
        ? [{ message: `${todayOverview.withViolations} exam${todayOverview.withViolations > 1 ? "s" : ""} with violations`, severity: "critical" }]
        : []),
    ]

    const seen = new Set<string>()
    return alerts.filter((item) => {
      const key = `${item.severity}:${item.message}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [liveExamsData?.alerts, todayOverview.endingSoon, todayOverview.withViolations])

  const prioritizedExams = useMemo(() => {
    const withPriority = activeExams.map((exam) => {
      const isActive = (exam.time_remaining_seconds ?? 0) > 0
      const endingSoon = isActive && exam.time_remaining_seconds != null && exam.time_remaining_seconds <= 30 * 60
      const hasViolations = exam.violations_count > 0
      const rank = endingSoon ? 1 : hasViolations ? 2 : isActive ? 3 : 4
      const status = hasViolations ? "Issues" : isActive ? "Active" : "Scheduled"
      return { ...exam, isActive, endingSoon, hasViolations, rank, status }
    })

    return withPriority.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank
      const aTime = a.time_remaining_seconds ?? Number.POSITIVE_INFINITY
      const bTime = b.time_remaining_seconds ?? Number.POSITIVE_INFINITY
      return aTime - bTime
    })
  }, [activeExams])

  return (
    <div className={cn("space-y-8", dashboardFont.className)}>
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome back, ${displayName}.`}
        subtitle="Review status, handle priorities, and move directly to the next action."
        actions={
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Link href="/analytics" className={cn(buttonVariants({ variant: "outline" }), ctaOutlineClass)}>
              View analytics
            </Link>
            <Link href="/quizzes/create" className={cn(buttonVariants(), ctaPrimaryClass)}>
              Create quiz
            </Link>
          </div>
        }
      />

      <section className="dashboard-fade-up grid gap-4 lg:grid-cols-[1.35fr_1fr]" style={{ animationDelay: "40ms" }}>
        <div
          className={cn(
            `${pageCardClass} dashboard-fade-up`,
            todayOverview.needsAttention > 0
              ? "border-red-300 shadow-red-100/50 dark:border-red-800"
              : "border-green-200 dark:border-green-900"
          )}
          style={{ animationDelay: "220ms" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <SectionHeader title="Operational Snapshot" description="Live system status and priorities" icon={pageIcons.active} />
            </div>
            <StatusPill tone={todayOverview.needsAttention > 0 ? "error" : "success"} label={todayOverview.needsAttention > 0 ? "Attention needed" : "All systems stable"} />
          </div>

          {todayOverview.needsAttention > 0 ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 dark:border-red-800 dark:bg-red-900 dark:text-red-200">
              <AlertTriangle className="size-3.5" />
              {needsAttentionDisplay} issue{needsAttentionDisplay === 1 ? "" : "s"} detected
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className={cn("rounded-xl border px-3 py-3 transition-all duration-200 hover:scale-[1.02] hover:shadow-sm", statusToneStyles.info)}>
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-orange-800 dark:text-orange-200" />
                <span className="text-xs font-semibold uppercase tracking-wide text-orange-800 dark:text-orange-200">Active</span>
              </div>
              <p className="mt-1 text-xl font-bold text-foreground">{activeNowDisplay}</p>
            </div>

            <div className={cn("rounded-xl border px-3 py-3 transition-all duration-200 hover:scale-[1.02] hover:shadow-sm", statusToneStyles.warning)}>
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-yellow-800 dark:text-yellow-200" />
                <span className="text-xs font-semibold uppercase tracking-wide text-yellow-800 dark:text-yellow-200">Scheduled</span>
              </div>
              <p className="mt-1 text-xl font-bold text-foreground">{scheduledDisplay}</p>
            </div>

            <div
              className={cn(
                "rounded-xl border px-3 py-3 transition-all duration-200 hover:scale-[1.02] hover:shadow-sm",
                needsAttentionDisplay > 0
                  ? statusToneStyles.error
                  : statusToneStyles.success
              )}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className={cn(
                    "size-4",
                    needsAttentionDisplay > 0 ? "text-red-800 dark:text-red-200" : "text-green-800 dark:text-green-200"
                  )}
                />
                <span
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wide",
                    needsAttentionDisplay > 0 ? "text-red-800 dark:text-red-200" : "text-green-800 dark:text-green-200"
                  )}
                >
                  Issues
                </span>
              </div>
              <p className="mt-1 text-xl font-bold text-foreground">{needsAttentionDisplay}</p>
            </div>
          </div>
        </div>

        <div className={pageCardClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <SectionHeader title="Insights" description="Live alerts and anomaly signals" icon={AlertTriangle} />
            </div>
          </div>

          {alertCards.length === 0 ? (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-green-200 bg-green-100 px-3 py-3 text-sm font-semibold text-green-800 dark:border-green-800 dark:bg-green-900 dark:text-green-200">
              <CheckCircle2 className="size-4" />
              <span>No urgent alerts</span>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {alertCards.slice(0, 4).map((alert, index) => {
                const isCritical = String(alert.severity).toLowerCase() === "critical"
                return (
                  <div
                    key={`${alert.message}-${index}`}
                    className={cn(
                      "flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium",
                      isCritical
                        ? "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-900 dark:text-red-200"
                        : "border-yellow-200 bg-yellow-100 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                    )}
                  >
                    <AlertTriangle className="size-4" />
                    <span>{alert.message}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section className="dashboard-fade-up" style={{ animationDelay: "80ms" }}>
        <SectionHeader title="Quick Snapshot" description="Core metrics with directional context." icon={Sparkles} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={`stat-skeleton-${index}`} className={cn(pageCardClass, "p-4")}>
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
                trendDirection: (snapshot.trends.total > 0 ? "up" : "flat") as TrendDirection,
                trendContext: snapshot.trends.total > 0 ? `+${snapshot.trends.total} this week` : "No change this week",
                href: "/exams",
              },
              {
                label: "Published Exams",
                value: publishedDisplay,
                icon: Rocket,
                trendDirection: (snapshot.trends.published > 0 ? "up" : "flat") as TrendDirection,
                trendContext:
                  snapshot.trends.published > 0 ? `+${snapshot.trends.published} published this week` : "No new publishes this week",
                href: "/exams",
              },
              {
                label: "Active Attempts",
                value: activeAttemptsDisplay,
                icon: Activity,
                trendDirection: (snapshot.activeAttempts > 0 ? "up" : "down") as TrendDirection,
                trendContext:
                  snapshot.activeAttempts > 0
                    ? `${snapshot.activeAttempts} live now`
                    : snapshot.trends.activeAttempts > 0
                    ? `${snapshot.trends.activeAttempts} updates this week`
                    : "No live attempts now",
                href: "/exams",
              },
              {
                label: "AI Jobs Running",
                value: aiJobsDisplay,
                icon: Sparkles,
                trendDirection: (snapshot.aiJobs > 0 ? "up" : "flat") as TrendDirection,
                trendContext: snapshot.aiJobs > 0 ? `${snapshot.aiJobs} in progress` : "Idle right now",
                href: "/exams#ai-jobs",
              },
            ].map((stat, index) => {
              return (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className={cn("dashboard-fade-up block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70")}
                  style={{ animationDelay: `${120 + index * 60}ms` }}
                >
                  <KpiCard
                    title={stat.label}
                    value={stat.value}
                    trend={stat.trendDirection === "up" ? "Improving" : stat.trendDirection === "down" ? "Watch closely" : "Stable"}
                    trendContext={stat.trendContext}
                    status={stat.trendDirection === "up" ? "positive" : stat.trendDirection === "down" ? "negative" : "neutral"}
                    icon={stat.icon}
                  />
                </Link>
              )
            })
          )}
        </div>
      </section>

      <section className="dashboard-fade-up grid gap-4 xl:grid-cols-[1.6fr_1fr]" style={{ animationDelay: "120ms" }}>
        <div className={cn(pageCardClass, "p-6")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <SectionHeader title="Prioritized Exams" description="Ordered by urgency: ending soon, issues, active, then scheduled." icon={pageIcons.exams} />
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
                <div key={`exam-skeleton-${index}`} className="rounded-2xl border bg-background p-4">
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
            ) : prioritizedExams.length === 0 ? (
              <div className="rounded-2xl border bg-background p-6 text-center">
                <p className="text-sm text-muted-foreground">No active exams right now.</p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <Link href="/exams" className={cn(buttonVariants({ size: "sm", variant: "outline" }), ctaOutlineClass)}>
                    Schedule Exam
                  </Link>
                </div>
              </div>
            ) : (
              prioritizedExams.map((exam) => {
                return (
                  <div
                    key={exam.id}
                    className={cn(
                      "group rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                      exam.endingSoon
                        ? "border-yellow-200 bg-yellow-100 dark:border-yellow-800 dark:bg-yellow-900/40"
                        : exam.hasViolations
                        ? "border-red-200 bg-red-100 dark:border-red-800 dark:bg-red-900/40"
                        : exam.isActive
                        ? "border-green-200 bg-green-100 dark:border-green-800 dark:bg-green-900/40"
                        : "bg-background"
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <p className="font-semibold text-foreground">{exam.title}</p>
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <Users className="size-4 text-muted-foreground" />
                          <span>{exam.active_students} students</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DashboardBadge label={exam.status} pulse={exam.status === "Active"} />
                          {exam.endingSoon ? (
                            <Badge className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                              Ending Soon
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      <div className="min-w-[210px] space-y-2">
                        <div className="flex items-center justify-between text-sm text-foreground">
                          <span className="text-muted-foreground">
                            Time remaining
                          </span>
                          <span className="font-medium text-foreground">{formatTimeRemaining(exam.time_remaining_seconds)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-foreground">
                          <span className="text-muted-foreground">
                            Violations
                          </span>
                          <span className={cn("font-medium", exam.violations_count > 0 ? "text-rose-700 dark:text-rose-300" : "text-foreground")}>{exam.violations_count}</span>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Link href={`/quiz/${exam.id}?tab=monitoring`} className={cn(buttonVariants({ size: "sm" }), ctaPrimaryClass)}>
                            Monitor Live Exam
                          </Link>
                          <Link href={`/quiz/${exam.id}`} className={cn(buttonVariants({ size: "sm", variant: "outline" }), ctaOutlineClass)}>
                            View Details
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <aside className={cn(pageCardClass, "p-6")}>
          <div className="flex items-center justify-between">
            <div>
              <SectionHeader title="Quick Actions" description="High-frequency tasks." icon={Rocket} />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Link
              href={publishedQuiz ? `/quiz/${publishedQuiz.id}?tab=settings` : "/exams"}
              className={cn(buttonVariants({ variant: "secondary" }), ctaSecondaryClass, "w-full justify-start")}
            >
              <CalendarClock className="mr-2 size-4" />
              Schedule Exam
            </Link>
            <Link
              href={draftQuiz ? `/quiz/${draftQuiz.id}` : "/exams"}
              className={cn(buttonVariants({ variant: "outline" }), ctaOutlineClass, "w-full justify-start")}
            >
              Resume Draft
            </Link>
            <Link href="/quizzes/create" className={cn(buttonVariants({ variant: "outline" }), ctaOutlineClass, "w-full justify-start")}>Import Questions</Link>
          </div>
        </aside>
      </section>

      {!isLoading && summary && summary.stats.total_quizzes === 0 ? (
        <section className="dashboard-fade-up" style={{ animationDelay: "160ms" }}>
          <div className="rounded-3xl border bg-background p-10 text-center">
            <p className="text-base font-semibold text-foreground">No quizzes yet</p>
            <p className="mt-2 text-sm text-muted-foreground">Create your first quiz to start scheduling and monitoring exams.</p>
            <div className="mt-4 flex justify-center">
              <Link href="/exams" className={cn(buttonVariants({ variant: "outline" }), ctaOutlineClass)}>
                Schedule an exam
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
