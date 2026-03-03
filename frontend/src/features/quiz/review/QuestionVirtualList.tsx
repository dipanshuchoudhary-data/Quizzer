"use client"

import { useRef } from "react"
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
  onDuplicate,
  onRegenerate,
}: {
  questions: Question[]
  sections: Section[]
  onPatch: (questionId: string, payload: Partial<Question>) => void
  onApprove: (questionId: string) => void
  onDelete: (questionId: string) => void
  onDuplicate: (questionId: string) => void
  onRegenerate: (questionId: string) => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: questions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 340,
    overscan: 4,
  })

  return (
    <div ref={parentRef} className="h-[70vh] overflow-auto p-4">
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const question = questions[virtualRow.index]
          return (
            <div
              key={question.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <QuestionCard
                question={question}
                sections={sections}
                onPatch={onPatch}
                onApprove={onApprove}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onRegenerate={onRegenerate}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
