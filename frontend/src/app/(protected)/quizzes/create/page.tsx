"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { quizApi } from "@/lib/api/quiz"
import { aiApi, type YouTubeChoiceRequired } from "@/lib/api/ai"
import { getApiErrorMessage } from "@/lib/api/error"
import { SectionBuilder } from "@/features/quiz/creation/SectionBuilder"
import type { DraftSection } from "@/features/quiz/creation/SortableSectionCard"
import type { Document } from "@/types/document"
import {
  assignQuizToCluster,
  buildCourseClusterOptions,
  loadCourseLibrary,
  parseCourseClusterValue,
} from "@/features/quiz/organization/storage"
import { YouTubeChoiceDialog } from "@/features/quiz/ai/YouTubeChoiceDialog"


type SourceMode = "paste" | "files" | "links"
type GenerationMode = "auto" | "custom"
type AutoProcessingMode = "source_first" | "guided"
type SupportedQuestionType = "MCQ" | "True/False" | "Short Answer" | "Long Answer"

const AUTO_QUESTION_TYPES: SupportedQuestionType[] = ["MCQ", "True/False", "Short Answer", "Long Answer"]
const EMPTY_DOCUMENTS: Document[] = []
const QUIZ_CREATE_DRAFT_STORAGE_KEY = "quizzer_quiz_create_flow_v1"
const MAX_FLOW_STEP = 4

function createDefaultSection(): DraftSection {
  return {
    id: crypto.randomUUID(),
    title: "Section 1",
    numberOfQuestions: 10,
    questionType: "MCQ",
    marksPerQuestion: 1,
    difficulty: "Medium",
    bloomLevel: "",
  }
}

function resolveSourceMode(sourceParam: string | null): SourceMode | null {
  if (!sourceParam) return null
  if (sourceParam === "import") return "files"
  if (sourceParam === "ai") return "paste"
  if (sourceParam === "paste" || sourceParam === "files" || sourceParam === "links") return sourceParam
  return null
}

interface QuizCreateDraftState {
  step: number
  title: string
  description: string
  quizId: string | null
  sourceMode: SourceMode
  sourceText: string
  sourceUrls: string[]
  generationMode: GenerationMode
  autoProcessingMode: AutoProcessingMode
  sections: DraftSection[]
  questionTarget: number
  selectedTypes: SupportedQuestionType[]
  jobId: string | null
  selectedClusterValue: string
}

