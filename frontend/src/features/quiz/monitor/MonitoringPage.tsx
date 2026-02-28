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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Realtime Attempts {isFetching ? "(refreshing)" : ""}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-4 gap-3 rounded-md border bg-muted/30 p-2 text-xs font-medium uppercase text-muted-foreground">
          <span>Token</span>
          <span>Status</span>
          <span>Submitted</span>
          <span>Integrity</span>
        </div>
        {attempts.map((attempt) => (
          <div key={attempt.attempt_token} className="grid grid-cols-4 gap-3 rounded-md border p-2 text-sm">
            <span className="truncate">{attempt.attempt_token}</span>
            <StatusBadge status={attempt.status || "PENDING"} />
            <span>{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "-"}</span>
            <span className={attempt.integrity_flag ? "text-destructive" : "text-emerald-600"}>
              {attempt.integrity_flag ? "Flagged" : "Clean"}
            </span>
          </div>
        ))}
        {attempts.length === 0 && <p className="text-sm text-muted-foreground">No active attempts for this quiz yet.</p>}
      </CardContent>
    </Card>
  )
}

