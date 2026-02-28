"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SectionBuilder } from "@/features/quiz/creation/SectionBuilder"
import type { DraftSection } from "@/features/quiz/creation/SortableSectionCard"
import { quizApi } from "@/lib/api/quiz"
import { getApiErrorMessage } from "@/lib/api/error"
import { sectionApi } from "@/lib/api/section"
import { questionApi } from "@/lib/api/question"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const STORAGE_KEY = "quizzer_ai_creation_wizard"

interface WizardState {
  title: string
  description: string
  sourceText: string
  sections: DraftSection[]
}

const defaultSection: DraftSection = {
  id: crypto.randomUUID(),
  title: "Section 1",
  numberOfQuestions: 5,
  questionType: "MCQ",
  marksPerQuestion: 2,
  difficulty: "Medium",
  bloomLevel: "",
}

const initialState: WizardState = {
  title: "",
  description: "",
  sourceText: "",
  sections: [defaultSection],
}

function parseOptions(options: unknown): string[] {
  if (!options) return []
  if (Array.isArray(options)) return options.map(String)
  if (typeof options === "object") return Object.values(options as Record<string, unknown>).map(String)
  return []
}

export function QuizCreationWizard({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>(initialState)
  const [createdQuizId, setCreatedQuizId] = useState<string | null>(null)
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as WizardState
      setState(parsed)
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const steps = useMemo(() => ["Content Source", "Structure", "Processing", "Review"], [])

  const totalBlueprintQuestions = state.sections.reduce((sum, section) => sum + section.numberOfQuestions, 0)

  const processingMutation = useMutation({
    mutationFn: async () => {
      const quiz = await quizApi.create({
        title: state.title,
        description: state.description || "AI-generated quiz",
      })

      await Promise.all(
        state.sections.map((section) =>
          sectionApi.create(quiz.id, {
            title: section.title,
            total_marks: section.numberOfQuestions * section.marksPerQuestion,
          })
        )
      )

      await quizApi.generate(quiz.id, {
        extracted_text: state.sourceText,
        blueprint: {
          sections: state.sections,
        },
        professor_note: "AI-first generation flow",
      })

      return quiz.id
    },
    onSuccess: (quizId) => {
      setCreatedQuizId(quizId)
      setStep(2)
      setProcessingError(null)
      toast.success("AI generation started")
      queryClient.invalidateQueries({ queryKey: ["quizzes"] })
    },
    onError: () => toast.error("Failed to start AI generation"),
  })

  const { data: quizStatus } = useQuery({
    queryKey: ["quiz", createdQuizId],
    queryFn: () => quizApi.getById(createdQuizId as string),
    enabled: Boolean(createdQuizId),
    refetchInterval: 3000,
  })

  const { data: questions = [], refetch: refetchQuestions } = useQuery({
    queryKey: ["questions", createdQuizId],
    queryFn: () => questionApi.getByQuiz(createdQuizId as string),
    enabled: Boolean(createdQuizId) && step >= 2,
  })

  const { data: sections = [] } = useQuery({
    queryKey: ["sections", createdQuizId],
    queryFn: () => sectionApi.getByQuiz(createdQuizId as string),
    enabled: Boolean(createdQuizId) && step >= 2,
  })

  useEffect(() => {
    if (!quizStatus) return
    if (step !== 2) return
    if (quizStatus.ai_generation_status === "PROCESSING") return

    void (async () => {
      const res = await refetchQuestions()
      const fetched = res.data ?? []
      if (fetched.length > 0) {
        setProcessingError(null)
        setStep(3)
        return
      }
      setProcessingError("AI finished but no questions were saved. Retry generation or check backend worker logs.")
    })()
  }, [quizStatus, step, refetchQuestions])

  const updateQuestionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => questionApi.update(id, payload),
    onError: () => toast.error("Question update failed"),
  })

  const deleteQuestionMutation = useMutation({
    mutationFn: questionApi.delete,
    onSuccess: () => {
      toast.success("Question deleted")
      void refetchQuestions()
    },
  })

  const regenerateQuestionMutation = useMutation({
    mutationFn: questionApi.regenerate,
    onSuccess: () => {
      toast.success("Question regenerated")
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
      void refetchQuestions()
    },
    onError: () => toast.error("Failed to add question"),
  })

  const publishMutation = useMutation({
    mutationFn: () => quizApi.publish(createdQuizId as string),
    onSuccess: (data) => {
      toast.success("Quiz published")
      window.localStorage.removeItem(STORAGE_KEY)
      setPublishedUrl(data.public_url ?? null)
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, "Publish validation failed")),
  })

  const canStart = state.title.trim().length > 2 && state.sourceText.trim().length > 0 && state.sections.length > 0

  const allQuestionsApproved = questions.length > 0 && questions.every((q) => q.status === "APPROVED")

  const canFinalize = Boolean(
    createdQuizId &&
    questions.length >= totalBlueprintQuestions &&
    questions.every((q) => Number(q.marks) > 0 && q.question_text.trim().length > 0) &&
    allQuestionsApproved
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((label, index) => (
          <div
            key={label}
            className={`rounded-md px-3 py-1 text-xs ${
              step === index ? "bg-primary text-primary-foreground" : "bg-muted"
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Content Source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Quiz title"
              value={state.title}
              onChange={(event) => setState((prev) => ({ ...prev, title: event.target.value }))}
            />
            <Textarea
              placeholder="Description (optional)"
              value={state.description}
              onChange={(event) => setState((prev) => ({ ...prev, description: event.target.value }))}
            />

            <Textarea
              className="min-h-40"
              placeholder="Paste content to generate quiz questions..."
              value={state.sourceText}
              onChange={(event) => setState((prev) => ({ ...prev, sourceText: event.target.value }))}
            />

            <div className="flex justify-end">
              <Button onClick={() => setStep(1)} disabled={!canStart}>
                Next: Structure
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Structure Blueprint</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SectionBuilder sections={state.sections} onChange={(sections) => setState((prev) => ({ ...prev, sections }))} />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button onClick={() => processingMutation.mutate()} disabled={processingMutation.isPending || !canStart}>
                {processingMutation.isPending ? "Starting..." : "Start AI Processing"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>AI Processing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              AI generation is running. This screen auto-refreshes and switches to review once questions are generated.
            </p>
            {quizStatus ? (
              <div className="flex items-center gap-2">
                <span className="text-sm">Status:</span>
                <StatusBadge status={quizStatus.ai_generation_status} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Initializing job...</p>
            )}
            {processingError ? <p className="text-sm text-destructive">{processingError}</p> : null}
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setStep(3)} disabled={!createdQuizId}>
                Skip to Review
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review Generated Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Edit text, options, answer, marks, and regenerate individual questions.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => createManualQuestionMutation.mutate()} disabled={!sections[0]}>
                  Add manual question
                </Button>
                <Button onClick={() => setShowPublishConfirm(true)} disabled={!canFinalize || publishMutation.isPending}>
                  Finalize AI Quiz
                </Button>
              </div>
            </div>

            {!canFinalize && (
              <p className="text-xs text-amber-600">
                Validation pending: ensure generated count, marks, and question approvals are complete before publishing.
              </p>
            )}

            <div className="space-y-3">
              {questions.map((question) => {
                const options = parseOptions(question.options)
                return (
                  <div key={question.id} className="space-y-2 rounded-md border p-3">
                    <Textarea
                      value={question.question_text}
                      onChange={(event) =>
                        updateQuestionMutation.mutate({ id: question.id, payload: { question_text: event.target.value } })
                      }
                    />
                    <div className="grid gap-2 md:grid-cols-3">
                      <Input
                        type="number"
                        value={question.marks}
                        onChange={(event) =>
                          updateQuestionMutation.mutate({
                            id: question.id,
                            payload: { marks: Number(event.target.value || 0) },
                          })
                        }
                      />
                      <Select
                        value={question.correct_answer ?? ""}
                        onValueChange={(value) =>
                          updateQuestionMutation.mutate({ id: question.id, payload: { correct_answer: value } })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Correct answer" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((option, idx) => (
                            <SelectItem key={`${question.id}-${idx}`} value={option}>
                              {option}
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
                    <div className="space-y-2">
                      {options.map((option, idx) => (
                        <Input
                          key={`${question.id}-opt-${idx}`}
                          value={option}
                          onChange={(event) => {
                            const next = [...options]
                            next[idx] = event.target.value
                            updateQuestionMutation.mutate({ id: question.id, payload: { options: next } })
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" onClick={() => regenerateQuestionMutation.mutate(question.id)}>
                        Regenerate
                      </Button>
                      <Button variant="destructive" onClick={() => deleteQuestionMutation.mutate(question.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Quiz?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to publish this AI-generated quiz? You can still monitor attempts and results after publishing.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowPublishConfirm(false)
                publishMutation.mutate()
              }}
            >
              Confirm Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(publishedUrl)} onOpenChange={(open) => !open && setPublishedUrl(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quiz Published</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Public URL</p>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{publishedUrl ?? "-"}</div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (!publishedUrl) return
                void navigator.clipboard.writeText(publishedUrl)
                toast.success("Public URL copied")
              }}
            >
              Copy
            </Button>
            <Button
              onClick={() => {
                setPublishedUrl(null)
                onDone()
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
