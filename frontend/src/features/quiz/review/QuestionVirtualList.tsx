"use client"
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
  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 scroll-smooth">
      <div className="space-y-10">
        {questions.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            sections={sections}
            onPatch={onPatch}
            onApprove={onApprove}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onRegenerate={onRegenerate}
          />
        ))}
      </div>
    </div>
  )
}
