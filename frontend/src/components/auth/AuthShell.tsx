"use client"

import Link from "next/link"
import { ReactNode } from "react"
import { CheckCircle2, Sparkles } from "lucide-react"
import { Brand } from "@/components/branding/brand"

interface AuthShellProps {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}

const proofPoints = [
  "Build quizzes from notes in minutes",
  "Monitor live attempts with confidence",
  "Review results in one calm workspace",
]

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(34,197,94,0.16),transparent_28%),radial-gradient(circle_at_88%_12%,rgba(56,189,248,0.12),transparent_30%),linear-gradient(135deg,#ffffff_0%,#f8fafc_48%,#eef2f6_100%)] dark:bg-[radial-gradient(circle_at_14%_18%,rgba(74,222,128,0.14),transparent_28%),radial-gradient(circle_at_88%_12%,rgba(56,189,248,0.1),transparent_30%),linear-gradient(135deg,#0b0f14_0%,#11161c_52%,#161c23_100%)]" />
      <div className="absolute -left-24 top-24 h-72 w-72 rounded-full border border-[var(--brand-accent)]/20" />
      <div className="absolute bottom-[-8rem] right-[-6rem] h-96 w-96 rounded-full bg-[var(--brand-accent)]/10 blur-3xl" />

      <div className="relative grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden min-h-screen flex-col justify-between px-10 py-10 lg:flex xl:px-16">
          <Link href="/" className="flex w-fit items-center gap-3 text-sm font-semibold tracking-[0.24em] text-foreground">
            <Brand
              className="gap-3"
              logoClassName="h-10 w-10 rounded-xl shadow-[0_18px_45px_rgba(34,197,94,0.25)]"
              titleClassName="text-sm font-semibold tracking-[0.24em] uppercase text-foreground"
              compact
            />
          </Link>

          <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-[var(--brand-accent)]" />
              Smart assessments for focused classrooms
            </div>
            <h1 className="text-balance text-6xl font-black leading-[0.92] tracking-[-0.06em] text-foreground xl:text-7xl">
              Turn every lesson into a sharper quiz.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">
              A polished workspace for educators to create, publish, monitor, and grade assessments without the usual admin drag.
            </p>
          </div>

          <div className="grid max-w-2xl gap-3">
            {proofPoints.map((point, index) => (
              <div
                key={point}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card/70 px-4 py-3 text-sm font-semibold text-foreground shadow-sm backdrop-blur animate-in fade-in slide-in-from-left-3 duration-700"
                style={{ animationDelay: `${index * 110}ms` }}
              >
                <CheckCircle2 className="h-5 w-5 text-[var(--brand-accent)]" />
                {point}
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-[31rem] animate-in fade-in zoom-in-95 duration-500">
            <div className="mb-8 flex items-center justify-center lg:hidden">
              <Link href="/" className="flex items-center gap-3 text-sm font-semibold tracking-[0.22em] text-foreground">
                <Brand
                  className="gap-3"
                  logoClassName="h-10 w-10 rounded-xl"
                  titleClassName="text-sm font-semibold tracking-[0.22em] uppercase text-foreground"
                  compact
                />
              </Link>
            </div>

            <div className="rounded-[2rem] border border-border bg-card/90 p-5 shadow-[0_28px_90px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:shadow-[0_28px_90px_rgba(0,0,0,0.35)] sm:p-8">
              <div className="mb-7">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[var(--brand-accent)]">{eyebrow}</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-foreground sm:text-4xl">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
              </div>

              {children}
            </div>

            <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
          </div>
        </section>
      </div>
    </main>
  )
}
