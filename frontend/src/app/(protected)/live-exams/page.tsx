"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { AlertTriangle, MonitorPlay } from "lucide-react"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { dashboardApi } from "@/lib/api/dashboard"

function formatRemaining(seconds?: number | null) {
  if (seconds == null) return "Waiting"
  const safe = Math.max(0, seconds)
  return `${Math.floor(safe / 60)}m ${safe % 60}s`
}

function SkeletonRows() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="border-border/70">
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function LiveExamsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-live-exams"],
    queryFn: dashboardApi.getLiveExams,
    staleTime: 5_000,
    refetchInterval: 5_000,
  })

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-border/70 bg-linear-to-br from-background via-background to-muted/35 px-5 py-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Live Exams</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Real-time monitoring overview</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Monitor active students, track violations, and jump directly into the quiz monitoring workspace.
        </p>
      </section>

      {data?.alerts?.length ? (
        <div className="space-y-3">
          {data.alerts.map((alert, index) => (
            <motion.div
              key={`${alert.quiz_id}-${index}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut", delay: index * 0.05 }}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                alert.severity === "critical"
                  ? "border-red-500/30 bg-red-500/10 text-red-100"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-100"
              }`}
            >
              <AlertTriangle className="size-4 shrink-0" />
              <p className="text-sm">
                <span className="font-semibold">{alert.quiz_name}:</span> {alert.message}
              </p>
            </motion.div>
          ))}
        </div>
      ) : null}

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Live Exam Cards</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonRows />
          ) : data?.items.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {data.items.map((exam) => (
                <motion.div key={exam.quiz_id} whileHover={{ scale: 1.02, y: -2 }} transition={{ duration: 0.18, ease: "easeOut" }}>
                  <Card
                    className={`border-border/70 transition-[transform,box-shadow,border-color] duration-180 ease-out hover:shadow-xl hover:shadow-foreground/5 ${
                      exam.violations_count > 0 ? "border-amber-500/40" : "hover:border-foreground/15"
                    }`}
                  >
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold">{exam.quiz_name}</p>
                          <div className="mt-2">
                            <StatusBadge status={exam.active_students > 0 ? "ACTIVE" : "PUBLISHED"} />
                          </div>
                        </div>
                        <Link href={`/quiz/${exam.quiz_id}?tab=monitoring`} className="text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground">
                          Open Monitoring
                        </Link>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
                          <p className="text-xs text-muted-foreground">Students active</p>
                          <p className="mt-1 text-lg font-semibold">{exam.active_students}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
                          <p className="text-xs text-muted-foreground">Violations</p>
                          <p className="mt-1 text-lg font-semibold">{exam.violations_count}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
                          <p className="text-xs text-muted-foreground">Submissions</p>
                          <p className="mt-1 text-lg font-semibold">{exam.submissions_count}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
                          <p className="text-xs text-muted-foreground">Remaining</p>
                          <p className="mt-1 text-lg font-semibold">{formatRemaining(exam.time_remaining_seconds)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center">
              <MonitorPlay className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-lg font-semibold">No live exams</p>
              <p className="mt-2 text-sm text-muted-foreground">Published exams with active students will appear here automatically.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Student Activity Table</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : data?.items.some((exam) => exam.students.length > 0) ? (
            <table className="min-w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Student Name</th>
                  <th className="px-3 py-2 font-medium">Current Question</th>
                  <th className="px-3 py-2 font-medium">Violations</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Time Remaining</th>
                </tr>
              </thead>
              <tbody>
                {data.items.flatMap((exam) =>
                  exam.students.map((student) => (
                    <tr key={student.attempt_id} className="border-t border-border/70 transition-colors duration-150 hover:bg-muted/30">
                      <td className="px-3 py-3">{student.student_name}</td>
                      <td className="px-3 py-3">{student.current_question}</td>
                      <td className="px-3 py-3">{student.violations}</td>
                      <td className="px-3 py-3">
                        <StatusBadge status={student.status} />
                      </td>
                      <td className="px-3 py-3">{formatRemaining(student.time_remaining_seconds)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
              No student activity is currently streaming.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
