"use client"

import Link from "next/link"
import { BookOpenCheck, Clock3, ShieldCheck } from "lucide-react"
import { useAuthStore } from "@/stores/useAuthStore"
import { buttonVariants } from "@/components/ui/button"
import { PageHeader, pageCardClass, SectionHeader, StatusPill } from "@/components/page/page-system"
import { cn } from "@/lib/utils"
import { getDisplayName } from "@/lib/user"

const quickLinks = [
  {
    title: "Start your next assessment",
    description: "Use your teacher-provided quiz link to enter a scheduled exam.",
    icon: BookOpenCheck,
  },
  {
    title: "Stay exam ready",
    description: "Keep your device permissions, browser state, and timing settings ready before you begin.",
    icon: Clock3,
  },
  {
    title: "Protected assessment flow",
    description: "Quizzer keeps your sign-in and exam activity connected to a verified session.",
    icon: ShieldCheck,
  },
]

export default function StudentDashboardPage() {
  const user = useAuthStore((state) => state.user)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Student Workspace"
        title={`Welcome, ${getDisplayName(user)}.`}
        subtitle="You are signed in as a student. Use assessment links from your instructor to begin quizzes and exams."
        actions={
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <StatusPill tone="info" label="Student account active" />
            <Link href="/help" className={cn(buttonVariants({ variant: "outline" }))}>
              Help
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        {quickLinks.map((item) => {
          const Icon = item.icon
          return (
            <article key={item.title} className={cn(pageCardClass, "space-y-4")}>
              <span className="inline-flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)] dark:text-[var(--text-primary)]">
                <Icon className="size-5" />
              </span>
              <div className="space-y-2">
                <SectionHeader title={item.title} />
                <p className="text-sm leading-6 text-slate-600 dark:text-[var(--text-secondary)]">{item.description}</p>
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}
