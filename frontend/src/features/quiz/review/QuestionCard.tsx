"use client"

import { useMemo } from "react"
import { Check, Copy, RefreshCw, Trash2 } from "lucide-react"
import { Question } from "@/types/question"
import { Section } from "@/types/section"
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
  if (Array.isArray(options)) return options.map((option) => String(option))
  return Object.values(options).map((option) => String(option))
}

function ensureFourOptions(options: string[]) {
  const base = options.length ? options.slice(0, 4) : ["", "", "", ""]
  const padded = [...base]
  while (padded.length < 4) padded.push("")
  return padded.slice(0, 4)
}

const QUESTION_TYPES = [
  { label: "MCQ", value: "MCQ" },
  { label: "True / False", value: "TRUE_FALSE" },
  { label: "Written Answer", value: "WRITTEN" },
]

function normalizeType(questionType: string) {
  if (questionType === "MCQ") return "MCQ"
  if (questionType === "TRUE_FALSE") return "TRUE_FALSE"
  return "WRITTEN"
}

function toStorageType(type: string) {
  if (type === "MCQ" || type === "TRUE_FALSE") return type
  return "SHORT_ANSWER"
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
  const qType = normalizeType(question.question_type)
  const mcqOptions = useMemo(() => ensureFourOptions(options), [options])
  const isSelected = selectedIds.includes(question.id)

  return (
    <div className="space-y-4 rounded-2xl border bg-background/95 p-6 shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Checkbox checked={isSelected} onCheckedChange={() => toggle(question.id)} />
          <StatusBadge status={question.status} />
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => onApprove(question.id)} aria-label="Approve question">
            <Check size={14} />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onDuplicate(question.id)} aria-label="Duplicate question">
            <Copy size={14} />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onRegenerate(question.id)} aria-label="Regenerate question">
            <RefreshCw size={14} />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onDelete(question.id)} aria-label="Delete question">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <Textarea
        value={normalizeMathText(question.question_text)}
        onChange={(event) => onPatch(question.id, { question_text: normalizeMathText(event.target.value) })}
        className="min-h-[110px]"
      />
      <p className="text-sm text-muted-foreground">{questionPreview}</p>

      <div className="grid gap-3 md:grid-cols-3">
        <Input
          type="number"
          value={question.marks}
          onChange={(event) => onPatch(question.id, { marks: Number(event.target.value || 0) })}
        />
        <Select value={qType} onValueChange={(value) => onPatch(question.id, { question_type: toStorageType(value) })}>
          <SelectTrigger>
            <SelectValue placeholder="Question type" />
          </SelectTrigger>
          <SelectContent>
            {QUESTION_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={question.difficulty ?? "Medium"}
          onValueChange={(value) => onPatch(question.id, { difficulty: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Easy">Easy</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Hard">Hard</SelectItem>
          </SelectContent>
        </Select>
      </div>

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

      {qType === "MCQ" ? (
        <div className="space-y-3">
          {mcqOptions.map((option, index) => {
            const label = String.fromCharCode(65 + index)
            const isCorrect = question.correct_answer === option
            return (
              <div
                key={`${question.id}-opt-${index}`}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                  isCorrect ? "border-emerald-300 bg-emerald-50" : "border-muted"
                }`}
              >
                <span className="w-5 text-sm font-semibold text-muted-foreground">{label}.</span>
                <Input
                  value={option}
                  onChange={(event) => {
                    const nextOptions = [...mcqOptions]
                    const nextValue = event.target.value
                    const previousValue = nextOptions[index]
                    nextOptions[index] = nextValue
                    onPatch(question.id, {
                      options: nextOptions,
                      correct_answer: question.correct_answer === previousValue ? nextValue : question.correct_answer,
                    })
                  }}
                />
                <Button
                  variant={isCorrect ? "default" : "outline"}
                  onClick={() => onPatch(question.id, { correct_answer: option })}
                >
                  {isCorrect ? "Correct" : "Mark correct"}
                </Button>
              </div>
            )
          })}
        </div>
      ) : qType === "TRUE_FALSE" ? (
        <div className="flex items-center gap-2">
          {["True", "False"].map((value) => {
            const isCorrect = question.correct_answer === value
            return (
              <Button
                key={value}
                variant={isCorrect ? "default" : "outline"}
                onClick={() => onPatch(question.id, { correct_answer: value })}
              >
                {value}
              </Button>
            )
          })}
        </div>
      ) : (
        <Textarea
          placeholder="Expected answer (optional, for teacher reference)"
          value={question.correct_answer ?? ""}
          onChange={(event) => onPatch(question.id, { correct_answer: event.target.value })}
        />
      )}
    </div>
  )
}