function normalizeStep(step: unknown) {
  const parsed = Number(step)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(MAX_FLOW_STEP, Math.floor(parsed)))
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
  const [autoProcessingMode, setAutoProcessingMode] = useState<AutoProcessingMode>("source_first")
  const [sections, setSections] = useState<DraftSection[]>([createDefaultSection()])
  const [questionTarget, setQuestionTarget] = useState(10)
  const [selectedTypes, setSelectedTypes] = useState<SupportedQuestionType[]>(["MCQ"])
  const [selectedClusterValue, setSelectedClusterValue] = useState("")
  const [jobId, setJobId] = useState<string | null>(null)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const [ingestState, setIngestState] = useState<"idle" | "processing" | "ready" | "failed">("idle")
  const [ingestMessage, setIngestMessage] = useState("")
  const [ytChoiceData, setYtChoiceData] = useState<YouTubeChoiceRequired | null>(null)
  const trackedUploadIdsRef = useRef<Set<string>>(new Set())
  const fileToastStateRef = useRef({
    uploadNotified: false,
    started: false,
    completed: false,
    failed: false,
  })
  const previousJobStatusRef = useRef<string | null>(null)
  const jobToastStateRef = useRef({
    started: false,
    completed: false,
    failed: false,
  })
  const hasRestoredDraftRef = useRef(false)
  const hydratedDraftRef = useRef(false)
  const forceNew = searchParams.get("new") === "1"
  const resetFlowForNewQuiz = useCallback(() => {
    const sourceFromQuery = resolveSourceMode(searchParams.get("source"))
    const nextSourceMode = sourceFromQuery ?? "paste"

    setStep(0)
    setTitle("")
    setDescription("")
    setQuizId(null)
    setSourceMode(nextSourceMode)
    setSourceText("")
    setSourceUrls([])
    setGenerationMode("auto")
    setAutoProcessingMode("source_first")
    setSections([createDefaultSection()])
    setQuestionTarget(10)
    setSelectedTypes(["MCQ"])
    setSelectedClusterValue("")
    setJobId(null)
    setProcessingError(null)
    setIngestState("idle")
    setIngestMessage("")
    trackedUploadIdsRef.current = new Set()
    fileToastStateRef.current = {
      uploadNotified: false,
      started: false,
      completed: false,
      failed: false,
    }
    previousJobStatusRef.current = null
    jobToastStateRef.current = {
      started: false,
      completed: false,
      failed: false,
    }

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(QUIZ_CREATE_DRAFT_STORAGE_KEY)
    }
  }, [searchParams])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (forceNew) {
      window.localStorage.removeItem(QUIZ_CREATE_DRAFT_STORAGE_KEY)
      hydratedDraftRef.current = true
      return
    }
    const savedRaw = window.localStorage.getItem(QUIZ_CREATE_DRAFT_STORAGE_KEY)
    if (!savedRaw) {
      hydratedDraftRef.current = true
      return
    }

    try {
      const parsed = JSON.parse(savedRaw) as Partial<QuizCreateDraftState>
      const restoredStep = normalizeStep(parsed.step)
      const restoredQuizId = typeof parsed.quizId === "string" && parsed.quizId.trim().length > 0 ? parsed.quizId : null
      const safeStep = restoredQuizId ? restoredStep : 0

      setStep(safeStep)
      if (typeof parsed.title === "string") setTitle(parsed.title)
      if (typeof parsed.description === "string") setDescription(parsed.description)
      setQuizId(restoredQuizId)
      if (parsed.sourceMode === "paste" || parsed.sourceMode === "files" || parsed.sourceMode === "links") {
        setSourceMode(parsed.sourceMode)
      }
      if (typeof parsed.sourceText === "string") setSourceText(parsed.sourceText)
      if (Array.isArray(parsed.sourceUrls)) {
        setSourceUrls(parsed.sourceUrls.filter((item): item is string => typeof item === "string" && item.trim().length > 0))
      }
      if (parsed.generationMode === "auto" || parsed.generationMode === "custom") {
        setGenerationMode(parsed.generationMode)
      }
      if (parsed.autoProcessingMode === "source_first" || parsed.autoProcessingMode === "guided") {
        setAutoProcessingMode(parsed.autoProcessingMode)
      }
      if (Array.isArray(parsed.sections) && parsed.sections.length > 0) {
        setSections(parsed.sections)
      }
      if (typeof parsed.questionTarget === "number" && Number.isFinite(parsed.questionTarget)) {
        setQuestionTarget(Math.max(1, Math.floor(parsed.questionTarget)))
      }
      if (typeof parsed.selectedClusterValue === "string") {
        setSelectedClusterValue(parsed.selectedClusterValue)
      }
      if (Array.isArray(parsed.selectedTypes) && parsed.selectedTypes.length > 0) {
        const filteredTypes = parsed.selectedTypes.filter((item): item is SupportedQuestionType => AUTO_QUESTION_TYPES.includes(item))
        if (filteredTypes.length > 0) {
          setSelectedTypes(filteredTypes)
        }
      }
      if (typeof parsed.jobId === "string" && parsed.jobId.trim().length > 0) {
        setJobId(parsed.jobId)
      }

      hasRestoredDraftRef.current = true
    } catch {
      window.localStorage.removeItem(QUIZ_CREATE_DRAFT_STORAGE_KEY)
    } finally {
      hydratedDraftRef.current = true
    }
  }, [forceNew])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!hydratedDraftRef.current) return

    const draftState: QuizCreateDraftState = {
      step,
      title,
      description,
      quizId,
      sourceMode,
      sourceText,
      sourceUrls,
      generationMode,
      autoProcessingMode,
      sections,
      questionTarget,
      selectedTypes,
      selectedClusterValue,
      jobId,
    }

    window.localStorage.setItem(QUIZ_CREATE_DRAFT_STORAGE_KEY, JSON.stringify(draftState))
  }, [autoProcessingMode, description, generationMode, jobId, questionTarget, quizId, sections, selectedClusterValue, selectedTypes, sourceMode, sourceText, sourceUrls, step, title])

  const courseClusterOptions = buildCourseClusterOptions(loadCourseLibrary())

  useEffect(() => {
    const sourceModeFromQuery = resolveSourceMode(searchParams.get("source"))
    if (!sourceModeFromQuery) return
    if (hasRestoredDraftRef.current) return
    setSourceMode(sourceModeFromQuery)
  }, [searchParams])

  useEffect(() => {
    if (!hydratedDraftRef.current) return
    if (!quizId) return

    let active = true
    void (async () => {
      try {
        const quiz = await quizApi.getById(quizId)
        if (!active) return
        if (quiz.is_published) {
          resetFlowForNewQuiz()
        }
      } catch {
        // Ignore lookup failures and keep current draft state.
      }
    })()

    return () => {
      active = false
    }
  }, [quizId, resetFlowForNewQuiz])

  const createQuizMutation = useMutation({
    mutationFn: () => quizApi.create({ title, description: description || "AI-generated quiz" }),
    onSuccess: (quiz) => {
      setQuizId(quiz.id)
      const selectedCluster = parseCourseClusterValue(selectedClusterValue)
      if (selectedCluster) {
        assignQuizToCluster(quiz.id, selectedCluster)
      }
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
    refetchInterval: (query) => {
      if (sourceMode !== "files") return false
      if (step !== 1) return false
      const docs = (query.state.data as { documents?: Document[] } | undefined)?.documents ?? []
      if (docs.length === 0) return 3000
      const allCompleted = docs.every((doc) => doc.extraction_status === "COMPLETED" || doc.extraction_status === "FAILED")
      return allCompleted ? false : 3000
    },
  })

  const { data: jobStatus } = useQuery({
    queryKey: ["ai-job", jobId],
    queryFn: () => aiApi.getJobStatus(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      if (!jobId) return false
      const status = query.state.data?.status
      if (status === "COMPLETED" || status === "FAILED") return false
      return 3000
    },
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!quizId) throw new Error("Quiz not created")
      const blueprint =
        generationMode === "auto"
          ? autoProcessingMode === "guided"
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
                // Default auto mode: infer structure from extracted source first.
                sections: [
                  {
                    title: "Auto Detect",
                    number_of_questions: 5,
                    question_types: ["MCQ"],
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

      if (!response || !response.job_id) {
        throw new Error("Invalid response: missing job_id")
      }

      return response
    },
    onSuccess: (data) => {
      setJobId(data.job_id)
      setProcessingError(null)
      previousJobStatusRef.current = null
      jobToastStateRef.current = {
        started: false,
        completed: false,
        failed: false,
      }
      setStep(3)
    },
    onError: (error: unknown) => {
      const errorMessage = getApiErrorMessage(error, "Failed to start processing")
      setProcessingError(errorMessage)
      toast.error(errorMessage)
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
    const status = jobStatus.status
    const previousStatus = previousJobStatusRef.current

    if (status === "PROCESSING" && !jobToastStateRef.current.started) {
      toast.success("AI processing started")
      jobToastStateRef.current.started = true
    }

    if (status === "COMPLETED" && previousStatus !== "COMPLETED" && !jobToastStateRef.current.completed) {
      toast.success("AI processing completed successfully")
      jobToastStateRef.current.completed = true
      setStep(4)
    }

    if (status === "FAILED" && previousStatus !== "FAILED" && !jobToastStateRef.current.failed) {
      setProcessingError("AI processing failed. Review sources and retry.")
      toast.error(String(jobStatus.metadata?.error || "AI processing failed"))
      jobToastStateRef.current.failed = true
    }

    previousJobStatusRef.current = status
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
        setIngestMessage("Fetching and extracting content…")
        const result = await aiApi.uploadSourceUrls(quizId, sourceUrls)

        // YouTube long-video choice required
        if (result.status === "CHOICE_REQUIRED") {
          setIngestState("idle")
          setIngestMessage("")
          setYtChoiceData(result as YouTubeChoiceRequired)
          return  // don't advance step yet
        }

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


  const documents = (documentsQuery.data as { documents?: Document[] } | undefined)?.documents ?? EMPTY_DOCUMENTS

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

  useEffect(() => {
    if (sourceMode !== "files") return

    const trackedIds = trackedUploadIdsRef.current
    if (trackedIds.size === 0) return

    const trackedDocuments = documents.filter((doc) => trackedIds.has(doc.id))
    if (trackedDocuments.length === 0) return

    if (!fileToastStateRef.current.uploadNotified) {
      toast.success(trackedIds.size === 1 ? "File uploaded successfully" : "Files uploaded successfully")
      fileToastStateRef.current.uploadNotified = true
    }

    const hasFailure = trackedDocuments.some((doc) => doc.extraction_status === "FAILED")
    const hasProcessing = trackedDocuments.some((doc) => doc.extraction_status === "PROCESSING")
    const allFinished = trackedDocuments.every((doc) => doc.extraction_status === "COMPLETED")

    if (hasFailure && !fileToastStateRef.current.failed) {
      toast.error("File processing failed. Remove or re-upload the affected file.")
      fileToastStateRef.current.failed = true
      trackedUploadIdsRef.current = new Set()
      return
    }

    if (hasProcessing && !fileToastStateRef.current.started && !allFinished) {
      toast.success("File processing started")
      fileToastStateRef.current.started = true
    }

    if (allFinished && !fileToastStateRef.current.completed) {
      toast.success("File processing completed successfully")
      fileToastStateRef.current.completed = true
      trackedUploadIdsRef.current = new Set()
    }
  }, [documents, sourceMode])

  return (
    <>
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

            {courseClusterOptions.length > 0 ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Cluster (Batch/Course)</label>
                <Select value={selectedClusterValue || "__none__"} onValueChange={(value) => setSelectedClusterValue(value === "__none__" ? "" : value)}>
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue placeholder="Select cluster (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No cluster</SelectItem>
                    {courseClusterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  New quiz will be auto-grouped under selected course/unit.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                No clusters found yet. Create course clusters from the Exams page when needed.
              </div>
            )}
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
              const response = await aiApi.uploadSourceFiles(quizId, files)
              trackedUploadIdsRef.current = new Set(response.documents.map((document) => document.id))
              fileToastStateRef.current = {
                uploadNotified: false,
                started: false,
                completed: false,
                failed: false,
              }
              setIngestState("processing")
              setIngestMessage("Files uploaded. Extraction running…")
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
              <p className="text-sm font-semibold text-foreground">Auto AI Processing</p>
              <p className="text-xs text-muted-foreground">Choose source-first extraction or guided count/type generation.</p>
              {generationMode === "auto" ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault()
                        setAutoProcessingMode("source_first")
                      }}
                      className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${autoProcessingMode === "source_first" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/35 hover:text-foreground"}`}
                    >
                      <p className="font-semibold">Source-first (Recommended)</p>
                      <p className="mt-1 text-[11px] opacity-90">Use extracted file/source structure and preserve detected types.</p>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault()
                        setAutoProcessingMode("guided")
                      }}
                      className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${autoProcessingMode === "guided" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/35 hover:text-foreground"}`}
                    >
                      <p className="font-semibold">Guided generation</p>
                      <p className="mt-1 text-[11px] opacity-90">Set explicit number of questions and question types.</p>
                    </button>
                  </div>

                  {autoProcessingMode === "source_first" ? (
                    <div className="rounded-xl border bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                      AI will extract as many valid questions as possible from your source and keep detected type diversity.
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label htmlFor="total-questions" className="text-xs font-medium text-foreground">
                          Questions to Generate
                        </label>
                        <Input
                          id="total-questions"
                          type="number"
                          min={1}
                          value={questionTarget}
                          onChange={(event) => setQuestionTarget(Math.max(1, Number(event.target.value || 1)))}
                          placeholder="Number of questions"
                        />
                        <p className="text-xs text-muted-foreground">
                          Target number of questions AI will create from your content.
                        </p>
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
                    </>
                  )}
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
              onClick={() => {
                if (generateMutation.isPending) return
                generateMutation.mutate()
              }}
              disabled={
                generateMutation.isPending ||
                (generationMode === "auto" && autoProcessingMode === "guided" && (questionTarget <= 0 || selectedTypes.length === 0)) ||
                (generationMode === "custom" && sections.length === 0)
              }
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

    {/* YouTube long-video choice dialog */}
    {ytChoiceData && quizId && (
      <YouTubeChoiceDialog
        open={Boolean(ytChoiceData)}
        quizId={quizId}
        choiceData={ytChoiceData}
        onSuccess={() => {
          setIngestState("ready")
          setIngestMessage("YouTube content processed successfully.")
          setStep(2)
        }}
        onClose={() => {
          setYtChoiceData(null)
          setIngestState("idle")
          setIngestMessage("")
        }}
      />
    )}
  </>
  )
}
