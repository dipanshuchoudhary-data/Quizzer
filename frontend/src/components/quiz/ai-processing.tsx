"use client"

import { cn } from "@/lib/utils"

const pipelineSteps = [
  { id: "parsing_source", label: "Content Parsing", hint: "Extract and clean source material" },
  { id: "topic_detection", label: "Topic Detection", hint: "Detect key concepts and coverage" },
  { id: "question_generation", label: "Question Generation", hint: "Draft questions from source intent" },
  { id: "answer_generation", label: "Answer Generation", hint: "Generate answer keys and distractors" },
  { id: "difficulty_calibration", label: "Difficulty Calibration", hint: "Balance complexity and marks" },
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
  const normalizedProgress = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0))
  const stageIndex = pipelineSteps.findIndex((item) => item.id === stage)
  const activeIndex = stageIndex >= 0 ? stageIndex : 0
  const isProcessing = status === "PROCESSING"
  const isCompleted = status === "COMPLETED"
  const isFailed = status === "FAILED"
  const doneBoundary = isCompleted ? pipelineSteps.length - 1 : activeIndex - 1

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-background/80 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Processing status</p>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              isCompleted
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                : isFailed
                ? "bg-destructive/15 text-destructive"
                : isProcessing
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {status}
          </span>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full bg-gradient-to-r from-primary via-cyan-400 to-emerald-500 transition-all duration-500")}
            style={{ width: `${normalizedProgress}%` }}
          />
          {isProcessing ? <div className="pipeline-progress-scanner -mt-2.5 h-2.5 w-24" /> : null}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Progress: {Math.round(normalizedProgress)}%</p>
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      </div>

      <div className="space-y-3">
        {pipelineSteps.map((step, index) => {
          const done = index <= doneBoundary
          const active = !isCompleted && !isFailed && index === activeIndex

          const connectorDone = index < doneBoundary
          const connectorFlow = isProcessing && index === doneBoundary

          return (
            <div key={step.id} className="relative">
              <div
                className={cn(
                  "rounded-2xl border bg-background/80 p-4 text-sm shadow-sm transition-all duration-300",
                  active
                    ? "border-primary/45 bg-primary/[0.06]"
                    : done
                    ? "border-emerald-400/45 bg-emerald-500/[0.06]"
                    : "border-border"
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-all",
                      active
                        ? "pipeline-node-active border-primary/50 bg-primary text-primary-foreground"
                        : done
                        ? "border-emerald-500/50 bg-emerald-500 text-white"
                        : "border-border bg-muted text-muted-foreground"
                    )}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-foreground">{step.label}</p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          active
                            ? "bg-primary/15 text-primary"
                            : done
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {active ? "Streaming..." : done ? "Completed" : "Queued"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{step.hint}</p>
                  </div>
                </div>
              </div>

              {index < pipelineSteps.length - 1 ? (
                <div className="px-3 py-1">
                  <div
                    className={cn(
                      "h-2 rounded-full bg-muted",
                      connectorDone ? "bg-emerald-500/35" : "",
                      connectorFlow ? "pipeline-flow bg-transparent" : ""
                    )}
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
