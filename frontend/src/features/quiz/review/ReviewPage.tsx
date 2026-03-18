"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { questionApi } from "@/lib/api/question"
import { questionBulkApi } from "@/lib/api/question-bulk"
import { sectionApi } from "@/lib/api/section"
import { Question } from "@/types/question"
import { SectionSidebar } from "@/features/quiz/review/SectionSidebar"
import { QuestionVirtualList } from "@/features/quiz/review/QuestionVirtualList"
import { BulkActionsBar } from "@/features/quiz/review/BulkActionsBar"
import { useReviewUIStore } from "@/stores/useReviewUIStore"
import { useSelectionStore } from "@/stores/useSelectionStore"
import { Button } from "@/components/ui/button"

export function ReviewPage({ quizId }: { quizId: string }) {
  const queryClient = useQueryClient()
  const { activeSection, setActiveSection, focusMode, toggleFocus } = useReviewUIStore()
  const { setMany, clear } = useSelectionStore()
  const [reviewFilter, setReviewFilter] = useState<"all" | "pending" | "missing_answer">("all")

  const { data: sections = [] } = useQuery({
    queryKey: ["sections", quizId],
    queryFn: () => sectionApi.getByQuiz(quizId),
  })

  const { data: questions = [], refetch: refetchQuestions } = useQuery({
    queryKey: ["questions", quizId],
    queryFn: () => questionApi.getByQuiz(quizId),
  })

  const isMissingAnswer = (question: Question) =>
    !question.correct_answer || question.correct_answer.trim().length === 0 || question.correct_answer === "answer_unavailable"

  const sectionScopedQuestions = useMemo(
    () => (activeSection ? questions.filter((question) => question.section_id === activeSection) : questions),
    [questions, activeSection]
  )

  const filteredQuestions = useMemo(() => {
    if (reviewFilter === "pending") {
      return sectionScopedQuestions.filter((question) => question.status !== "APPROVED")
    }
    if (reviewFilter === "missing_answer") {
      return sectionScopedQuestions.filter((question) => isMissingAnswer(question))
    }
    return sectionScopedQuestions
  }, [sectionScopedQuestions, reviewFilter])
  const filteredIds = useMemo(() => filteredQuestions.map((question) => question.id), [filteredQuestions])
  const pendingFilteredIds = useMemo(
    () => filteredQuestions.filter((question) => question.status !== "APPROVED").map((question) => question.id),
    [filteredQuestions]
  )
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
    mutationFn: questionApi.approve,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions", quizId] })
      toast.success("Question approved")
    },
  })

  const deleteQuestion = useMutation({
    mutationFn: questionApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions", quizId] })
      toast.success("Question deleted")
    },
  })

  const duplicateQuestion = useMutation({
    mutationFn: questionApi.duplicate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions", quizId] })
      toast.success("Question duplicated")
    },
  })

  const regenerateQuestion = useMutation({
    mutationFn: questionApi.regenerate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions", quizId] })
      toast.success("Question regenerated")
    },
    onError: () => toast.error("Question regeneration failed"),
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

  const approveUnapproved = useMutation({
    mutationFn: () => questionBulkApi.approveMany(unapprovedIds),
    onSuccess: () => {
      clear()
      queryClient.invalidateQueries({ queryKey: ["questions", quizId] })
      toast.success("All pending questions approved")
    },
    onError: () => toast.error("Bulk approve failed"),
  })

  const approveFilteredPending = useMutation({
    mutationFn: () => questionBulkApi.approveMany(pendingFilteredIds),
    onSuccess: () => {
      clear()
      queryClient.invalidateQueries({ queryKey: ["questions", quizId] })
      toast.success("Visible pending questions approved")
    },
    onError: () => toast.error("Approve visible pending failed"),
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

  return (
    <div className="min-h-[calc(100vh-220px)] overflow-hidden rounded-2xl border bg-background/95">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <p className="text-sm text-muted-foreground">Review questions inline with autosave and optimistic updates.</p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setMany(filteredIds)} disabled={filteredIds.length === 0}>
            Select visible ({filteredIds.length})
          </Button>
          <Button size="sm" variant="outline" onClick={clear}>
            Clear selection
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => approveUnapproved.mutate()}
            disabled={unapprovedIds.length === 0 || approveUnapproved.isPending}
          >
            {approveUnapproved.isPending ? "Approving..." : `Approve pending (${unapprovedIds.length})`}
          </Button>
          <Button size="sm" onClick={() => approveAll.mutate()} disabled={questions.length === 0 || approveAll.isPending}>
            {approveAll.isPending ? "Approving..." : `Approve all (${questions.length})`}
          </Button>
          <Button size="sm" variant="outline" onClick={() => createManualQuestion.mutate()} disabled={!sections[0]}>
            Add question
          </Button>
          <Button size="sm" variant="outline" onClick={toggleFocus}>
            {focusMode ? "Exit focus mode" : "Focus mode"}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0">
        {!focusMode && (
          <SectionSidebar
            sections={sections}
            questions={questions}
            active={activeSection}
            reviewFilter={reviewFilter}
            onChange={setActiveSection}
            onFilterChange={setReviewFilter}
            onSelectFiltered={() => setMany(filteredIds)}
            onClearSelection={clear}
            onApproveFilteredPending={() => approveFilteredPending.mutate()}
            approvingFilteredPending={approveFilteredPending.isPending}
          />
        )}
        <div className="flex min-h-0 flex-1 flex-col">
          <BulkActionsBar sections={sections} onDone={() => queryClient.invalidateQueries({ queryKey: ["questions", quizId] })} />
          {filteredQuestions.length === 0 ? (
            <div className="p-6">
              <p className="text-sm text-muted-foreground">No questions found for this quiz/section.</p>
              <Button className="mt-3" variant="outline" onClick={() => void refetchQuestions()}>
                Retry Fetch
              </Button>
            </div>
          ) : (
            <QuestionVirtualList
              questions={filteredQuestions}
              sections={sections}
              onPatch={patchQuestion}
              onApprove={(questionId) => approveQuestion.mutate(questionId)}
              onDelete={(questionId) => deleteQuestion.mutate(questionId)}
              onDuplicate={(questionId) => duplicateQuestion.mutate(questionId)}
              onRegenerate={(questionId) => regenerateQuestion.mutate(questionId)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
