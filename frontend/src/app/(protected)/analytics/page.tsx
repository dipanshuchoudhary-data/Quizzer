"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { ResponsiveContainer, Line, LineChart, CartesianGrid, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { dashboardApi } from "@/lib/api/dashboard"

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-analytics"],
    queryFn: dashboardApi.getAnalytics,
    staleTime: 45_000,
  })

  const metrics = useMemo(
    () => [
      { label: "Total Attempts", value: data?.metrics.total_attempts ?? 0 },
      { label: "Completion Rate", value: `${data?.metrics.completion_rate ?? 0}%` },
      { label: "Average Score", value: data?.metrics.average_score ?? 0 },
      { label: "Total Violations", value: data?.metrics.total_violations ?? 0 },
    ],
    [data]
  )

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-border/70 bg-linear-to-br from-background via-background to-muted/35 px-5 py-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Analytics</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Cross-quiz performance overview</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Compare completion, scoring, and violations across quizzes from one place.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="border-border/70">
                <CardContent className="space-y-3 p-5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))
          : metrics.map((metric) => (
              <motion.div key={metric.label} whileHover={{ scale: 1.02, y: -2 }} transition={{ duration: 0.18, ease: "easeOut" }}>
                <Card className="border-border/70 transition-[transform,box-shadow,border-color] duration-180 ease-out hover:border-foreground/15 hover:shadow-xl hover:shadow-foreground/5">
                  <CardContent className="space-y-2 p-5">
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                    <p className="text-3xl font-semibold">{metric.value}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Score Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.score_distribution ?? []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="quiz_name" tickLine={false} axisLine={false} minTickGap={20} />
                  <YAxis tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: 16,
                      border: "1px solid rgba(148,163,184,0.2)",
                      background: "rgba(15,23,42,0.96)",
                    }}
                    itemStyle={{ color: "#e2e8f0" }}
                    labelStyle={{ color: "#f8fafc" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="average_score"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    isAnimationActive
                    animationDuration={300}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {!isLoading && data ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs text-muted-foreground">Highest score</p>
                <p className="mt-1 text-lg font-semibold">{data.metrics.highest_score}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs text-muted-foreground">Average score</p>
                <p className="mt-1 text-lg font-semibold">{data.metrics.average_score}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs text-muted-foreground">Lowest score</p>
                <p className="mt-1 text-lg font-semibold">{data.metrics.lowest_score}</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Quiz Performance Table</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : data?.table.length ? (
            <table className="min-w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Quiz Name</th>
                  <th className="px-3 py-2 font-medium">Attempts</th>
                  <th className="px-3 py-2 font-medium">Average Score</th>
                  <th className="px-3 py-2 font-medium">Completion Rate</th>
                  <th className="px-3 py-2 font-medium">Violations</th>
                </tr>
              </thead>
              <tbody>
                {data.table.map((row) => (
                  <tr key={row.quiz_id} className="border-t border-border/70 transition-colors duration-150 hover:bg-muted/30">
                    <td className="px-3 py-3">
                      <Link href={`/quiz/${row.quiz_id}?tab=results`} className="font-medium transition-colors duration-150 hover:text-primary">
                        {row.quiz_name}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{row.attempts}</td>
                    <td className="px-3 py-3">{row.average_score}</td>
                    <td className="px-3 py-3">{row.completion_rate}%</td>
                    <td className="px-3 py-3">{row.violations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
              Analytics will appear after students complete attempts.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
