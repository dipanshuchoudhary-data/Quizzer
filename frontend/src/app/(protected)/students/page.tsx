"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Activity, GraduationCap, ListChecks, Users } from "lucide-react"
import { dashboardApi } from "@/lib/api/dashboard"
import { buttonVariants } from "@/components/ui/button"
import { KpiCard, PageHeader, SectionHeader, StatusPill, pageCardClass, pageMutedCardClass } from "@/components/page/page-system"
import { cn } from "@/lib/utils"

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export default function StudentsPage() {
  const { data: liveData, isLoading: isLoadingLive } = useQuery({
    queryKey: ["dashboard-live-exams"],
    queryFn: dashboardApi.getLiveExams,
    staleTime: 15_000,
  })

  const { data: summary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: dashboardApi.getSummary,
    staleTime: 30_000,
  })

  const studentRows = useMemo(() => {
    return (liveData?.items ?? [])
      .flatMap((exam) =>
        exam.students.map((student) => {
          const engagement = student.current_question >= 8 ? "High focus" : student.current_question >= 4 ? "In progress" : "Early stage"
          const performanceTone: "success" | "warning" | "error" = student.violations > 2 ? "error" : student.violations > 0 ? "warning" : "success"
          const performanceLabel = student.violations > 2 ? "At risk" : student.violations > 0 ? "Needs review" : "On track"
          return {
            id: student.attempt_id,
            name: student.student_name,
            examName: exam.quiz_name,
            currentQuestion: student.current_question,
            status: student.status,
            violations: student.violations,
            engagement,
            performanceTone,
            performanceLabel,
          }
        })
      )
      .sort((left, right) => right.currentQuestion - left.currentQuestion)
  }, [liveData])

  const recentSignals = useMemo(() => {
    return (summary?.recent_activity ?? []).slice(0, 4)
  }, [summary])

  const activeStudents = studentRows.length
  const flaggedStudents = studentRows.filter((student) => student.violations > 0).length
  const focusedStudents = studentRows.filter((student) => student.currentQuestion >= 5).length

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Students"
        title="Student activity and cohort signals"
        subtitle="Monitor active learners, identify risk quickly, and jump to the exam contexts that need review."
        actions={
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Link href="/exams" className={cn(buttonVariants({ variant: "outline" }))}>
              Monitor exams
            </Link>
            <Link href="/results" className={cn(buttonVariants())}>
              Open results
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Active Students" value={activeStudents} trend={activeStudents > 0 ? `+${activeStudents}` : "0"} trendContext="currently in live exams" status={activeStudents > 0 ? "positive" : "neutral"} icon={Users} />
        <KpiCard title="Flagged Activity" value={flaggedStudents} trend={flaggedStudents > 0 ? `+${flaggedStudents}` : "0"} trendContext="students with integrity flags" status={flaggedStudents > 0 ? "negative" : "positive"} icon={Activity} />
        <KpiCard title="Focused Learners" value={focusedStudents} trend={focusedStudents > 0 ? `${Math.round((focusedStudents / Math.max(activeStudents, 1)) * 100)}%` : "0%"} trendContext="progressed beyond question 5" status={focusedStudents > 0 ? "positive" : "neutral"} icon={GraduationCap} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className={pageCardClass}>
          <SectionHeader title="Operational Snapshot" description="Live learner view with activity, exam context, and performance tags." icon={Users} />
          {isLoadingLive || isLoadingSummary ? (
            <div className="mt-6 space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="skeleton h-16 w-full" />
              ))}
            </div>
          ) : studentRows.length === 0 ? (
            <div className={cn(pageMutedCardClass, "mt-6 text-center")}>
              <p className="text-base font-semibold text-slate-900 dark:text-[var(--text-primary)]">No live student activity yet</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-[var(--text-secondary)]">Start an exam to populate learner activity, engagement indicators, and performance tags.</p>
              <div className="mt-4">
                <Link href="/exams" className={cn(buttonVariants())}>
                  Run your first exam
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Exam</th>
                    <th className="px-3 py-2">Activity</th>
                    <th className="px-3 py-2">Violations</th>
                    <th className="px-3 py-2">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {studentRows.map((student, index) => (
                    <tr
                      key={student.id}
                      className={cn(
                        "rounded-2xl border border-slate-200/80 shadow-sm transition-all duration-200 ease-in-out hover:scale-[1.01] hover:shadow-md dark:border-[var(--border-color)] dark:hover:bg-[var(--card-hover)]",
                        index % 2 === 0 ? "bg-white dark:bg-[var(--card-bg)]" : "bg-slate-50/70 dark:bg-[var(--bg-secondary)]"
                      )}
                    >
                      <td className="rounded-l-2xl px-3 py-3">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex size-10 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-primary)]">
                            {getInitials(student.name)}
                          </span>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-[var(--text-primary)]">{student.name}</p>
                            <p className="text-xs text-slate-500 dark:text-[var(--text-secondary)]">{student.status}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-700 dark:text-[var(--text-secondary)]">{student.examName}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-900 dark:text-[var(--text-primary)]">Q{student.currentQuestion}</span>
                          <StatusPill tone="info" label={student.engagement} className="px-2.5 py-1" />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-700 dark:text-[var(--text-secondary)]">{student.violations}</td>
                      <td className="rounded-r-2xl px-3 py-3">
                        <StatusPill tone={student.performanceTone} label={student.performanceLabel} className="px-2.5 py-1" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className={pageCardClass}>
            <SectionHeader title="Quick Actions" description="Jump to the next student-related workflow." icon={ListChecks} />
            <div className="mt-5 space-y-3">
              <Link href="/exams" className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start")}>
                Open live monitoring
              </Link>
              <Link href="/results" className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start")}>
                Review exam results
              </Link>
              <Link href="/analytics" className={cn(buttonVariants(), "w-full justify-start")}>
                Open analytics
              </Link>
            </div>
          </div>

          <div className={pageCardClass}>
            <SectionHeader title="Insights" description="Recent platform signals tied to learner activity." icon={Activity} />
            <div className="mt-5 space-y-3">
              {recentSignals.length === 0 ? (
                <div className={pageMutedCardClass}>
                  <p className="text-sm text-slate-500 dark:text-[var(--text-secondary)]">No recent activity signals yet.</p>
                </div>
              ) : (
                recentSignals.map((signal) => (
                  <div key={signal.id} className={pageMutedCardClass}>
                    <p className="text-sm font-medium text-slate-900 dark:text-[var(--text-primary)]">{signal.title}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-[var(--text-secondary)]">{signal.event}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  )
}
