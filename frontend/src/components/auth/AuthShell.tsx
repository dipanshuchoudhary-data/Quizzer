"use client"

import Link from "next/link"
import { ReactNode } from "react"
import { CheckCircle2, Sparkles } from "lucide-react"

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
    <main className="relative min-h-screen overflow-hidden bg-[#f5f2ea] text-[#18221b]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(36,89,67,0.18),transparent_28%),radial-gradient(circle_at_86%_12%,rgba(229,131,74,0.2),transparent_30%),linear-gradient(135deg,#f9f6ee_0%,#ece4d3_52%,#dfe9dd_100%)]" />
      <div className="absolute -left-24 top-24 h-72 w-72 rounded-full border border-[#214b3b]/15" />
      <div className="absolute bottom-[-8rem] right-[-6rem] h-96 w-96 rounded-full bg-[#214b3b]/10 blur-3xl" />

      <div className="relative grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden min-h-screen flex-col justify-between px-10 py-10 lg:flex xl:px-16">
          <Link href="/" className="flex w-fit items-center gap-3 text-sm font-semibold tracking-[0.24em] text-[#214b3b]">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#214b3b] text-lg font-black text-[#f8f3e8] shadow-[0_18px_45px_rgba(33,75,59,0.25)]">
              Q
            </span>
            QUIZZER
          </Link>

          <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#214b3b]/15 bg-white/35 px-4 py-2 text-sm font-medium text-[#355949] shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-[#d46b35]" />
              Smart assessments for focused classrooms
            </div>
            <h1 className="text-balance text-6xl font-black leading-[0.92] tracking-[-0.06em] text-[#17231c] xl:text-7xl">
              Turn every lesson into a sharper quiz.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#526256]">
              A polished workspace for educators to create, publish, monitor, and grade assessments without the usual admin drag.
            </p>
          </div>

          <div className="grid max-w-2xl gap-3">
            {proofPoints.map((point, index) => (
              <div
                key={point}
                className="flex items-center gap-3 rounded-2xl border border-white/50 bg-white/35 px-4 py-3 text-sm font-semibold text-[#26382d] shadow-sm backdrop-blur animate-in fade-in slide-in-from-left-3 duration-700"
                style={{ animationDelay: `${index * 110}ms` }}
              >
                <CheckCircle2 className="h-5 w-5 text-[#d46b35]" />
                {point}
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-[31rem] animate-in fade-in zoom-in-95 duration-500">
            <div className="mb-8 flex items-center justify-center lg:hidden">
              <Link href="/" className="flex items-center gap-3 text-sm font-semibold tracking-[0.22em] text-[#214b3b]">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#214b3b] text-lg font-black text-[#f8f3e8]">
                  Q
                </span>
                QUIZZER
              </Link>
            </div>

            <div className="rounded-[2rem] border border-white/70 bg-[#fffaf1]/85 p-5 shadow-[0_28px_90px_rgba(45,54,42,0.22)] backdrop-blur-xl sm:p-8">
              <div className="mb-7">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#d46b35]">{eyebrow}</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#17231c] sm:text-4xl">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-[#657268] sm:text-base">{description}</p>
              </div>

              {children}
            </div>

            <div className="mt-6 text-center text-sm text-[#5e6a61]">{footer}</div>
          </div>
        </section>
      </div>
    </main>
  )
}

