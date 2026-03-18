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
    <div className="min-h-screen space-y-6">
      <section className="rounded-3xl border bg-gradient-to-br from-background via-background to-muted/40 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-[240px] space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">AI Quiz Studio</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {steps.map((item) => {
              const active = item.id === step
              const completed = item.id < step
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-all",
                    active
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : completed
                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-600"
                      : "border-border bg-background text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                      active ? "bg-primary text-primary-foreground" : completed ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {item.id + 1}
                  </span>
                  {item.label}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <div className={cn("rounded-3xl border bg-card/90 p-6 shadow-sm", contentClassName)}>{children}</div>
    </div>
  )
}
