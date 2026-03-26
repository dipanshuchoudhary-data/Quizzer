"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  CopyPlus,
  Edit3,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useReviewUIStore } from "@/stores/useReviewUIStore"
import { questionApi } from "@/lib/api/question"
import { sectionApi } from "@/lib/api/section"
import { quizApi } from "@/lib/api/quiz"
import { cn } from "@/lib/utils"
import type { Question } from "@/types/question"

const REVIEW_TYPES = [
  { label: "MCQ", value: "MCQ" },
  { label: "True / False", value: "TRUE_FALSE" },
  { label: "Written Answer", value: "WRITTEN" },
]

const MARK_OPTIONS = [
  { label: "1 mark", value: 1 },
  { label: "2 marks", value: 2 },
  { label: "3 marks", value: 3 },
  { label: "5 marks", value: 5 },
  { label: "Custom", value: -1 },
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

function parseOptions(options: unknown): string[] {
  if (!options) return []
  if (Array.isArray(options)) return options.map(String)
  if (typeof options === "object") return Object.values(options as Record<string, unknown>).map(String)
  return []
}

function ensureOptionBounds(options: string[]) {
  const trimmed = options.map((opt) => opt.trim())
  const base = trimmed.length ? trimmed : ["", "", "", ""]
  const padded = [...base]
  while (padded.length < 4) padded.push("")
  return padded.slice(0, 4)
}

function sortQuestions(questions: Question[]) {
  const hasSourceOrder = questions.some((q) => (q.order_index ?? 0) > 0)
  if (hasSourceOrder) {
    return [...questions].sort((a, b) => {
      const aOrder = a.order_index ?? 0
      const bOrder = b.order_index ?? 0
      if (aOrder !== bOrder) return aOrder - bOrder
      return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
    })
  }
  const typeRank = new Map<string, number>([
    ["MCQ", 1],
    ["TRUE_FALSE", 2],
    ["WRITTEN", 3],
  ])
  return [...questions].sort((a, b) => {
    const aType = normalizeType(a.question_type)
    const bType = normalizeType(b.question_type)
    const typeDiff = (typeRank.get(aType) ?? 99) - (typeRank.get(bType) ?? 99)
    if (typeDiff !== 0) return typeDiff
    return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
  })
}

function getQuestionErrors(question: Question) {
  const errors: string[] = []
  const qType = normalizeType(question.question_type)
  if (!question.question_text?.trim()) errors.push("Missing question text")
  if (qType === "MCQ") {
    const options = ensureOptionBounds(parseOptions(question.options))
    const validOptions = options.filter((opt) => opt.trim())
    if (validOptions.length < 4) errors.push("Exactly 4 options required")
    if (!question.correct_answer || !validOptions.includes(question.correct_answer)) {
      errors.push("Correct answer missing")
    }
  }
  if (qType === "TRUE_FALSE") {
    if (!question.correct_answer || !["True", "False"].includes(question.correct_answer)) {
      errors.push("Correct answer missing")
    }
  }
  return errors
}

export function QuizReview({ quizId }: { quizId: string }) {
  const queryClient = useQueryClient()
  const { focusMode, toggleFocus, setFocusMode } = useReviewUIStore()
  const [hasLoaded, setHasLoaded] = useState(false)
  const [filterSection, setFilterSection] = useState<string>("all")
  const [filterType, setFilterType] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [hasChangesSincePublish, setHasChangesSincePublish] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)

  useEffect(() => {
    document.body.classList.toggle("review-focus", focusMode)
    return () => {
      document.body.classList.remove("review-focus")
    }
  }, [focusMode])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.defaultPrevented) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key.toLowerCase() !== "f") return
      const target = event.target as HTMLElement | null
      const isTypingContext =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      if (isTypingContext) return
      event.preventDefault()
      toggleFocus()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      setFocusMode(false)
    }
  }, [setFocusMode, toggleFocus])

  const { data: questions = [], refetch: refetchQuestions, isLoading } = useQuery({
    queryKey: ["questions", quizId],
    queryFn: () => questionApi.getByQuiz(quizId),
    enabled: Boolean(quizId),
  })

  const { data: sections = [] } = useQuery({
    queryKey: ["sections", quizId],
    queryFn: () => sectionApi.getByQuiz(quizId),
    enabled: Boolean(quizId),
  })

  const { data: quiz } = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: () => quizApi.getById(quizId),
    enabled: Boolean(quizId),
  })

  useEffect(() => {
    if (questions.length > 0) setHasLoaded(true)
  }, [questions.length])

  const updateQuestionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => questionApi.update(id, payload),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: ["questions", quizId] })
      const previous = queryClient.getQueryData<Question[]>(["questions", quizId])
      if (previous) {
        queryClient.setQueryData<Question[]>(
          ["questions", quizId],
          previous.map((q) => (q.id === id ? { ...q, ...payload } : q))
        )
      }
      return { previous }
    },
    onSuccess: () => {
      setHasChangesSincePublish(true)
      void refetchQuestions()
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData<Question[]>(["questions", quizId], context.previous)
      }
      toast.error("Question update failed")
    },
  })

  const deleteQuestionMutation = useMutation({
    mutationFn: questionApi.delete,
    onSuccess: () => {
      toast.success("Question deleted")
      setHasChangesSincePublish(true)
      void refetchQuestions()
    },
  })

  const regenerateQuestionMutation = useMutation({
    mutationFn: questionApi.regenerate,
    onSuccess: () => {
      toast.success("Question regenerated")
      setHasChangesSincePublish(true)
      void refetchQuestions()
    },
    onError: () => toast.error("Regeneration failed"),
  })

  const createManualQuestionMutation = useMutation({
    mutationFn: () =>
      questionApi.create({
        section_id: sections[0]?.id,
        question_text: "New manual question",
        question_type: "MCQ",
        marks: 2,
        options: ["Option A", "Option B", "Option C", "Option D"],
        correct_answer: "Option A",
      }),
    onSuccess: () => {
      toast.success("Question added")
      setHasChangesSincePublish(true)
      void refetchQuestions()
    },
    onError: () => toast.error("Failed to add question"),
  })

  const publishMutation = useMutation({
    mutationFn: () => quizApi.publish(quizId),
    onSuccess: (data) => {
      toast.success("Quiz published")
      setPublishedUrl(data.public_url ?? null)
      queryClient.setQueryData(["quiz", quizId], (current: typeof quiz) =>
        current
          ? {
              ...current,
              is_published: true,
              public_id: data.public_id ?? current.public_id ?? null,
              public_url: data.public_url ?? current.public_url ?? null,
              ai_generation_status: "PUBLISHED",
            }
          : current
      )
      queryClient.invalidateQueries({ queryKey: ["quiz", quizId] })
      queryClient.invalidateQueries({ queryKey: ["quizzes"] })
      setHasChangesSincePublish(false)
    },
    onError: () => toast.error("Publish validation failed"),
  })

  const fullPublishUrl = quiz?.is_published ? quiz.public_url ?? null : null
  const isPublished = Boolean(fullPublishUrl)
  const handleBulkAction = async (action: string) => {
    const actions = questions.map((question) => {
      if (action === "approve") return questionApi.update(question.id, { status: "APPROVED" })
      if (action === "reject") return questionApi.update(question.id, { status: "REJECTED" })
      if (action === "draft") return questionApi.update(question.id, { status: "DRAFT" })
      return Promise.resolve()
    })
    await Promise.all(actions)
    setHasChangesSincePublish(true)
    void refetchQuestions()
  }

  const filteredQuestions = useMemo(() => {
    let list = sortQuestions(questions)
    if (filterSection !== "all") list = list.filter((q) => q.section_id === filterSection)
    if (filterType !== "all") list = list.filter((q) => normalizeType(q.question_type) === filterType)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      list = list.filter((q) => q.question_text.toLowerCase().includes(query))
    }
    return list
  }, [questions, filterSection, filterType, searchQuery])

  const validationErrors = useMemo(() => {
    return questions.flatMap((question) => getQuestionErrors(question))
  }, [questions])

  const canPublish =
    questions.length > 0 &&
    questions.every((q) => q.status === "APPROVED") &&
    validationErrors.length === 0 &&
    (!isPublished || hasChangesSincePublish)

  const handleMove = async (question: Question, direction: "up" | "down") => {
    const sectionQuestions = sortQuestions(questions.filter((q) => q.section_id === question.section_id))
    const index = sectionQuestions.findIndex((q) => q.id === question.id)
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= sectionQuestions.length) return
    const target = sectionQuestions[targetIndex]
    const currentOrder = question.order_index ?? index + 1
    const targetOrder = target.order_index ?? targetIndex + 1
    await questionApi.update(question.id, { order_index: targetOrder })
    await questionApi.update(target.id, { order_index: currentOrder })
    setHasChangesSincePublish(true)
    void refetchQuestions()
  }

  const handleMoveToSection = async (question: Question, nextSectionId: string) => {
    if (question.section_id === nextSectionId) return
    const maxOrder = Math.max(
      0,
      ...questions.filter((q) => q.section_id === nextSectionId).map((q) => q.order_index ?? 0)
    )
    await questionApi.update(question.id, { section_id: nextSectionId, order_index: maxOrder + 1 })
    setHasChangesSincePublish(true)
    void refetchQuestions()
  }

  const sidebarStats = useMemo(() => {
    const stats = {
      MCQ: { total: 0, approved: 0 },
      TRUE_FALSE: { total: 0, approved: 0 },
      WRITTEN: { total: 0, approved: 0 },
    }
    questions.forEach((q) => {
      const key = normalizeType(q.question_type) as keyof typeof stats
      stats[key].total += 1
      if (q.status === "APPROVED") stats[key].approved += 1
    })
    return stats
  }, [questions])

  return (
    <div
      className={cn(
        "flex flex-col space-y-5 overflow-hidden rounded-2xl border bg-background/95",
        focusMode ? "min-h-screen rounded-none border-none" : "min-h-[calc(100vh-260px)]"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-background/80 p-4 shadow-sm">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Question review workspace</p>
          <p className="text-xs text-muted-foreground">Approve, edit, and publish once everything looks perfect.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={toggleFocus} title="Shortcut: F">
            {focusMode ? "Exit focus mode" : "Focus mode"}
          </Button>
          <Button variant="outline" onClick={() => createManualQuestionMutation.mutate()} disabled={!sections[0]}>
            Add question
          </Button>
          <Button variant="outline" onClick={() => handleBulkAction("approve")}>
            Approve all
          </Button>
          <Select onValueChange={handleBulkAction}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Bulk actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="approve">Approve all</SelectItem>
              <SelectItem value="draft">Reset to draft</SelectItem>
              <SelectItem value="reject">Reject all</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => publishMutation.mutate()} disabled={!canPublish || publishMutation.isPending}>
            {publishMutation.isPending ? "Publishing..." : "Publish Quiz"}
          </Button>
        </div>
      </div>

      <div className={cn("grid flex-1 gap-6", focusMode ? "lg:grid-cols-[minmax(0,1fr)]" : "lg:grid-cols-[300px_minmax(0,1fr)]")}>
        {!focusMode && (
          <aside className="space-y-4">
            <div className="sticky top-24 space-y-4 rounded-2xl border bg-background/70 p-4 shadow-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Question types</p>
                <div className="mt-3 space-y-2">
                  {REVIEW_TYPES.map((type) => {
                    const isActive = filterType === type.value
                    const stat = sidebarStats[type.value as keyof typeof sidebarStats]
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFilterType(type.value)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition",
                          isActive
                            ? "border-primary/40 bg-primary/5 text-primary"
                            : "border-muted bg-background hover:border-primary/30"
                        )}
                      >
                        <span>{type.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {stat.approved}/{stat.total}
                        </span>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setFilterType("all")}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition",
                      filterType === "all"
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-muted bg-background hover:border-primary/30"
                    )}
                  >
                    <span>All questions</span>
                    <span className="text-xs text-muted-foreground">{questions.length}</span>
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sections</p>
                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => setFilterSection("all")}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition",
                      filterSection === "all"
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-muted bg-background hover:border-primary/30"
                    )}
                  >
                    <span>All sections</span>
                    <span className="text-xs text-muted-foreground">{sections.length}</span>
                  </button>
                  {sections.map((section) => {
                    const count = questions.filter((q) => q.section_id === section.id).length
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setFilterSection(section.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition",
                          filterSection === section.id
                            ? "border-primary/40 bg-primary/5 text-primary"
                            : "border-muted bg-background hover:border-primary/30"
                        )}
                      >
                        <span>{section.title}</span>
                        <span className="text-xs text-muted-foreground">{count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </aside>
        )}

        <section className="flex min-h-0 flex-col space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search questions"
                className="pl-9"
              />
            </div>
            {validationErrors.length > 0 ? (
              <div className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                {validationErrors.length} validation issue(s)
              </div>
            ) : null}
          </div>

          {!canPublish ? (
            <p className="text-xs text-amber-600">
              {isPublished && !hasChangesSincePublish
                ? "Published. Make a change to enable republish."
                : "Approve all questions and resolve issues before publishing."}
            </p>
          ) : null}

          {isLoading && !hasLoaded ? <p className="text-sm text-muted-foreground">Loading questions...</p> : null}

          <div className="flex-1 space-y-10 overflow-y-auto pr-3 scroll-smooth">
            {filteredQuestions.map((question) => {
              const qType = normalizeType(question.question_type)
              const questionErrors = getQuestionErrors(question)
              const baseOptions =
                question.question_type === "TRUE_FALSE" ? ["True", "False"] : parseOptions(question.options)
              const normalizedOptions = ensureOptionBounds(baseOptions)
              const isMissingAnswer = questionErrors.some((err) => err.toLowerCase().includes("correct answer"))
              const marksFromTextMatch = question.question_text.match(/\\b(\\d+)\\s*marks?\\b/i)
              const marksFromText = marksFromTextMatch ? Number(marksFromTextMatch[1]) : null

              return (
                <div
                  key={question.id}
                  className="space-y-4 rounded-2xl border bg-background/95 p-6 shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {qType === "WRITTEN" ? "Written Answer" : qType.replace("_", " ")}
                      </p>
                      <Textarea
                        className="min-h-[96px]"
                        value={question.question_text}
                        onChange={(event) =>
                          updateQuestionMutation.mutate({ id: question.id, payload: { question_text: event.target.value } })
                        }
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-1 text-xs font-semibold",
                          question.status === "APPROVED" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                          question.status === "REJECTED" && "border-rose-200 bg-rose-50 text-rose-700",
                          question.status === "DRAFT" && "border-amber-200 bg-amber-50 text-amber-700"
                        )}
                      >
                        {question.status === "APPROVED"
                          ? "Approved"
                          : question.status === "REJECTED"
                          ? "Rejected"
                          : "Draft"}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateQuestionMutation.mutate({ id: question.id, payload: { status: "APPROVED" } })
                        }
                        disabled={question.status === "APPROVED"}
                      >
                        <CheckCircle2 className="mr-1 size-4" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuestionMutation.mutate({ id: question.id, payload: { status: "DRAFT" } })}
                      >
                        <Edit3 className="mr-1 size-4" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          updateQuestionMutation.mutate({ id: question.id, payload: { status: "REJECTED" } })
                        }
                      >
                        <XCircle className="mr-1 size-4" /> Reject
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="flex items-center">
                      <Select
                        value={
                          MARK_OPTIONS.some((opt) => opt.value === question.marks) ? String(question.marks) : "custom"
                        }
                        onValueChange={(value) => {
                          if (value === "custom") return
                          updateQuestionMutation.mutate({ id: question.id, payload: { marks: Number(value) } })
                        }}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Marks" />
                        </SelectTrigger>
                        <SelectContent>
                          {MARK_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.label}
                              value={option.value === -1 ? "custom" : String(option.value)}
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!MARK_OPTIONS.some((opt) => opt.value === question.marks) ? (
                        <Input
                          type="number"
                          min={1}
                          className="ml-2 w-24"
                          value={question.marks}
                          onChange={(event) =>
                            updateQuestionMutation.mutate({
                              id: question.id,
                              payload: { marks: Number(event.target.value || 0) },
                            })
                          }
                        />
                      ) : null}
                    </div>
                    <Select
                      value={qType}
                      onValueChange={(value) =>
                        updateQuestionMutation.mutate({ id: question.id, payload: { question_type: toStorageType(value) } })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REVIEW_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={question.difficulty ?? "Medium"}
                      onValueChange={(value) =>
                        updateQuestionMutation.mutate({ id: question.id, payload: { difficulty: value } })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Easy">Easy</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {marksFromText && marksFromText !== question.marks ? (
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">
                        Text shows {marksFromText} marks
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateQuestionMutation.mutate({ id: question.id, payload: { marks: marksFromText } })
                        }
                      >
                        Sync
                      </Button>
                    </div>
                  ) : null}

                  {qType === "MCQ" ? (
                    <div className="space-y-3">
                      <div className="space-y-3">
                        {normalizedOptions.map((option, idx) => {
                          const isCorrect = option === question.correct_answer
                          return (
                            <div
                              key={`${question.id}-opt-${idx}`}
                              className={cn(
                                "flex items-center gap-3 rounded-xl border px-3 py-2",
                                isCorrect ? "border-emerald-300 bg-emerald-50" : "border-muted"
                              )}
                            >
                              <span className="w-5 text-sm font-semibold text-muted-foreground">
                                {String.fromCharCode(65 + idx)}.
                              </span>
                              <Input
                                className="flex-1"
                                value={option}
                                onChange={(event) => {
                                  const next = [...normalizedOptions]
                                  next[idx] = event.target.value
                                  const trimmed = ensureOptionBounds(next)
                                  updateQuestionMutation.mutate({
                                    id: question.id,
                                    payload: {
                                      options: trimmed,
                                      correct_answer: question.correct_answer === option ? event.target.value : question.correct_answer,
                                    },
                                  })
                                }}
                              />
                              <Button
                                size="sm"
                                variant={isCorrect ? "default" : "outline"}
                                onClick={() =>
                                  option.trim()
                                    ? updateQuestionMutation.mutate({
                                        id: question.id,
                                        payload: { correct_answer: option },
                                      })
                                    : null
                                }
                              >
                                {isCorrect ? "Correct" : "Mark correct"}
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {qType === "TRUE_FALSE" ? (
                    <div className="flex items-center gap-2">
                      {["True", "False"].map((value) => {
                        const active = question.correct_answer === value
                        return (
                          <Button
                            key={value}
                            size="sm"
                            variant={active ? "default" : "outline"}
                            onClick={() =>
                              updateQuestionMutation.mutate({ id: question.id, payload: { correct_answer: value } })
                            }
                          >
                            {value}
                          </Button>
                        )
                      })}
                    </div>
                  ) : null}

                  {qType === "WRITTEN" ? (
                    <Textarea
                      placeholder="Expected answer (optional, for teacher reference)"
                      value={question.correct_answer ?? ""}
                      onChange={(event) =>
                        updateQuestionMutation.mutate({ id: question.id, payload: { correct_answer: event.target.value } })
                      }
                    />
                  ) : null}

                  {questionErrors.length > 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      {questionErrors.join(". ")}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {isMissingAnswer ? <span className="text-rose-600">Missing answer</span> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => navigator.clipboard.writeText(question.question_text)}
                        aria-label="Copy question"
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => questionApi.duplicate(question.id).then(() => refetchQuestions())}
                        aria-label="Duplicate question"
                      >
                        <CopyPlus className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleMove(question, "up")}
                        aria-label="Move up"
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleMove(question, "down")}
                        aria-label="Move down"
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Select value={question.section_id} onValueChange={(value) => handleMoveToSection(question, value)}>
                        <SelectTrigger className="h-9 w-[180px]">
                          <SelectValue placeholder="Move to secnbm,.tion" />
                        </SelectTrigger>
                        <SelectContent>
                          {sections.map((section) => (
                            <SelectItem key={section.id} value={section.id}>
                              {section.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => regenerateQuestionMutation.mutate(question.id)}
                        aria-label="Regenerate question"
                      >
                        <RotateCcw className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => deleteQuestionMutation.mutate(question.id)}
                        aria-label="Delete question"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <div className="rounded-2xl border bg-muted/30 p-4 text-sm">
        <p className="text-xs font-semibold text-muted-foreground">Links</p>
        {isPublished && fullPublishUrl ? (
          <>
            <p className="mt-1 font-semibold text-foreground">{fullPublishUrl}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(fullPublishUrl)
                  toast.success("Link copied")
                }}
              >
                Copy link
              </Button>
              <Button variant="outline" onClick={() => window.open(fullPublishUrl, "_blank")}>
                Open quiz
              </Button>
            </div>
          </>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">Publish the quiz to generate a student link.</p>
        )}
      </div>

      <Dialog open={Boolean(publishedUrl)} onOpenChange={(open) => !open && setPublishedUrl(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quiz Published</DialogTitle>
          </DialogHeader>
          <Input value={publishedUrl ?? ""} readOnly />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (!publishedUrl) return
                void navigator.clipboard.writeText(publishedUrl)
                toast.success("Link copied")
              }}
            >
              Copy link
            </Button>
            <Button onClick={() => setPublishedUrl(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
