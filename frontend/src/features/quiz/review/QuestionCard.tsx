"use client"

import { useMemo } from "react"
import { Check, Copy, RefreshCw, Trash2 } from "lucide-react"
import { Question } from "@/types/question"
import { Section } from "@/types/section"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatusBadge } from "@/components/common/StatusBadge"
import { useSelectionStore } from "@/stores/useSelectionStore"
import { formatQuestionForDisplay, normalizeMathText } from "@/lib/question-format"

function normalizeOptions(options: Question["options"]): string[] {
  if (!options) return []
  if (Array.isArray(options)) return options.map((option) => normalizeMathText(String(option)))
  return Object.values(options).map((option) => normalizeMathText(String(option)))
}

export function QuestionCard({
  question,
  sections,
  onPatch,
  onApprove,
  onDelete,
  onDuplicate,
  onRegenerate,
}: {
  question: Question
  sections: Section[]
  onPatch: (questionId: string, payload: Partial<Question>) => void
  onApprove: (questionId: string) => void
  onDelete: (questionId: string) => void
  onDuplicate: (questionId: string) => void
  onRegenerate: (questionId: string) => void
}) {
  const selectedIds = useSelectionStore((state) => state.selectedIds)
  const toggle = useSelectionStore((state) => state.toggle)
  const options = useMemo(() => normalizeOptions(question.options), [question.options])
  const questionPreview = useMemo(() => formatQuestionForDisplay(question.question_text), [question.question_text])
  const normalizedCorrectAnswer = useMemo(() => normalizeMathText(question.correct_answer), [question.correct_answer])
  const isSelected = selectedIds.includes(question.id)

  return (
    <Card className="mb-3">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={isSelected} onCheckedChange={() => toggle(question.id)} />
            <StatusBadge status={question.status} />
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => onApprove(question.id)}>
              <Check size={14} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onDuplicate(question.id)}>
              <Copy size={14} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onRegenerate(question.id)}>
              <RefreshCw size={14} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onDelete(question.id)}>
              <Trash2 size={14} />
            </Button>
          </div>
        </div>

        <Textarea
          value={normalizeMathText(question.question_text)}
          onChange={(event) => onPatch(question.id, { question_text: normalizeMathText(event.target.value) })}
          className="min-h-24"
        />
        <p className="text-sm text-muted-foreground">{questionPreview}</p>

        <div className="grid gap-2 md:grid-cols-2">
          <Input
            type="number"
            value={question.marks}
            onChange={(event) => onPatch(question.id, { marks: Number(event.target.value || 0) })}
          />
          <Select value={question.section_id} onValueChange={(value) => onPatch(question.id, { section_id: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              {sections.map((section) => (
                <SelectItem key={section.id} value={section.id}>
                  {section.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={`${question.id}-opt-${index}`} className="flex items-center gap-2">
              <Input
                value={option}
                onChange={(event) => {
                  const nextOptions = [...options]
                  nextOptions[index] = normalizeMathText(event.target.value)
                  onPatch(question.id, { options: nextOptions })
                }}
              />
              <Button
                variant={normalizedCorrectAnswer === option ? "default" : "outline"}
                className={
                  normalizedCorrectAnswer === option
                    ? "border-green-600 bg-green-600 text-white hover:bg-green-700 hover:border-green-700"
                    : ""
                }
                onClick={() => onPatch(question.id, { correct_answer: option })}
              >
                Correct
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
