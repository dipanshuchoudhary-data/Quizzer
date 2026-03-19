"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { toast } from "sonner"
import { questionApi } from "@/lib/api/question"
import { questionBulkApi } from "@/lib/api/question-bulk"
import { sectionApi } from "@/lib/api/section"
import { quizApi } from "@/lib/api/quiz"
import { Question } from "@/types/question"
import { Section } from "@/types/section"
import { SectionSidebar } from "@/features/quiz/review/SectionSidebar"
import { QuestionVirtualList } from "./QuestionVirtualList"
import { BulkActionsBar } from "@/features/quiz/review/BulkActionsBar"
import { useReviewUIStore } from "@/stores/useReviewUIStore"
import { useSelectionStore } from "@/stores/useSelectionStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

export function ReviewPage({ quizId }: { quizId: string }) {
  const queryClient = useQueryClient()
  const { activeSection, setActiveSection, focusMode, toggleFocus, setFocusMode } = useReviewUIStore()
  const { selectedIds, setMany, clear } = useSelectionStore()
  const [reviewFilter, setReviewFilter] = useState<"all" | "pending" | "missing_answer">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [approvingQuestionId, setApprovingQuestionId] = useState<string | null>(null)
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null)
  const [regeneratingQuestionId, setRegeneratingQuestionId] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

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

  const {
    data: rawSections = [],
    isError: isSectionsError,
    refetch: refetchSections,
  } = useQuery({
    queryKey: ["sections", quizId],
    queryFn: () => sectionApi.getByQuiz(quizId),
    retry: 1,
  })

  const {
    data: questions = [],
    isLoading: isQuestionsLoading,
    isError: isQuestionsError,
    refetch: refetchQuestions,
  } = useQuery({
    queryKey: ["questions", quizId],
    queryFn: () => questionApi.getByQuiz(quizId),
  })

  const sections = useMemo<Section[]>(() => {
    if (Array.isArray(rawSections) && rawSections.length > 0) return rawSections
    const uniqueIds = Array.from(new Set(questions.map((question) => question.section_id).filter(Boolean)))
    return uniqueIds.map((sectionId, index) => ({
      id: sectionId,
      quiz_id: quizId,
      title: `Section ${index + 1}`,
      total_marks: 0,
    }))
  }, [rawSections, questions, quizId])

  const isMissingAnswer = (question: Question) =>
    !question.correct_answer || question.correct_answer.trim().length === 0 || question.correct_answer === "answer_unavailable"

  const sectionScopedQuestions = useMemo(
    () => (activeSection ? questions.filter((question) => question.section_id === activeSection) : questions),
    [questions, activeSection]
  )

  const searchedQuestions = useMemo(() => {
    if (!debouncedSearchQuery) return sectionScopedQuestions
    const lower = debouncedSearchQuery.toLowerCase()
    return sectionScopedQuestions.filter((question) => (question.question_text ?? "").toLowerCase().includes(lower))
  }, [sectionScopedQuestions, debouncedSearchQuery])

  const filteredQuestions = useMemo(() => {
    if (reviewFilter === "pending") {
      return searchedQuestions.filter((question) => question.status !== "APPROVED")
    }
    if (reviewFilter === "missing_answer") {
      return searchedQuestions.filter((question) => isMissingAnswer(question))
    }
    return searchedQuestions
  }, [searchedQuestions, reviewFilter])

  const filteredIds = useMemo(() => filteredQuestions.map((question) => question.id), [filteredQuestions])
  const unapprovedIds = useMemo(
    () => questions.filter((question) => question.status !== "APPROVED").map((question) => question.id),
    [questions]
  )

  const saveQuestion = useMutation({
    mutationFn: ({ questionId, payload }: { questionId: string; payload: Partial<Question> }) =>
      questionApi.update(questionId, payload),
    onError: () => toast.error("Autosave failed"),
  })

  const approveQuestion = useMutation({
    mutationFn: async (questionId: string) => {
      setApprovingQuestionId(questionId)
      return questionApi.approve(questionId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions", quizId] })
      toast.success("Question approved")
    },
    onError: () => toast.error("Failed to approve question"),
    onSettled: () => setApprovingQuestionId(null),
  })

  const deleteQuestion = useMutation({
    mutationFn: async (questionId: string) => {
      setDeletingQuestionId(questionId)
      return questionApi.delete(questionId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions", quizId] })
      toast.success("Question deleted")
    },
    onError: () => toast.error("Failed to delete question"),
    onSettled: () => setDeletingQuestionId(null),
  })

  const regenerateQuestion = useMutation({
    mutationFn: async (questionId: string) => {
      setRegeneratingQuestionId(questionId)
      return questionApi.regenerate(questionId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions", quizId] })
      toast.success("Question regenerated")
    },
    onError: () => toast.error("Failed to regenerate question"),
    onSettled: () => setRegeneratingQuestionId(null),
  })

  const createManualQuestion = useMutation({
    mutationFn: () =>
      questionApi.create({
        section_id: sections[0]?.id ?? "",
        question_text: "New manual question",
        question_type: "MCQ",
        marks: 2,
        options: ["Option A", "Option B", "Option C", "Option D"],
        correct_answer: "Option A",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions", quizId] })
      toast.success("Manual question added")
    },
    onError: () => toast.error("Failed to add question"),
  })

  const approveAll = useMutation({
    mutationFn: () => questionBulkApi.approveMany(questions.map((question) => question.id)),
    onSuccess: () => {
      clear()
      queryClient.invalidateQueries({ queryKey: ["questions", quizId] })
      toast.success("All questions approved")
    },
    onError: () => toast.error("Approve all failed"),
  })

  const patchQuestion = (questionId: string, payload: Partial<Question>) => {
    queryClient.setQueryData<Question[]>(["questions", quizId], (current = []) =>
      current.map((question) => {
        if (question.id !== questionId) return question
        const nextStatus =
          question.status === "APPROVED" && payload.status === undefined ? "DRAFT" : question.status
        return { ...question, ...payload, status: payload.status ?? nextStatus }
      })
    )
    const current = queryClient.getQueryData<Question[]>(["questions", quizId]) ?? []
    const target = current.find((q) => q.id === questionId)
    const shouldDemote = target?.status === "APPROVED" && payload.status === undefined
    const nextPayload = shouldDemote ? { ...payload, status: "DRAFT" } : payload
    saveQuestion.mutate({ questionId, payload: nextPayload })
  }

  const publishQuiz = useMutation({
    mutationFn: () => quizApi.publish(quizId),
    onSuccess: () => toast.success("Quiz published"),
    onError: () => toast.error("Failed to publish quiz"),
  })

  const hasSearch = debouncedSearchQuery.length > 0
  const allVisibleSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id))

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-background/95",
        focusMode ? "min-h-screen rounded-none border-none" : "min-h-[calc(100vh-220px)]"
      )}
    >
      <div className="sticky top-0 z-30 border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium">Review and approve all questions before publishing your quiz.</p>
            <p className="text-xs text-muted-foreground">
              {sections.length > 0
                ? `${sections.length} section${sections.length === 1 ? "" : "s"} • ${questions.length} total question${questions.length === 1 ? "" : "s"}`
                : "No sections defined"}
            </p>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-2 lg:flex lg:w-auto">
            <Button size="sm" variant="outline" onClick={toggleFocus} title="Shortcut: F" className="h-11 w-full lg:w-auto">
              {focusMode ? "Exit focus mode" : "Focus mode"}
            </Button>
            <Button size="sm" onClick={() => approveAll.mutate()} disabled={questions.length === 0 || approveAll.isPending} className="h-11 w-full lg:w-auto">
              {approveAll.isPending ? "Approving..." : `Approve all (${questions.length})`}
            </Button>
            <Button size="sm" onClick={() => publishQuiz.mutate()} disabled={publishQuiz.isPending || questions.length === 0} className="h-11 w-full sm:col-span-2 lg:w-auto">
              {publishQuiz.isPending ? "Publishing..." : "Publish"}
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search questions by text..."
              className="pl-8"
            />
          </div>
          <div className="flex min-h-11 items-center gap-2 rounded-md border px-3 py-2">
            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={(checked) => {
                if (checked) {
                  setMany(filteredIds)
                  return
                }
                clear()
              }}
              aria-label="Select all visible questions"
            />
            <span className="text-xs text-muted-foreground">Select all visible ({filteredIds.length})</span>
          </div>
          <Button size="sm" variant="outline" onClick={clear} className="h-11 w-full lg:w-auto">
            Clear selection
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {!focusMode && (
          <SectionSidebar
            sections={sections}
            questions={questions}
            active={activeSection}
            reviewFilter={reviewFilter}
            onChange={setActiveSection}
            onFilterChange={setReviewFilter}
          />
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <BulkActionsBar sections={sections} onDone={() => queryClient.invalidateQueries({ queryKey: ["questions", quizId] })} />
          {isQuestionsError || isSectionsError ? (
            <div className="m-6 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
              <p className="text-sm font-medium text-destructive">Failed to load review workspace data.</p>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => void refetchQuestions()}>
                  Retry questions
                </Button>
                <Button size="sm" variant="outline" onClick={() => void refetchSections()}>
                  Retry sections
                </Button>
              </div>
            </div>
          ) : isQuestionsLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading questions...</div>
          ) : filteredQuestions.length === 0 ? (
            <div className="m-6 rounded-xl border bg-muted/20 p-6">
              {hasSearch ? (
                <>
                  <p className="text-sm font-medium">No results found</p>
                  <p className="mt-1 text-sm text-muted-foreground">Try a different search term or clear filters.</p>
                </>
              ) : questions.length === 0 ? (
                <>
                  <p className="text-sm font-medium">No questions yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Start by adding a manual question, then review and approve.</p>
                  <Button className="mt-3" variant="outline" onClick={() => createManualQuestion.mutate()} disabled={!sections[0]}>
                    Add first question
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">No questions match this filter</p>
                  <p className="mt-1 text-sm text-muted-foreground">Adjust section or review filters to continue reviewing.</p>
                </>
              )}
            </div>
          ) : (
            <QuestionVirtualList
              questions={filteredQuestions}
              sections={sections}
              onPatch={patchQuestion}
              onApprove={(questionId: string) => approveQuestion.mutate(questionId)}
              onDelete={(questionId: string) => {
                const confirmed = window.confirm("Delete this question? This action cannot be undone.")
                if (!confirmed) return
                deleteQuestion.mutate(questionId)
              }}
              onRegenerate={(questionId: string) => regenerateQuestion.mutate(questionId)}
              approvingQuestionId={approvingQuestionId}
              deletingQuestionId={deletingQuestionId}
              regeneratingQuestionId={regeneratingQuestionId}
            />
          )}
        </div>
      </div>
    </div>
  )
}
