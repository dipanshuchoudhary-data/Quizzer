"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { QuizCreationLayout } from "@/components/quiz/quiz-creation-layout"
import { ContentSource } from "@/components/quiz/content-source"
import { AIProcessing } from "@/components/quiz/ai-processing"
import { QuizReview } from "@/components/quiz/quiz-review"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { quizApi } from "@/lib/api/quiz"
import { aiApi } from "@/lib/api/ai"
import { getApiErrorMessage } from "@/lib/api/error"
import { SectionBuilder } from "@/features/quiz/creation/SectionBuilder"
import type { DraftSection } from "@/features/quiz/creation/SortableSectionCard"
import type { Document } from "@/types/document"

type SourceMode = "paste" | "files" | "links"
type GenerationMode = "auto" | "custom"
type SupportedQuestionType = "MCQ" | "True/False" | "Short Answer" | "Long Answer"

const AUTO_QUESTION_TYPES: SupportedQuestionType[] = ["MCQ", "True/False", "Short Answer", "Long Answer"]

const defaultSection: DraftSection = {
  id: crypto.randomUUID(),
  title: "Section 1",
  numberOfQuestions: 10,
  questionType: "MCQ",
  marksPerQuestion: 1,
  difficulty: "Medium",
  bloomLevel: "",
}

