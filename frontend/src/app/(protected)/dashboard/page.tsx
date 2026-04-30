"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Manrope } from "next/font/google"
import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react"
import { dashboardApi } from "@/lib/api/dashboard"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { KpiCard, PageHeader, SectionHeader, pageCardClass } from "@/components/page/page-system"
import { useAuthStore } from "@/stores/useAuthStore"
import { getDisplayName } from "@/lib/user"

const dashboardFont = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"] })

function isRecent(dateText?: string, days = 7) {
  if (!dateText) return false
  const parsed = new Date(dateText)
  if (Number.isNaN(parsed.getTime())) return false
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return parsed.getTime() >= cutoff
}

function formatDateLabel(dateText?: string) {
  if (!dateText) return "Updated recently"
  const parsed = new Date(dateText)
  if (Number.isNaN(parsed.getTime())) return "Updated recently"
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(parsed)
}

function statusTone(status: "Active" | "Completed" | "Draft") {
  if (status === "Active") return "bg-[var(--brand-accent-soft)] text-[var(--brand-accent)] border border-[var(--brand-accent)]/20"
  if (status === "Completed") return "bg-blue-500/10 text-blue-400 border border-blue-500/20"
  return "bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-color)]"
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const displayName = getDisplayName(user)

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

    return {
      total,
      published,
      activeAttempts,
      aiJobs,
      trends: {
        total: totalUpdatedThisWeek,
        published: publishedThisWeek,
      },
    }
  }, [summary])

  const activeExamsById = useMemo(() => {
    const map = new Map<string, { active_students: number; violations_count: number; time_remaining_seconds: number | null }>()
    ;(summary?.active_exams ?? []).forEach((exam) => {
      map.set(exam.id, {
        active_students: exam.active_students,
        violations_count: exam.violations_count,
        time_remaining_seconds: exam.time_remaining_seconds,
      })
    })
    return map
  }, [summary?.active_exams])

  const examCards = useMemo(() => {
    const cards = (summary?.recent_quizzes ?? []).map((quiz) => {
      const active = activeExamsById.get(quiz.id)
      const status = active && (active.time_remaining_seconds ?? 0) > 0 ? "Active" : quiz.is_published ? "Completed" : "Draft"
      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description || "No description provided yet.",
        status: status as "Active" | "Completed" | "Draft",
        updated_at: quiz.updated_at,
        duration: quiz.duration_minutes,
        question_count: quiz.question_count ?? 0,
        active_students: active?.active_students ?? 0,
        violations_count: active?.violations_count ?? 0,
      }
    })

    return cards.sort((a, b) => {
      const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0
      return dateB - dateA
    })
  }, [activeExamsById, summary?.recent_quizzes])

  const topAlert = useMemo(() => {
    const alerts = liveExamsData?.alerts ?? []
    if (alerts.length === 0) return null
    return alerts[0]
  }, [liveExamsData?.alerts])

  return (
    <div className={cn("space-y-8", dashboardFont.className)}>
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome back, ${displayName}.`}
        subtitle="Review status, handle priorities, and move directly to the next action."
      />

      <section className="grid gap-4 grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={`stat-skeleton-${index}`} className={cn(pageCardClass, "animate-pulse p-4")}>
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="mt-4 h-8 w-20 rounded bg-muted" />
              <div className="mt-2 h-3 w-28 rounded bg-muted" />
            </div>
          ))
        ) : (
          [
            {
              title: "Total Quizzes",
              value: snapshot.total,
              trend: snapshot.trends.total > 0 ? "Improving" : "Stable",
              trendContext: snapshot.trends.total > 0 ? `+${snapshot.trends.total} this week` : "No change this week",
              status: snapshot.trends.total > 0 ? "positive" : "neutral",
              icon: BookOpen,
            },
            {
              title: "Published Exams",
              value: snapshot.published,
              trend: snapshot.trends.published > 0 ? "Growing" : "Stable",
              trendContext: snapshot.trends.published > 0 ? `+${snapshot.trends.published} this week` : "No new publishes",
              status: snapshot.trends.published > 0 ? "positive" : "neutral",
              icon: CheckCircle2,
            },
            {
              title: "Active Attempts",
              value: snapshot.activeAttempts,
              trend: snapshot.activeAttempts > 0 ? "Live now" : "Idle",
              trendContext: snapshot.activeAttempts > 0 ? `${snapshot.activeAttempts} students active` : "No live attempts now",
              status: snapshot.activeAttempts > 0 ? "positive" : "neutral",
              icon: Users,
            },
            {
              title: "AI Jobs Running",
              value: snapshot.aiJobs,
              trend: snapshot.aiJobs > 0 ? "In progress" : "Idle",
              trendContext: snapshot.aiJobs > 0 ? `${snapshot.aiJobs} jobs running` : "No active jobs",
              status: snapshot.aiJobs > 0 ? "positive" : "neutral",
              icon: Sparkles,
            },
          ].map((item) => (
            <KpiCard
              key={item.title}
              title={item.title}
              value={item.value}
              trend={item.trend}
              trendContext={item.trendContext}
              status={item.status as "positive" | "neutral"}
              icon={item.icon}
            />
          ))
        )}
      </section>

      {/* 4-Column Dashboard Grid */}
      <section className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {/* Recent Exams */}
        <div className={cn(pageCardClass, "space-y-3 p-4")}>
          <div className="flex items-center justify-between gap-2">
            <SectionHeader title="Recent Exams" icon={BookOpen} />
            <Link href="/exams" className="text-xs text-muted-foreground hover:text-foreground transition">
              View all →
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : examCards.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center">
              <p className="text-xs text-muted-foreground">No exams yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {examCards.slice(0, 4).map((exam) => (
                <Link
                  key={exam.id}
                  href={`/quiz/${exam.id}`}
                  className="block rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-2 transition hover:bg-[var(--card-hover)] hover:border-[var(--brand-accent)]/40"
                >
                  <p className="truncate text-sm font-medium text-foreground">{exam.title}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className={cn("text-xs px-1.5 py-0.5 rounded", statusTone(exam.status))}>
                      {exam.status}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDateLabel(exam.updated_at)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Students */}
        <div className={cn(pageCardClass, "space-y-3 p-4")}>
          <div className="flex items-center justify-between gap-2">
            <SectionHeader title="Recent Students" icon={Users} />
            <Link href="/students" className="text-xs text-muted-foreground hover:text-foreground transition">
              View all →
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : (() => {
            const studentActivities = (summary?.recent_activity ?? []).filter(
              (activity) => /attempt|submission|started|progress|completed/i.test(activity.event)
            )
            return studentActivities.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center">
                <p className="text-sm font-medium text-foreground">No student attempts yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Share exams to see students taking them</p>
              </div>
            ) : (
              <div className="space-y-2">
                {studentActivities.slice(0, 4).map((activity, index) => (
                  <div key={index} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-2">
                    <p className="truncate text-sm font-medium text-foreground">{activity.title}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground capitalize">{activity.event}</span>
                      <span className="text-xs text-muted-foreground">{formatDateLabel(activity.updated_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

        {/* Quick Analysis */}
        <div className={cn(pageCardClass, "space-y-3 p-4")}>
          <div className="flex items-center justify-between gap-2">
            <SectionHeader title="Quick Analysis" icon={TrendingUp} />
            <Link href="/analytics" className="text-xs text-muted-foreground hover:text-foreground transition">
              View all →
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-8 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
                <p className="text-xs text-muted-foreground">Avg Score (Last 4)</p>
                <p className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                  {((summary?.recent_quizzes ?? []).slice(0, 4).reduce((sum, q) => sum + (q.question_count ?? 0), 0) / Math.max((summary?.recent_quizzes ?? []).slice(0, 4).length, 1)).toFixed(1)}%
                </p>
              </div>
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2">
                <p className="text-xs text-muted-foreground">Completion Rate</p>
                <p className="mt-1 text-lg font-semibold text-blue-600 dark:text-blue-400">
                  {snapshot.activeAttempts > 0 ? `${Math.round((snapshot.activeAttempts / Math.max(snapshot.total, 1)) * 100)}%` : "0%"}
                </p>
              </div>
              <Link
                href="/analytics"
                className="block rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-2 text-center transition hover:bg-[var(--card-hover)]"
              >
                <p className="text-xs font-medium text-foreground">View detailed →</p>
              </Link>
            </div>
          )}
        </div>

        {/* Live Attention */}
        <div className={cn(pageCardClass, "space-y-3 p-4")}>
          <SectionHeader title="Live Attention" icon={Activity} />
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : topAlert ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Alert</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{topAlert.quiz_name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{topAlert.message}</p>
                <Link
                  href={`/quiz/${topAlert.quiz_id}?tab=monitoring`}
                  className={cn(
                    buttonVariants({ size: "sm", variant: "outline" }),
                    "mt-2 h-7 w-full text-xs rounded-lg"
                  )}
                >
                  View
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground">All stable</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">No issues detected</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
