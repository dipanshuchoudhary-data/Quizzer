"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts"
import { resultsApi } from "@/lib/api/results"
import { ResultsFilters } from "@/features/quiz/results/ResultsFilters"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/common/StatusBadge"

export function ResultsPage({ quizId }: { quizId: string }) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("ALL")
  const { data: results = [] } = useQuery({
    queryKey: ["results", quizId],
    queryFn: () => resultsApi.getResults(quizId),
  })

  const filtered = useMemo(() => {
    return results.filter((result) => {
      const statusMatch = status === "ALL" || result.status === status
      const text = `${result.student_name ?? ""} ${result.attempt_token ?? ""}`.toLowerCase()
      return statusMatch && text.includes(search.toLowerCase())
    })
  }, [results, search, status])

  const exportMutation = useMutation({
    mutationFn: (format: "csv" | "excel") => resultsApi.exportResults(quizId, format),
    onSuccess: () => toast.success("Export started"),
    onError: () => toast.error("Export failed"),
  })

  return (
    <div className="space-y-4">
      <ResultsFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        onExportCsv={() => exportMutation.mutate("csv")}
        onExportExcel={() => exportMutation.mutate("excel")}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={filtered}>
              <XAxis dataKey="student_name" hide />
              <YAxis />
              <Tooltip />
              <Line dataKey="final_score" type="monotone" stroke="currentColor" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-5 gap-3 rounded-md border bg-muted/30 p-2 text-xs font-medium uppercase text-muted-foreground">
            <span>Student</span>
            <span>Score</span>
            <span>Violations</span>
            <span>Integrity</span>
            <span>Status</span>
          </div>
          {filtered.map((result, index) => (
            <div key={`${result.attempt_token ?? index}`} className="grid grid-cols-5 gap-3 rounded-md border p-2 text-sm">
              <span>{result.student_name ?? "-"}</span>
              <span>{result.final_score}</span>
              <span>{result.violation_count}</span>
              <span>{result.integrity_flag ? "Flagged" : "Clean"}</span>
              <StatusBadge status={result.status} />
            </div>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">No results available for current filters.</p>}
        </CardContent>
      </Card>
    </div>
  )
}