export default function QuizCreatePage() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState(0)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [quizId, setQuizId] = useState<string | null>(null)
  const [sourceMode, setSourceMode] = useState<SourceMode>("paste")
  const [sourceText, setSourceText] = useState("")
  const [sourceUrls, setSourceUrls] = useState<string[]>([])
  const [generationMode, setGenerationMode] = useState<GenerationMode>("auto")
  const [sections, setSections] = useState<DraftSection[]>([defaultSection])
  const [questionTarget, setQuestionTarget] = useState(10)
  const [selectedTypes, setSelectedTypes] = useState<SupportedQuestionType[]>(["MCQ"])
  const [jobId, setJobId] = useState<string | null>(null)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const [ingestState, setIngestState] = useState<"idle" | "processing" | "ready" | "failed">("idle")
  const [ingestMessage, setIngestMessage] = useState("")

  useEffect(() => {
    const source = searchParams.get("source")
    if (!source) return
    if (source === "import") {
      setSourceMode("files")
      return
    }
    if (source === "ai") {
      setSourceMode("paste")
      return
    }
    if (["paste", "files", "links"].includes(source)) {
      setSourceMode(source as SourceMode)
    }
  }, [searchParams])

  const createQuizMutation = useMutation({
    mutationFn: () => quizApi.create({ title, description: description || "AI-generated quiz" }),
    onSuccess: (quiz) => {
      setQuizId(quiz.id)
      setStep(1)
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, "Failed to create quiz")),
  })

  const updateQuizMutation = useMutation({
    mutationFn: () => quizApi.update(quizId as string, { title, description }),
  })

  const documentsQuery = useQuery({
    queryKey: ["ai-source-documents", quizId],
    queryFn: () => aiApi.getSourceDocuments(quizId as string),
    enabled: Boolean(quizId),
    refetchInterval: sourceMode === "files" ? 3000 : false,
  })

  const { data: jobStatus } = useQuery({
    queryKey: ["ai-job", jobId],
    queryFn: () => aiApi.getJobStatus(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: jobId ? 3000 : false,
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!quizId) throw new Error("Quiz not created")
      const blueprint =
        generationMode === "auto"
          ? {
              sections: [
                {
                  title: "Section 1",
                  number_of_questions: questionTarget,
                  question_types: selectedTypes,
                  marks_per_question: 1,
                },
              ],
              auto_detect_structure: true,
              source_mode: sourceMode,
              source_references: sourceUrls,
            }
          : {
              sections,
              source_mode: sourceMode,
              source_references: sourceUrls,
            }

      const response = await aiApi.generateQuiz(quizId, {
        blueprint,
        professor_note: "AI workflow generation",
        source_mode: sourceMode,
      })
      return response
    },
    onSuccess: (data) => {
      setJobId(data.job_id)
      setStep(3)
      setProcessingError(null)
      toast.success("AI processing started")
    },
    onError: (error: unknown) => {
      setProcessingError(getApiErrorMessage(error, "Failed to start processing"))
      toast.error(getApiErrorMessage(error, "Failed to start processing"))
    },
  })

  const toggleQuestionType = (type: SupportedQuestionType) => {
    setSelectedTypes((current) => {
      const exists = current.includes(type)
      if (exists) {
        if (current.length === 1) {
          toast.error("Select at least one question type")
          return current
        }
        return current.filter((item) => item !== type)
      }
      return [...current, type]
    })
  }


  useEffect(() => {
    if (!jobStatus) return
    if (jobStatus.status === "COMPLETED") {
      setStep(4)
    }
    if (jobStatus.status === "FAILED") {
      setProcessingError("AI processing failed. Review sources and retry.")
    }
  }, [jobStatus])

  const handleNextFromMetadata = () => {
    if (title.trim().length < 1) {
      toast.error("Quiz title is required")
      return
    }
    if (!quizId) {
      createQuizMutation.mutate()
    } else {
      updateQuizMutation.mutate()
      setStep(1)
    }
  }

  const handleSaveSource = async () => {
    if (!quizId) {
      toast.error("Create a quiz first")
      return
    }
    try {
      if (sourceMode === "paste") {
        if (!sourceText.trim()) {
          toast.error("Paste content to continue")
          return
        }
        setIngestState("processing")
        setIngestMessage("Validating pasted content…")
        await aiApi.uploadSourceText(quizId, sourceText.trim())
        setIngestState("ready")
        setIngestMessage("Content ready for AI processing.")
      }
      if (sourceMode === "links") {
        if (sourceUrls.length === 0) {
          toast.error("Add at least one URL")
          return
        }
        setIngestState("processing")
        setIngestMessage("Fetching and extracting website content…")
        await aiApi.uploadSourceUrls(quizId, sourceUrls)
        setIngestState("ready")
        setIngestMessage("Links processed successfully.")
      }
      setStep(2)
    } catch (error: unknown) {
      setIngestState("failed")
      setIngestMessage(getApiErrorMessage(error, "Content ingestion failed."))
      toast.error(getApiErrorMessage(error, "Failed to ingest content"))
    }
  }

  const documents = (documentsQuery.data as { documents?: Document[] } | undefined)?.documents ?? []

  const canProceedSources =
    (sourceMode === "paste" && sourceText.trim().length > 20) ||
    (sourceMode === "links" && sourceUrls.length > 0) ||
    (sourceMode === "files" && documents.length > 0)
  const filesProcessing = documents.some((doc) => doc.extraction_status !== "COMPLETED")
  const filesFailed = documents.some((doc) => doc.extraction_status === "FAILED")

  const progress = Number(jobStatus?.metadata?.progress ?? 0)
  const stage = (jobStatus?.metadata?.stage as string | undefined) ?? "parsing_source"
  const hasTitle = title.trim().length > 0

  useEffect(() => {
    if (sourceMode !== "files") return
    if (documents.length === 0) {
      setIngestState("idle")
      setIngestMessage("Waiting for file uploads…")
      return
    }
    if (filesFailed) {
      setIngestState("failed")
      setIngestMessage("Some files failed to process. Remove or re-upload them.")
      return
    }
    if (filesProcessing) {
      setIngestState("processing")
      setIngestMessage("Extracting content from files…")
      return
    }
    setIngestState("ready")
    setIngestMessage("All files processed successfully.")
  }, [documents.length, filesFailed, filesProcessing, sourceMode])

  return (
    <QuizCreationLayout
      step={step}
      title="AI Quiz Creation Workflow"
      subtitle="Create, ingest content, configure AI, and review questions in one streamlined flow."
      contentClassName={step === 4 ? "min-h-[calc(100vh-220px)] overflow-hidden" : undefined}
    >
      {step === 0 ? (
        <div className="mx-auto w-full max-w-[1000px] space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Quiz Details</h2>
            <p className="text-sm text-muted-foreground">Set the title and optional description before adding content sources.</p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="quiz-title" className="text-sm font-medium text-foreground">
                Quiz Title
              </label>
              <Input
                id="quiz-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g., Fundamentals of Data Structures - Week 1"
                aria-invalid={!hasTitle}
                className="h-11"
              />
              {!hasTitle ? (
                <p className="text-xs text-destructive">Title is required to continue.</p>
              ) : (
                <p className="text-xs text-muted-foreground">Use a clear, specific title for quick recognition.</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="quiz-description" className="text-sm font-medium text-foreground">
                Description (Optional)
              </label>
              <Textarea
                id="quiz-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional: Add scope, learner level, or key topics to guide quiz generation."
                className="min-h-[112px]"
              />
              <p className="text-xs text-muted-foreground">Example: Covers arrays, linked lists, stacks, and queue operations.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              onClick={handleNextFromMetadata}
              disabled={createQuizMutation.isPending || !hasTitle}
              className="h-11 w-full px-6 text-sm font-semibold sm:w-auto"
            >
              {createQuizMutation.isPending ? "Creating..." : "Continue →"}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-6">
          <ContentSource
            mode={sourceMode}
            onModeChange={setSourceMode}
            textValue={sourceText}
            onTextChange={setSourceText}
            urls={sourceUrls}
            onUrlsChange={setSourceUrls}
            documents={documents}
            onFilesUpload={async (files) => {
              if (!quizId) return
              if (files.length === 0) return
              setIngestState("processing")
              setIngestMessage("Uploading files and starting extraction…")
              await aiApi.uploadSourceFiles(quizId, files)
              setIngestState("processing")
              setIngestMessage("Files uploaded. Extraction running…")
              toast.success("Files uploaded. Processing started.")
            }}
          />
          <div className="rounded-2xl border bg-background/70 p-4 text-sm">
            <p className="font-semibold text-foreground">Content processing status</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {sourceMode === "files"
                ? "Files must finish extraction before you can continue."
                : "Content is validated before moving to AI options."}
            </p>
            <div className="mt-3 rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {ingestMessage || "Waiting for content input…"}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={() => setStep(0)} className="h-11 w-full sm:w-auto">
              Back
            </Button>
            {sourceMode === "files" ? (
              <Button
                onClick={() => setStep(2)}
                disabled={documents.length === 0 || filesProcessing || filesFailed}
                className="h-11 w-full sm:w-auto"
              >
                {filesFailed
                  ? "Resolve failed files"
                  : filesProcessing
                  ? "Processing files…"
                  : "Continue"}
              </Button>
            ) : (
              <Button onClick={handleSaveSource} disabled={!canProceedSources || ingestState === "processing"} className="h-11 w-full sm:w-auto">
                {ingestState === "processing" ? "Processing…" : "Continue"}
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setGenerationMode("auto")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  setGenerationMode("auto")
                }
              }}
              className={`rounded-2xl border p-4 text-left transition-all ${generationMode === "auto" ? "border-primary/40 bg-primary/5" : "hover:-translate-y-1 hover:border-primary/30 hover:bg-muted/40"}`}
            >
              <p className="text-sm font-semibold text-foreground">Start AI Processing</p>
              <p className="text-xs text-muted-foreground">Set total questions and let AI distribute selected question types automatically.</p>
              {generationMode === "auto" ? (
                <div className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="total-questions" className="text-xs font-medium text-foreground">
                      Total Questions
                    </label>
                    <Input
                      id="total-questions"
                      type="number"
                      min={1}
                      value={questionTarget}
                      onChange={(event) => setQuestionTarget(Math.max(1, Number(event.target.value || 1)))}
                      placeholder="Total questions"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground">Question Types</p>
                    <div className="flex flex-wrap gap-2">
                      {AUTO_QUESTION_TYPES.map((type) => {
                        const isSelected = selectedTypes.includes(type)
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={(event) => {
                              event.preventDefault()
                              toggleQuestionType(type)
                            }}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${isSelected ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}
                            aria-pressed={isSelected}
                          >
                            {type}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => setGenerationMode("custom")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  setGenerationMode("custom")
                }
              }}
              className={`rounded-2xl border p-4 text-left transition-all ${generationMode === "custom" ? "border-primary/40 bg-primary/5" : "hover:-translate-y-1 hover:border-primary/30 hover:bg-muted/40"}`}
            >
              <p className="text-sm font-semibold text-foreground">Custom Structure</p>
              <p className="text-xs text-muted-foreground">Configure question counts, types, and marks.</p>
            </div>
          </div>

          {generationMode === "custom" ? (
            <SectionBuilder sections={sections} onChange={setSections} />
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={() => setStep(1)} className="h-11 w-full sm:w-auto">
              Back
            </Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || (generationMode === "auto" && (questionTarget <= 0 || selectedTypes.length === 0))}
              className="h-11 w-full sm:w-auto"
            >
              {generateMutation.isPending ? "Starting..." : "Start AI Processing"}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-6">
          <AIProcessing
            status={jobStatus?.status ?? "PENDING"}
            progress={progress}
            stage={stage}
            error={processingError}
          />
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setStep(4)} disabled={!quizId} className="h-11 w-full sm:w-auto">
              Skip to Review
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 && quizId ? <QuizReview quizId={quizId} /> : null}
    </QuizCreationLayout>
  )
}
