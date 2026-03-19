"use client"

import type { ReactNode } from "react"
import { Activity, AlertTriangle, BarChart3, Calendar, CheckCircle2, FileText, Info, type LucideIcon } from "lucide-react"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

export const pageCardClass =
  "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 ease-in-out hover:shadow-md dark:border-[var(--border-color)] dark:bg-[var(--card-bg)]"

export const pageCardInteractiveClass = cn(
  pageCardClass,
  "hover:scale-[1.01] dark:hover:bg-[var(--card-hover)]"
)

export const pageMutedCardClass =
  "rounded-2xl border border-gray-200 bg-gray-50/70 p-5 shadow-sm transition-all duration-200 ease-in-out dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)]"

export const statusToneStyles = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-500/10 dark:text-emerald-400",
  warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-400/10 dark:text-amber-300",
  error: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-500/10 dark:text-rose-400",
  info: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-400/10 dark:text-sky-300",
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
        "animate-fade-in rounded-[32px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.12),_transparent_28%),linear-gradient(135deg,_rgba(255,255,255,1)_0%,_rgba(248,250,252,1)_58%,_rgba(241,245,249,1)_100%)] px-6 py-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] transition-all duration-200 ease-in-out dark:border-[var(--border-color)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(74,222,128,0.12),_transparent_28%),linear-gradient(135deg,_#0f172a_0%,_#111827_58%,_#0b1220_100%)] dark:shadow-[0_0_20px_rgba(74,222,128,0.08)] sm:px-7",
        className
      )}
    >
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl space-y-3">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700 dark:text-[var(--brand-accent)]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-[var(--text-primary)]">
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-[var(--text-secondary)]">{subtitle}</p>
        </div>
        {actions ? <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[280px]">{actions}</div> : null}
      </div>
      {children ? <div className="mt-6">{children}</div> : null}
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {Icon ? (
            <span className="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)] dark:text-[var(--text-secondary)]">
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
