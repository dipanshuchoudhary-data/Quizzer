"use client"

import { useMemo } from "react"
import type { Section } from "@/types/section"
import type { Question } from "@/types/question"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export function SectionSidebar({
  sections,
  questions,
  active,
  reviewFilter,
  onChange,
  onFilterChange,
  onSelectFiltered,
  onClearSelection,
  onApproveFilteredPending,
  approvingFilteredPending,
}: {
  sections: Section[]
  questions: Question[]
  active: string | null
  reviewFilter: "all" | "pending" | "missing_answer"
  onChange: (id: string | null) => void
  onFilterChange: (filter: "all" | "pending" | "missing_answer") => void
  onSelectFiltered: () => void
  onClearSelection: () => void
  onApproveFilteredPending: () => void
  approvingFilteredPending: boolean
}) {
  const isMissingAnswer = (question: Question) =>
    !question.correct_answer || question.correct_answer.trim().length === 0 || question.correct_answer === "answer_unavailable"

  const sectionScopedQuestions = active ? questions.filter((question) => question.section_id === active) : questions
  const visibleQuestions =
    reviewFilter === "pending"
      ? sectionScopedQuestions.filter((question) => question.status !== "APPROVED")
      : reviewFilter === "missing_answer"
        ? sectionScopedQuestions.filter((question) => isMissingAnswer(question))
        : sectionScopedQuestions

  const approvedCount = questions.filter((question) => question.status === "APPROVED").length
  const pendingCount = questions.length - approvedCount
  const missingAnswerCount = questions.filter((question) => isMissingAnswer(question)).length
  const visiblePendingCount = visibleQuestions.filter((question) => question.status !== "APPROVED").length
  const sectionStats = useMemo(() => {
    const stats = new Map<string, { total: number; approved: number; issues: number }>()
    for (const section of sections) {
      stats.set(section.id, { total: 0, approved: 0, issues: 0 })
    }
    for (const question of questions) {
      const current = stats.get(question.section_id)
      if (!current) continue
      current.total += 1
      if (question.status === "APPROVED") current.approved += 1
      if (isMissingAnswer(question)) current.issues += 1
    }
    return stats
  }, [sections, questions])

  return (
    <aside className="w-72 border-r bg-muted/20">
      <ScrollArea className="h-full p-3">
        <div className="space-y-3">
          <div className="rounded-md border bg-background p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Review Health</p>
            <div className="mt-2 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Approved</span>
                <Badge className="bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
                  {approvedCount}/{questions.length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pending</span>
                <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">{pendingCount}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Missing answer</span>
                <Badge className="bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200">{missingAnswerCount}</Badge>
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-background p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick Filters</p>
            <div className="mt-2 space-y-1">
              <button
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm",
                  reviewFilter === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
                onClick={() => onFilterChange("all")}
              >
                All questions
              </button>
              <button
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm",
                  reviewFilter === "pending" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
                onClick={() => onFilterChange("pending")}
              >
                Pending approval
              </button>
              <button
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm",
                  reviewFilter === "missing_answer" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
                onClick={() => onFilterChange("missing_answer")}
              >
                Missing answer
              </button>
            </div>
          </div>

          <div className="rounded-md border bg-background p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick Actions</p>
            <div className="mt-2 space-y-2">
              <Button size="sm" variant="outline" className="w-full justify-start" onClick={onSelectFiltered}>
                Select visible ({visibleQuestions.length})
              </Button>
              <Button size="sm" variant="outline" className="w-full justify-start" onClick={onClearSelection}>
                Clear selection
              </Button>
              <Button
                size="sm"
                className="w-full justify-start"
                onClick={onApproveFilteredPending}
                disabled={visiblePendingCount === 0 || approvingFilteredPending}
              >
                {approvingFilteredPending ? "Approving..." : `Approve visible pending (${visiblePendingCount})`}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Sections</p>
        </div>
        <button
          className={cn(
            "mb-2 mt-2 w-full rounded-md border px-3 py-2 text-left text-sm",
            active === null ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
          )}
          onClick={() => onChange(null)}
        >
          All sections
        </button>
        <div className="space-y-2">
          {sections.map((section, idx) => (
            <div
              key={section.id}
              className={cn(
                "rounded-md border p-2",
                active === section.id ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/40"
              )}
            >
              <button onClick={() => onChange(section.id)} className="w-full text-left">
                <p className="text-sm font-medium">
                  {idx + 1}. {section.title}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{sectionStats.get(section.id)?.approved ?? 0}/{sectionStats.get(section.id)?.total ?? 0} approved</span>
                  <span>{sectionStats.get(section.id)?.issues ?? 0} issues</span>
                </div>
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  )
}
