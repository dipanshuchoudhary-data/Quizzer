"use client"

import { useQuery } from "@tanstack/react-query"
import { monitoringApi } from "@/lib/api/monitoring"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/common/StatusBadge"

export function MonitoringPage({ quizId }: { quizId: string }) {
  const { data: attempts = [], isFetching } = useQuery({
    queryKey: ["monitoring", quizId],
    queryFn: () => monitoringApi.getAttempts(quizId),
    refetchInterval: 5_000,
  })

  const formatLocalDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : "-")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Realtime Attempts {isFetching ? "(refreshing)" : ""}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-5 gap-3 rounded-md border bg-muted/30 p-2 text-xs font-medium uppercase text-muted-foreground">
          <span>Student</span>
          <span>Status</span>
          <span>Submitted</span>
          <span>Violations</span>
          <span>Integrity</span>
        </div>
        {attempts.map((attempt) => (
          <div key={attempt.attempt_token} className="grid grid-cols-5 gap-3 rounded-md border p-2 text-sm">
            <span>
              <span className="block font-medium">{attempt.student_name ?? "-"}</span>
              <span className="block truncate text-xs text-muted-foreground">{attempt.enrollment_number ?? attempt.attempt_token}</span>
            </span>
            <StatusBadge status={attempt.status || "PENDING"} />
            <span>{formatLocalDate(attempt.submitted_at)}</span>
            <span>{attempt.violation_count ?? 0}</span>
            <span className={(attempt.violation_count ?? 0) > 5 ? "text-red-500" : attempt.integrity_flag ? "text-orange-500" : "text-emerald-600"}>
              {(attempt.violation_count ?? 0) > 5 ? "High Violation" : attempt.integrity_flag ? "Flagged" : "Clean"}
            </span>
          </div>
        ))}
        {attempts.length === 0 && <p className="text-sm text-muted-foreground">No active attempts for this quiz yet.</p>}
      </CardContent>
    </Card>
  )
}
