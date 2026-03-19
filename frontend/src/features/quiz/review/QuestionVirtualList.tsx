"use client"

import { useMemo, useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Question } from "@/types/question"
import { Section } from "@/types/section"
import { QuestionCard } from "@/features/quiz/review/QuestionCard"

export function QuestionVirtualList({
  questions,
  sections,
  onPatch,
  onApprove,
  onDelete,
  onRegenerate,
  approvingQuestionId,
  deletingQuestionId,
  regeneratingQuestionId,
}: {
  questions: Question[]
  sections: Section[]
  onPatch: (questionId: string, payload: Partial<Question>) => void
  onApprove: (questionId: string) => void
  onDelete: (questionId: string) => void
  onRegenerate: (questionId: string) => void
  approvingQuestionId?: string | null
  deletingQuestionId?: string | null
  regeneratingQuestionId?: string | null
}) {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const sectionById = useMemo(() => new Map(sections.map((section) => [section.id, section.title])), [sections])

  const grouped = useMemo(() => {
    const order = sections.map((section) => section.id)
    const bucket = new Map<string, Question[]>()
    for (const question of questions) {
      const list = bucket.get(question.section_id) ?? []
      list.push(question)
      bucket.set(question.section_id, list)
    }

    const seen = new Set<string>()
    const groups: Array<{ sectionId: string; title: string; items: Question[] }> = []
    for (const sectionId of order) {
      const items = bucket.get(sectionId)
      if (!items || items.length === 0) continue
      groups.push({
        sectionId,
        title: sectionById.get(sectionId) ?? "Untitled Section",
        items,
      })
      seen.add(sectionId)
    }

    for (const [sectionId, items] of bucket.entries()) {
      if (seen.has(sectionId)) continue
      groups.push({
        sectionId,
        title: sectionById.get(sectionId) ?? "Unassigned Section",
        items,
      })
    }

    return groups
  }, [questions, sections, sectionById])

  const useVirtual = questions.length > 20
  const virtualizer = useVirtualizer({
    count: questions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 520,
    overscan: 4,
  })
  const virtualItems = useVirtual ? virtualizer.getVirtualItems() : []

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scroll-smooth md:px-6 md:py-6">
      {useVirtual ? (
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
          {virtualItems.map((virtualRow) => {
            const question = questions[virtualRow.index]
            return (
              <div
                key={question.id}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                className="absolute left-0 top-0 w-full pb-6"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <QuestionCard
                  question={question}
                  sections={sections}
                  onPatch={onPatch}
                  onApprove={(questionId) => onApprove(questionId)}
                  onDelete={(questionId) => onDelete(questionId)}
                  onRegenerate={(questionId) => onRegenerate(questionId)}
                  approving={approvingQuestionId === question.id}
                  deleting={deletingQuestionId === question.id}
                  regenerating={regeneratingQuestionId === question.id}
                />
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.sectionId} className="space-y-4">
              <div className="sticky top-0 z-[1] border-b bg-background/95 pb-2 pt-1 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{group.title}</p>
                <p className="text-xs text-muted-foreground">
                  {group.items.length} question{group.items.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="space-y-6">
                {group.items.map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    sections={sections}
                    onPatch={onPatch}
                    onApprove={(questionId) => onApprove(questionId)}
                    onDelete={(questionId) => onDelete(questionId)}
                    onRegenerate={(questionId) => onRegenerate(questionId)}
                    approving={approvingQuestionId === question.id}
                    deleting={deletingQuestionId === question.id}
                    regenerating={regeneratingQuestionId === question.id}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {useVirtual ? (
        <p className="mt-4 text-center text-xs text-muted-foreground">Virtualized view enabled for large result sets.</p>
      ) : null}
    </div>
  )
}
