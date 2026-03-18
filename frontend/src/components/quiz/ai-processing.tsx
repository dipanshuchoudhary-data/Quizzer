"use client"

import { cn } from "@/lib/utils"

const pipelineSteps = [
  { id: "parsing_source", label: "Content Parsing" },
  { id: "topic_detection", label: "Topic Detection" },
  { id: "question_generation", label: "Question Generation" },
  { id: "answer_generation", label: "Answer Generation" },
  { id: "difficulty_calibration", label: "Difficulty Calibration" },
]

export function AIProcessing({
  status,
  progress,
  stage,
  error,
}: {
  status: string
  progress: number
  stage?: string
  error?: string | null
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-background/80 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Processing status</p>
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{status}</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Progress: {Math.round(progress)}%</p>
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {pipelineSteps.map((step) => {
          const active = stage === step.id
          const done = pipelineSteps.findIndex((item) => item.id === stage) > pipelineSteps.findIndex((item) => item.id === step.id)
          return (
            <div
              key={step.id}
              className={cn(
                "rounded-2xl border bg-background/80 p-4 text-sm transition-all duration-150",
                active ? "border-primary/40 bg-primary/5" : done ? "border-emerald-400/40 bg-emerald-500/5" : "border-border"
              )}
            >
              <p className="font-semibold text-foreground">{step.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {active ? "In progress..." : done ? "Completed" : "Queued"}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
