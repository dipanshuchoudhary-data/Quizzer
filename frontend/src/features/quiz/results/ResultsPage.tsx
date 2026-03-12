"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { resultsApi } from "@/lib/api/results"
import { ResultsFilters } from "@/features/quiz/results/ResultsFilters"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/common/StatusBadge"

function ScoreTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { student_name?: string; final_score: number; violation_count: number } }> }) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 4 }}
        transition={{ duration: 0.12, ease: "easeOut" }}
        className="rounded-xl border border-slate-500/40 bg-slate-950/95 px-3 py-2 text-sm text-slate-50 shadow-xl"
      >
        <p className="font-semibold">Student: {point.student_name ?? "-"}</p>
        <p>Score: {point.final_score}</p>
        <p>Violations: {point.violation_count}</p>
      </motion.div>
    </AnimatePresence>
  )
}

function formatLocalDate(date?: string | null) {
  if (!date) return "-"
  return new Date(date).toLocaleString()
}

export function ResultsPage({ quizId }: { quizId: string }) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("ALL")
  const [activeExport, setActiveExport] = useState<{ taskId: string; format: "csv" | "excel" } | null>(null)
  const pollTimerRef = useRef<number | null>(null)
  const { data: results = [] } = useQuery({
    queryKey: ["results", quizId],
    queryFn: () => resultsApi.getResults(quizId),
  })

  const filtered = useMemo(() => {
    return results.filter((result) => {
      const statusMatch = status === "ALL" || result.status === status
      const text = `${result.student_name ?? ""} ${result.enrollment_number ?? ""} ${result.attempt_token ?? ""}`.toLowerCase()
      return statusMatch && text.includes(search.toLowerCase())
    })
  }, [results, search, status])

  const exportMutation = useMutation({
    mutationFn: (format: "csv" | "excel") => resultsApi.exportResults(quizId, format),
    onSuccess: (response, format) => {
      setActiveExport({ taskId: response.task_id, format })
      toast.success(`${format === "csv" ? "CSV" : "Excel"} export started`)
    },
    onError: () => toast.error("Export failed"),
  })

  useEffect(() => {
    if (!activeExport) return

    const poll = async () => {
      try {
        const exportStatus = await resultsApi.getExportStatus(activeExport.taskId)
        if (exportStatus.status === "SUCCESS") {
          if (!exportStatus.download_url || !exportStatus.file_name) {
            toast.error("Export finished but no file was generated")
            setActiveExport(null)
            return
          }
          await resultsApi.downloadExport(exportStatus.download_url, exportStatus.file_name)
          toast.success(`${activeExport.format === "csv" ? "CSV" : "Excel"} download started`)
          setActiveExport(null)
          return
        }

        if (exportStatus.status === "FAILURE") {
          toast.error(exportStatus.detail || "Export failed")
          setActiveExport(null)
        }
      } catch {
        toast.error("Failed to check export status")
        setActiveExport(null)
      }
    }

    void poll()
    pollTimerRef.current = window.setInterval(() => {
      void poll()
    }, 2000)

    return () => {
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [activeExport])

  return (
    <div className="space-y-4">
      <ResultsFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        exportBusy={exportMutation.isPending || activeExport !== null}
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
              <CartesianGrid stroke="rgba(148, 163, 184, 0.2)" vertical={false} />
              <XAxis dataKey="student_name" tick={{ fill: "#cbd5e1", fontSize: 12 }} axisLine={{ stroke: "#64748b" }} tickLine={{ stroke: "#64748b" }} />
              <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} axisLine={{ stroke: "#64748b" }} tickLine={{ stroke: "#64748b" }} />
              <Tooltip content={<ScoreTooltip />} />
              <Line
                dataKey="final_score"
                type="monotone"
                stroke="#38bdf8"
                strokeWidth={2.5}
                isAnimationActive
                animationDuration={300}
                animationEasing="ease-out"
                dot={{ r: 3, fill: "#38bdf8", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#7dd3fc", stroke: "#e0f2fe", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-7 gap-3 rounded-md border bg-muted/30 p-2 text-xs font-medium uppercase text-muted-foreground">
            <span>Student</span>
            <span>Enrollment</span>
            <span>Score</span>
            <span>Violations</span>
            <span>Integrity</span>
            <span>Submitted</span>
            <span>Status</span>
          </div>
          {filtered.map((result, index) => (
            <div key={`${result.attempt_token ?? index}`} className="grid grid-cols-7 gap-3 rounded-md border p-2 text-sm">
              <span>
                <span className="block font-medium">{result.student_name ?? "-"}</span>
              </span>
              <span>{result.enrollment_number ?? "-"}</span>
              <span>{result.final_score}</span>
              <span className="font-medium">{result.violation_count}</span>
              <span className={result.violation_count > 5 ? "text-red-500" : result.integrity_flag ? "text-orange-500" : "text-emerald-500"}>
                {result.violation_count > 5 ? "High Violation" : result.integrity_flag ? "Flagged" : "Clean"}
              </span>
              <span>{formatLocalDate(result.submitted_at)}</span>
              <StatusBadge status={result.status} />
            </div>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">No results available for current filters.</p>}
        </CardContent>
      </Card>
    </div>
  )
}
