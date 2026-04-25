"use client"

import { cn } from "@/lib/utils"

const steps = [
  { id: 0, label: "Metadata" },
  { id: 1, label: "Content Source" },
  { id: 2, label: "AI Options" },
  { id: 3, label: "Processing" },
  { id: 4, label: "Review" },
]

export function QuizCreationLayout({
  step,
  title,
  subtitle,
  children,
  contentClassName,
}: {
  step: number
  title: string
  subtitle?: string
  children: React.ReactNode
  contentClassName?: string
}) {
  return (
    <div className="min-h-screen space-y-5 sm:space-y-6">
      <section className="surface-gradient-soft rounded-3xl border p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">AI Quiz Studio</p>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl lg:text-3xl">{title}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          <div className="w-full">
            <div className="grid grid-cols-5 items-center gap-2 sm:gap-3">
              {steps.map((item, index) => {
                const active = item.id === step
                const completed = item.id < step
                return (
                  <div key={item.id} className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        "flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition-all sm:px-4",
                        active
                          ? "border-primary/50 bg-primary/10 text-primary"
                        : completed
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs",
                          active
                            ? "bg-primary text-primary-foreground"
                          : completed
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {item.id + 1}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
              {steps.slice(0, -1).map((item) => {
                const completed = item.id < step
                const flowing = item.id === step
                return (
                  <span
                    key={`connector-${item.id}`}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      completed ? "bg-primary/55" : flowing ? "pipeline-mini-flow bg-transparent" : "bg-border"
                    )}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <div className={cn("rounded-3xl border bg-card/90 p-4 shadow-sm sm:p-6", contentClassName)}>{children}</div>
    </div>
  )
}
