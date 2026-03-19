"use client"

import { useMemo, useRef, useState } from "react"
import { Check, Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react"
import { Question } from "@/types/question"
import { Section } from "@/types/section"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip } from "@/components/ui/tooltip"
import { StatusBadge } from "@/components/common/StatusBadge"
import { useSelectionStore } from "@/stores/useSelectionStore"
import { normalizeMathText } from "@/lib/question-format"

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
  { label: "Short Answer", value: "SHORT_ANSWER" },
  { label: "Long Answer", value: "LONG_ANSWER" },
]

function normalizeType(questionType: string) {
  if (questionType === "MCQ") return "MCQ"
  if (questionType === "TRUE_FALSE") return "TRUE_FALSE"
  if (questionType === "LONG_ANSWER") return "LONG_ANSWER"
  return "SHORT_ANSWER"
}

function toStorageType(type: string) {
  if (type === "MCQ" || type === "TRUE_FALSE" || type === "SHORT_ANSWER" || type === "LONG_ANSWER") return type
  return "MCQ"
}

export function QuestionCard({
  question,
  sections,
  onPatch,
  onApprove,
  onDelete,
  onRegenerate,
  approving,
  deleting,
  regenerating,
}: {
  question: Question
  sections: Section[]
  onPatch: (questionId: string, payload: Partial<Question>) => void
  onApprove: (questionId: string) => void
  onDelete: (questionId: string) => void
  onRegenerate: (questionId: string) => void
  approving?: boolean
  deleting?: boolean
  regenerating?: boolean
}) {
  const selectedIds = useSelectionStore((state) => state.selectedIds)
  const toggle = useSelectionStore((state) => state.toggle)
  const textRef = useRef<HTMLTextAreaElement | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const options = useMemo(() => normalizeOptions(question.options), [question.options])
  const qType = normalizeType(question.question_type)
  const mcqOptions = useMemo(() => ensureFourOptions(options), [options])
  const isSelected = selectedIds.includes(question.id)
  const typeLabel = QUESTION_TYPES.find((type) => type.value === qType)?.label ?? qType
  const expectedAnswer = (question.expected_answer ?? question.correct_answer ?? "").trim()
  const explanation = (question.explanation ?? "").trim()
  const isWrittenType = qType === "SHORT_ANSWER" || qType === "LONG_ANSWER"
  const showExpectedAnswer = isWrittenType && (isEditing || expectedAnswer.length > 0)

  return (
    <article className="space-y-5 rounded-2xl border bg-background p-6 shadow-sm transition-shadow hover:shadow-md">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggle(question.id)}
            aria-label={`Select question ${question.id}`}
          />
          <Badge variant="secondary" className="text-xs font-medium">
            {typeLabel}
          </Badge>
          <StatusBadge status={question.status} />
        </div>
        <div className="flex items-center gap-2">
          <Tooltip content="Approve question">
            <Button
              size="icon"
              variant="outline"
              onClick={() => onApprove(question.id)}
              disabled={approving || deleting || regenerating}
              aria-label="Approve question"
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              {approving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </Button>
          </Tooltip>
          <Tooltip content="Edit question text">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setIsEditing(true)
                textRef.current?.focus()
              }}
              aria-label="Edit question"
                disabled={approving || deleting || regenerating}
            >
              <Pencil size={14} />
            </Button>
          </Tooltip>
          <Tooltip content="Regenerate question">
            <Button
              size="icon"
              variant="outline"
              onClick={() => onRegenerate(question.id)}
              disabled={approving || deleting || regenerating}
              aria-label="Regenerate question"
            >
              {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            </Button>
          </Tooltip>
          <Tooltip content="Delete question">
            <Button
              size="icon"
              variant="destructive"
              onClick={() => onDelete(question.id)}
              disabled={approving || deleting || regenerating}
              aria-label="Delete question"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </Button>
          </Tooltip>
        </div>
      </header>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Question</p>
      <Textarea
        ref={textRef}
        value={normalizeMathText(question.question_text)}
        onChange={(event) => {
          setIsEditing(true)
          onPatch(question.id, { question_text: normalizeMathText(event.target.value) })
        }}
        onFocus={() => setIsEditing(true)}
        className="min-h-[110px]"
        aria-label="Question text"
      />
      </div>

      <div className="border-t pt-4">
        <div className="grid gap-3 md:grid-cols-4">
        <Input
          type="number"
          value={question.marks}
          onChange={(event) => onPatch(question.id, { marks: Math.max(1, Number(event.target.value || 1)) })}
          aria-label="Marks"
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
      </div>

      {qType === "MCQ" ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Answer Options</p>
          {mcqOptions.map((option, index) => {
            const label = String.fromCharCode(65 + index)
            const isCorrect = question.correct_answer === option
            return (
              <div
                key={`${question.id}-opt-${index}`}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                  isCorrect ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30" : "border-muted"
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
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Answer</p>
          <div className="inline-flex rounded-lg border bg-muted/30 p-1">
            {["True", "False"].map((value) => {
              const isCorrect = question.correct_answer === value
              return (
                <Button
                  key={value}
                  size="sm"
                  variant="ghost"
                  className={isCorrect ? "bg-emerald-600 text-white hover:bg-emerald-600" : "text-muted-foreground"}
                  onClick={() => onPatch(question.id, { correct_answer: value })}
                >
                  {value}
                </Button>
              )
            })}
          </div>
        </div>
      ) : (
        showExpectedAnswer ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Expected Answer (optional)</p>
            <Textarea
              placeholder="Expected answer (optional, for teacher reference)"
              value={question.expected_answer ?? question.correct_answer ?? ""}
              onChange={(event) => {
                setIsEditing(true)
                onPatch(question.id, { correct_answer: event.target.value })
              }}
              onFocus={() => setIsEditing(true)}
              aria-label="Expected answer"
            />
          </div>
        ) : null
      )}

      {explanation ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Explanation</p>
          <Textarea value={explanation} readOnly aria-label="Explanation" className="min-h-[84px] bg-muted/30" />
        </div>
      ) : null}
    </article>
  )
}
