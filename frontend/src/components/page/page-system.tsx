"use client"

import type { ReactNode } from "react"
import { Activity, AlertTriangle, BarChart3, Calendar, CheckCircle2, FileText, Info, type LucideIcon } from "lucide-react"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

export const pageCardClass =
  "rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 ease-in-out hover:shadow-md"

export const pageCardInteractiveClass = cn(
  pageCardClass,
  "hover:scale-[1.01] dark:hover:bg-[var(--card-hover)]"
)

export const pageMutedCardClass =
  "surface-gradient-muted rounded-2xl border border-border p-5 shadow-sm transition-all duration-200 ease-in-out"

export const statusToneStyles = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-500/10 dark:text-emerald-400",
  warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-400/10 dark:text-amber-300",
  error: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-500/10 dark:text-rose-400",
  info: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-400/10 dark:text-orange-300",
  neutral: "border-slate-200 bg-slate-50 text-slate-700 dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)] dark:text-[var(--text-secondary)]",
} as const

const statusIcons: Record<keyof typeof statusToneStyles, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertTriangle,
  info: Info,
  neutral: Activity,
}

type PageHeaderProps = {
  eyebrow?: string
  title: string
  subtitle: string
  actions?: ReactNode
  children?: ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, subtitle, actions, children, className }: PageHeaderProps) {
  return (
    <section
      className={cn(
        "surface-gradient-soft relative overflow-hidden animate-fade-in ui-gentle-float rounded-[32px] border border-border/80 px-6 py-8 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.1)] backdrop-blur-xl transition-all duration-300 ease-in-out sm:px-8 sm:py-10",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -left-20 -top-20 -z-10 size-72 animate-pulse rounded-full opacity-70 blur-[80px]"
        style={{ backgroundColor: "color-mix(in srgb, var(--brand-accent) 18%, transparent)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-20 -right-20 -z-10 size-72 animate-pulse rounded-full opacity-70 blur-[80px]"
        style={{ animationDelay: "1.5s", backgroundColor: "color-mix(in srgb, var(--brand-warm) 24%, transparent)" }}
      />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 blur-[100px]" />

      <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl space-y-3">
          {eyebrow ? (
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--brand-accent)]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl dark:from-white dark:to-slate-300">
            {title}
          </h1>
          <p className="max-w-3xl text-[15px] leading-relaxed text-slate-600 dark:text-[var(--text-secondary)]">
            {subtitle}
          </p>
        </div>
        {actions ? <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[280px]">{actions}</div> : null}
      </div>
      {children ? <div className="relative z-10 mt-6">{children}</div> : null}
    </section>
  )
}

export function SectionHeader({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className="accent-divider-bar flex flex-col gap-3 pt-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {Icon ? (
            <span className="surface-gradient-muted inline-flex size-9 items-center justify-center rounded-full border border-border text-slate-700 dark:text-[var(--text-secondary)]">
              <Icon className="size-4" />
            </span>
          ) : null}
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-[var(--text-primary)]">{title}</h2>
        </div>
        {description ? <p className="text-sm text-slate-500 dark:text-[var(--text-secondary)]">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function StatusPill({
  tone,
  label,
  icon,
  className,
}: {
  tone: keyof typeof statusToneStyles
  label: string
  icon?: LucideIcon
  className?: string
}) {
  const Icon = icon ?? statusIcons[tone]
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold", statusToneStyles[tone], className)}>
      <Icon className="size-3.5" />
      {label}
    </span>
  )
}

export function KpiCard({
  title,
  value,
  trend,
  trendContext,
  status,
  icon: Icon,
  className,
}: {
  title: string
  value: ReactNode
  trend?: string
  trendContext?: string
  status?: "positive" | "negative" | "neutral"
  icon?: LucideIcon
  className?: string
}) {
  const trendTone =
    status === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : status === "negative"
      ? "text-rose-600 dark:text-rose-400"
      : "text-slate-500 dark:text-[var(--text-muted)]"
  const TrendIcon = status === "positive" ? ArrowUpRight : status === "negative" ? ArrowDownRight : Minus

  return (
    <div className={cn(pageCardInteractiveClass, "space-y-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-600 dark:text-[var(--text-secondary)]">{title}</p>
        {Icon ? (
          <span className="inline-flex size-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)] dark:text-[var(--text-secondary)]">
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <div className="space-y-2">
        <p className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-[var(--text-primary)]">{value}</p>
        {trend ? (
          <div className={cn("flex items-center gap-1.5 text-sm font-medium", trendTone)}>
            <TrendIcon className="size-4" />
            <span>{trend}</span>
            {trendContext ? <span className="text-slate-500 dark:text-[var(--text-muted)]">{trendContext}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export const pageIcons = {
  active: Activity,
  scheduled: Calendar,
  issues: AlertTriangle,
  analytics: BarChart3,
  exams: FileText,
}
