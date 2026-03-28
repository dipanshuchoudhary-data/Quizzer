"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { CalendarRange, Filter, GraduationCap, ShieldAlert, SlidersHorizontal, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { KpiCard, PageHeader, SectionHeader, StatusPill, pageCardClass } from "@/components/page/page-system"
import { Skeleton } from "@/components/ui/skeleton"
import { dashboardApi } from "@/lib/api/dashboard"
import { cn } from "@/lib/utils"

type SortKey = "quiz_name" | "attempts" | "average_score" | "completion_rate" | "violations"
type SortDirection = "asc" | "desc"
type DistributionMode = "overall" | "quiz"

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10)
}

function getDefaultDateRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 29)
  return {
    date_from: formatDateInput(start),
    date_to: formatDateInput(end),
  }
}

function formatMetric(value: number, kind: "number" | "percent" | "score") {
  if (kind === "percent") return `${value}%`
  if (kind === "score") return value.toFixed(1)
  return Intl.NumberFormat("en-US").format(value)
}

function getDeltaTone(direction: "up" | "down" | "flat", favorableWhenUp: boolean) {
  if (direction === "flat") return "text-slate-500 dark:text-[var(--text-muted)]"
  const positive = direction === "up"
  return positive === favorableWhenUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
}

function getScoreTone(score: number) {
  if (score >= 75) return "text-emerald-700 dark:text-emerald-400"
  if (score >= 50) return "text-amber-700 dark:text-amber-400"
  return "text-rose-700 dark:text-rose-400"
}

function getCompletionTone(rate: number) {
  if (rate >= 80) return "text-emerald-700 dark:text-emerald-400"
  if (rate >= 60) return "text-amber-700 dark:text-amber-400"
  return "text-rose-700 dark:text-rose-400"
}

function getViolationTone(violations: number) {
  if (violations === 0) return "text-emerald-700 dark:text-emerald-400"
  if (violations <= 3) return "text-amber-700 dark:text-amber-400"
  return "text-rose-700 dark:text-rose-400"
}

function getDistributionFill(mode: DistributionMode, entry: Record<string, string | number>) {
  if (mode === "overall") return "rgba(14,165,233,0.82)"
  const averageScore = Number(entry.average_score ?? 0)
  if (averageScore >= 70) return "rgba(34,197,94,0.82)"
  if (averageScore >= 50) return "rgba(245,158,11,0.82)"
  return "rgba(244,63,94,0.82)"
}

const chartGridStroke = "rgba(148,163,184,0.22)"
const chartCursorFill = "rgba(148,163,184,0.08)"
const chartTooltipStyle = {
  borderRadius: 18,
  border: "1px solid var(--border-color)",
  background: "var(--card-bg)",
  color: "var(--text-primary)",
  boxShadow: "0 20px 60px -35px rgba(15,23,42,0.45)",
}
const chartTick = { fill: "var(--text-secondary)", fontSize: 12 }

export default function AnalyticsPage() {
  const defaultRange = useMemo(() => getDefaultDateRange(), [])
  const [filters, setFilters] = useState({
    ...defaultRange,
    quiz: "all",
    status: "all",
  })
  const [sortKey, setSortKey] = useState<SortKey>("attempts")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [distributionMode, setDistributionMode] = useState<DistributionMode>("overall")

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-analytics", filters],
    queryFn: () => dashboardApi.getAnalytics(filters),
    staleTime: 45_000,
  })

  const metrics = useMemo(() => {
    if (!data) return []
    return [
      {
        key: "total_attempts",
        label: "Total Attempts",
        value: data.metrics.total_attempts,
        delta: data.metric_deltas.total_attempts,
        icon: GraduationCap,
        kind: "number" as const,
        favorableWhenUp: true,
      },
      {
        key: "completion_rate",
        label: "Completion Rate",
        value: data.metrics.completion_rate,
        delta: data.metric_deltas.completion_rate,
        icon: Sparkles,
        kind: "percent" as const,
        favorableWhenUp: true,
      },
      {
        key: "average_score",
        label: "Average Score",
        value: data.metrics.average_score,
        delta: data.metric_deltas.average_score,
        icon: CalendarRange,
        kind: "score" as const,
        favorableWhenUp: true,
      },
      {
        key: "total_violations",
        label: "Integrity Flags",
        value: data.metrics.total_violations,
        delta: data.metric_deltas.total_violations,
        icon: ShieldAlert,
        kind: "number" as const,
        favorableWhenUp: false,
      },
      {
        key: "active_quizzes",
        label: "Active Quiz Groups",
        value: data.metrics.active_quizzes,
        delta: null,
        icon: Filter,
        kind: "number" as const,
        favorableWhenUp: true,
      },
    ]
  }, [data])

  const sortedTable = useMemo(() => {
    const rows = [...(data?.table ?? [])]
    rows.sort((left, right) => {
      const a = left[sortKey]
      const b = right[sortKey]
      const comparison =
        typeof a === "string" && typeof b === "string"
          ? a.localeCompare(b)
          : Number(a) - Number(b)
      return sortDirection === "asc" ? comparison : -comparison
    })
    return rows
  }, [data?.table, sortDirection, sortKey])

  const scoreChartData: Array<Record<string, string | number>> =
    distributionMode === "overall"
      ? (data?.score_distribution.overall ?? []).map((entry) => ({ ...entry }))
      : (data?.score_distribution.by_quiz ?? []).map((entry) => ({ ...entry }))

  const hasAnalytics = Boolean(data && data.table.length > 0)
  const anomalies = useMemo(() => {
    if (!data) return []
    const items: Array<{ label: string; tone: "error" | "warning" | "info" }> = []
    if (data.metric_deltas.total_violations?.direction === "up" && data.metric_deltas.total_violations.delta > 0) {
      items.push({ label: "Integrity flags increased in the selected period.", tone: "error" })
    }
    if (data.metric_deltas.completion_rate?.direction === "down") {
      items.push({ label: "Completion rate is trending down and needs attention.", tone: "warning" })
    }
    if (data.metric_deltas.average_score?.direction === "down") {
      items.push({ label: "Average scores are softening across recent attempts.", tone: "warning" })
    }
    if (items.length === 0 && data.table.length > 0) {
      items.push({ label: "No major anomalies detected in the current filtered range.", tone: "info" })
    }
    return items
  }, [data])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
      return
    }
    setSortKey(key)
    setSortDirection(key === "quiz_name" ? "asc" : "desc")
  }

  const resetFilters = () => {
    setFilters({
      ...defaultRange,
      quiz: "all",
      status: "all",
    })
  }

  return (
    <div className="space-y-8 pb-8">
      <PageHeader
        eyebrow="Analytics"
        title="Insight-driven performance"
        subtitle="Explore scoring patterns, completion behavior, and integrity issues from a single analytics surface built for fast decision-making."
        actions={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700 dark:text-[var(--text-primary)]">From</span>
              <Input type="date" value={filters.date_from} onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700 dark:text-[var(--text-primary)]">To</span>
              <Input type="date" value={filters.date_to} onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700 dark:text-[var(--text-primary)]">Quiz Group</span>
              <select
                value={filters.quiz}
                onChange={(event) => setFilters((current) => ({ ...current, quiz: event.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)] dark:text-[var(--text-primary)] dark:focus-visible:ring-[var(--brand-accent)]"
              >
                <option value="all">All quizzes</option>
                {data?.filters.quizzes.map((quiz) => (
                  <option key={quiz.value} value={quiz.value}>
                    {quiz.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700 dark:text-[var(--text-primary)]">Status</span>
              <select
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)] dark:text-[var(--text-primary)] dark:focus-visible:ring-[var(--brand-accent)]"
              >
                <option value="all">All attempts</option>
                {data?.filters.statuses
                  .filter((item) => item.value !== "all")
                  .map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                ))}
              </select>
            </label>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={resetFilters}>
            <SlidersHorizontal className="size-4" />
            Reset filters
          </Button>
          <div className="rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white dark:border dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)] dark:text-[var(--text-primary)]">
            {filters.date_from} to {filters.date_to}
          </div>
          {filters.quiz !== "all" ? (
            <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-[var(--brand-accent-soft)] dark:text-[var(--brand-accent)] dark:shadow-[0_0_20px_rgba(74,222,128,0.15)]">Filtered by quiz group</div>
          ) : null}
          {filters.status !== "all" ? (
            <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-[rgba(250,204,21,0.12)] dark:text-[var(--warning)]">Status: {filters.status.replace("_", " ")}</div>
          ) : null}
        </div>
      </PageHeader>

      <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, index) => (
              <Card key={index} className="border-slate-200/80 shadow-sm dark:border-[var(--border-color)] dark:bg-[var(--card-bg)]">
                <CardContent className="space-y-4 p-5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-28" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))
          : metrics.map((metric, index) => {
              const Icon = metric.icon
              const deltaTone = metric.delta ? getDeltaTone(metric.delta.direction, metric.favorableWhenUp) : "text-slate-500"
              return (
                <motion.div
                  key={metric.key}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: index * 0.05 }}
                >
                  <KpiCard
                    title={metric.label}
                    value={formatMetric(metric.value, metric.kind)}
                    trend={metric.delta ? `${metric.delta.delta > 0 ? "+" : ""}${metric.delta.delta}` : "Stable"}
                    trendContext={metric.delta?.context ?? "Distinct quiz groups in the filtered set"}
                    status={!metric.delta ? "neutral" : deltaTone.includes("emerald") ? "positive" : deltaTone.includes("rose") ? "negative" : "neutral"}
                    icon={Icon}
                  />
                </motion.div>
              )
            })}
      </section>

      {!isLoading && hasAnalytics ? (
        <section className="space-y-4">
          <SectionHeader title="AI Insights" description="Summarized signals and anomaly highlights across the filtered set." icon={Sparkles} />
          <div className="grid gap-4 xl:grid-cols-3">
            {anomalies.map((item) => (
              <div key={item.label} className={cn(pageCardClass, "p-4")}>
                <StatusPill tone={item.tone} label={item.tone === "error" ? "Anomaly" : item.tone === "warning" ? "Watch" : "Stable"} />
                <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-[var(--text-secondary)]">{item.label}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!isLoading && hasAnalytics && data?.insights.length ? (
        <section className="grid gap-4 xl:grid-cols-3">
          {data.insights.map((insight) => (
            <div key={insight} className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4 shadow-sm dark:border-[var(--border-color)] dark:bg-[var(--card-bg)] dark:shadow-[0_0_20px_rgba(74,222,128,0.08)]">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-emerald-600/10 p-2 text-emerald-700 dark:bg-[var(--brand-accent-soft)] dark:text-[var(--brand-accent)]">
                  <Sparkles className="size-4" />
                </div>
                <p className="text-sm leading-6 text-emerald-950 dark:text-[var(--text-primary)]">{insight}</p>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {!isLoading && !hasAnalytics ? (
        <section className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50/60 px-6 py-14 text-center shadow-inner dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)]">
          <h2 className="text-2xl font-semibold text-slate-950 dark:text-[var(--text-primary)]">No analytics data available yet</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-[var(--text-secondary)]">
            Publish a quiz and collect student attempts to unlock score trends, integrity insights, and performance comparisons.
          </p>
          <div className="mt-6">
            <Link
              href="/quizzes/create"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Run your first quiz
            </Link>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 2xl:grid-cols-[1.25fr_1fr]">
        <Card className={pageCardClass}>
          <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg dark:text-[var(--text-primary)]">Score Distribution</CardTitle>
              <p className="mt-1 text-sm text-slate-500 dark:text-[var(--text-secondary)]">Switch between overall score buckets and quiz-group performance.</p>
            </div>
            <div className="inline-flex w-full flex-wrap rounded-full border border-slate-200 bg-slate-50 p-1 sm:w-auto dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)]">
              {(["overall", "quiz"] as DistributionMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDistributionMode(mode)}
                  className={cn(
                    "flex-1 rounded-full px-3 py-1.5 text-xs font-medium capitalize transition sm:flex-none",
                    distributionMode === mode
                      ? "bg-slate-950 text-white shadow-sm dark:border dark:border-[var(--border-color)] dark:bg-[var(--card-hover)] dark:text-[var(--text-primary)] dark:shadow-[0_0_20px_rgba(74,222,128,0.15)]"
                      : "text-slate-600 dark:text-[var(--text-secondary)]"
                  )}
                >
                  {mode === "overall" ? "Overall distribution" : "By quiz"}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[320px] w-full" />
            ) : (
              <div className="overflow-x-auto">
                <div className="h-[280px] min-w-[520px] sm:h-[320px] sm:min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scoreChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 4" stroke={chartGridStroke} vertical={false} />
                      <XAxis
                        dataKey={distributionMode === "overall" ? "range" : "quiz_name"}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={20}
                        interval="preserveStartEnd"
                        tick={chartTick}
                      />
                      <YAxis tickLine={false} axisLine={false} tick={chartTick} width={32} />
                      <RechartsTooltip
                        cursor={{ fill: chartCursorFill }}
                        contentStyle={chartTooltipStyle}
                      />
                      <Bar dataKey={distributionMode === "overall" ? "students" : "average_score"} radius={[10, 10, 0, 0]} animationDuration={420}>
                        {scoreChartData.map((entry, index) => (
                          <Cell key={`${distributionMode}-${index}`} fill={getDistributionFill(distributionMode, entry)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={pageCardClass}>
          <CardHeader>
            <CardTitle className="text-lg dark:text-[var(--text-primary)]">Completion Trend</CardTitle>
            <p className="mt-1 text-sm text-slate-500 dark:text-[var(--text-secondary)]">Track completion movement across the selected date range.</p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[320px] w-full" />
            ) : (
              <div className="overflow-x-auto">
                <div className="h-[280px] min-w-[520px] sm:h-[320px] sm:min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.completion_trend ?? []} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="completionArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(16,185,129,0.42)" />
                          <stop offset="100%" stopColor="rgba(16,185,129,0.04)" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke={chartGridStroke} vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} interval="preserveStartEnd" tick={chartTick} />
                      <YAxis tickLine={false} axisLine={false} domain={[0, 100]} tick={chartTick} width={32} />
                      <RechartsTooltip
                        formatter={(value, name) => [`${Number(value ?? 0)}${name === "completion_rate" ? "%" : ""}`, name === "completion_rate" ? "Completion rate" : "Attempts"]}
                        contentStyle={chartTooltipStyle}
                      />
                      <Area type="monotone" dataKey="completion_rate" stroke="rgb(5,150,105)" strokeWidth={3} fill="url(#completionArea)" animationDuration={420} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className={pageCardClass}>
          <CardHeader>
            <CardTitle className="text-lg dark:text-[var(--text-primary)]">Violations by Quiz</CardTitle>
            <p className="mt-1 text-sm text-slate-500 dark:text-[var(--text-secondary)]">Spot integrity hotspots before they become operational problems.</p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="overflow-x-auto">
                <div className="h-[280px] min-w-[560px] sm:h-[300px] sm:min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.violations_by_quiz ?? []} layout="vertical" margin={{ left: 20, right: 12 }}>
                      <CartesianGrid strokeDasharray="4 4" stroke={chartGridStroke} horizontal={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} tick={chartTick} />
                      <YAxis type="category" dataKey="quiz_name" tickLine={false} axisLine={false} width={140} tick={chartTick} />
                      <RechartsTooltip contentStyle={chartTooltipStyle} />
                      <Bar dataKey="violations" radius={[0, 10, 10, 0]} animationDuration={420}>
                        {(data?.violations_by_quiz ?? []).map((entry, index) => (
                          <Cell key={`violation-${index}`} fill={entry.violations > 3 ? "rgba(244,63,94,0.82)" : entry.violations > 0 ? "rgba(245,158,11,0.82)" : "rgba(34,197,94,0.82)"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={pageCardClass}>
          <CardHeader>
            <CardTitle className="text-lg dark:text-[var(--text-primary)]">Performance Table</CardTitle>
            <p className="mt-1 text-sm text-slate-500 dark:text-[var(--text-secondary)]">Sortable, deduped quiz-group view for deeper inspection.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <table className="min-w-[720px] border-separate border-spacing-y-2 text-sm sm:min-w-full">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">
                    {[
                      { key: "quiz_name", label: "Quiz Name" },
                      { key: "attempts", label: "Attempts" },
                      { key: "average_score", label: "Avg Score" },
                      { key: "completion_rate", label: "Completion Rate" },
                      { key: "violations", label: "Violations" },
                    ].map((column) => (
                      <th key={column.key} className="px-3 py-2 first:min-w-[220px]">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 transition hover:text-slate-900 dark:hover:text-[var(--text-primary)]"
                          onClick={() => toggleSort(column.key as SortKey)}
                        >
                          {column.label}
                          {sortKey === column.key ? <span>{sortDirection === "asc" ? "asc" : "desc"}</span> : null}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedTable.map((row, index) => (
                    <motion.tr
                      key={row.quiz_id}
                      layout
                      className={cn(
                        "rounded-2xl border border-slate-200/80 shadow-sm transition-colors dark:border-[var(--border-color)] dark:hover:bg-[var(--card-hover)]",
                        index % 2 === 0 ? "bg-white dark:bg-[var(--card-bg)]" : "bg-slate-50/70 dark:bg-[var(--bg-secondary)]"
                      )}
                    >
                      <td className="rounded-l-2xl px-3 py-3">
                        <Link href={`/quiz/${row.quiz_id}?tab=results`} className="line-clamp-2 min-w-0 font-medium text-slate-900 transition hover:text-emerald-700 dark:text-[var(--text-primary)] dark:hover:text-[var(--brand-accent)]">
                          {row.quiz_name}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-slate-700 dark:text-[var(--text-secondary)]">{row.attempts}</td>
                      <td className={cn("px-3 py-3 font-medium", getScoreTone(row.average_score))}>{row.average_score.toFixed(1)}</td>
                      <td className={cn("px-3 py-3 font-medium", getCompletionTone(row.completion_rate))}>{row.completion_rate}%</td>
                      <td className={cn("rounded-r-2xl px-3 py-3 font-medium", getViolationTone(row.violations))}>{row.violations}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
