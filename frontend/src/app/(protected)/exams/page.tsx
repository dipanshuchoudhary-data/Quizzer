"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Activity,
  ArrowUpDown,
  CheckSquare,
  Clock3,
  FileText,
  Filter,
  FolderOpen,
  PencilLine,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react"
import { quizApi } from "@/lib/api/quiz"
import { dashboardApi } from "@/lib/api/dashboard"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { PageHeader, SectionHeader, pageCardClass, pageCardInteractiveClass, pageIcons } from "@/components/page/page-system"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip } from "@/components/ui/tooltip"

function formatUpdatedAt(updatedAt?: string) {
  if (!updatedAt) return "Updated recently"
  const parsed = new Date(updatedAt)
  if (Number.isNaN(parsed.getTime())) return "Updated recently"
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsed)
}

type ExamFilter = "ALL" | "LIVE" | "PUBLISHED" | "DRAFT" | "PROCESSING"
type SortOption = "updated" | "created" | "alphabetical"

function normalizeJobProgress(progress: number) {
  const normalized = progress <= 1 ? progress * 100 : progress
  return Math.min(100, Math.max(0, normalized))
}

function statusBadgeClasses(status: ExamFilter | "COMPLETED") {
  if (status === "LIVE") return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
  if (status === "PUBLISHED") return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
  if (status === "PROCESSING") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200"
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
  return "bg-muted text-foreground"
}

function getReadinessProgress(questionCount: number, hasDuration: boolean, isPublished: boolean) {
  let score = 0
  if (questionCount > 0) score += 40
  if (questionCount >= 10) score += 20
  if (hasDuration) score += 20
  if (isPublished) score += 20
  return Math.min(100, score)
}

export default function ExamsPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<ExamFilter>("ALL")
  const [sortBy, setSortBy] = useState<SortOption>("updated")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)

  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ["quizzes"],
    queryFn: quizApi.getAll,
  })

  const { data: liveData } = useQuery({
    queryKey: ["dashboard-live-exams"],
    queryFn: dashboardApi.getLiveExams,
    staleTime: 15_000,
  })

  const { data: summary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: dashboardApi.getSummary,
    staleTime: 30_000,
  })

  const liveQuizIds = useMemo(() => new Set(liveData?.items.map((item) => item.quiz_id)), [liveData])
  const runningJobs = summary?.running_jobs ?? []
  const runningJobsByQuizId = useMemo(
    () => new Map(runningJobs.map((job) => [job.quiz_id, job])),
    [runningJobs]
  )

  const visibleQuizzes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const filtered = quizzes.filter((quiz) => {
      const isLive = liveQuizIds.has(quiz.id)
      const isPublished = Boolean(quiz.is_published)
      const hasProcessing = runningJobsByQuizId.has(quiz.id)
      const status: ExamFilter = hasProcessing
        ? "PROCESSING"
        : isLive
        ? "LIVE"
        : isPublished
        ? "PUBLISHED"
        : "DRAFT"

      const matchesFilter = filter === "ALL" ? true : filter === status
      const matchesQuery =
        query.length === 0 ||
        (quiz.title ?? "").toLowerCase().includes(query)

      return matchesFilter && matchesQuery
    })

    // Sort the filtered results
    return filtered.sort((a, b) => {
      if (sortBy === "alphabetical") {
        return (a.title ?? "").localeCompare(b.title ?? "")
      }
      if (sortBy === "created") {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
        return dateB - dateA
      }
      // Default: updated
      const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0
      return dateB - dateA
    })
  }, [filter, liveQuizIds, quizzes, runningJobsByQuizId, searchQuery, sortBy])

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => quizApi.deleteById(id)))
    },
    onSuccess: () => {
      toast.success(`${selectedIds.size} exam(s) deleted successfully`)
      queryClient.invalidateQueries({ queryKey: ["quizzes"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] })
      setSelectedIds(new Set())
      setShowBulkDeleteDialog(false)
    },
    onError: () => {
      toast.error("Failed to delete some exams")
      setShowBulkDeleteDialog(false)
    },
  })

  // Selection handlers
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(visibleQuizzes.map((q) => q.id)))
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow="Exams"
        title="Manage and monitor exams"
        subtitle="Track live, published, processing, and draft quizzes from one operational workspace."
        actions={
          <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:w-auto">
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search exams"
                className="w-full sm:w-56"
                aria-label="Search exams"
              />
              <Select value={filter} onValueChange={(value) => setFilter(value as ExamFilter)}>
                <SelectTrigger className="w-[156px]">
                  <Filter className="mr-2 size-4 text-muted-foreground" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="LIVE">Live</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PROCESSING">Processing</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="w-[140px]">
                  <ArrowUpDown className="mr-2 size-4 text-muted-foreground" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated">Last Updated</SelectItem>
                  <SelectItem value="created">Date Created</SelectItem>
                  <SelectItem value="alphabetical">Alphabetical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-full border bg-muted px-3 py-1 text-xs font-medium text-foreground">
              {visibleQuizzes.length} visible / {quizzes.length} total
            </div>
          </div>
        }
      />

      {runningJobs.length > 0 ? (
        <div id="ai-jobs" className={cn(pageCardClass, "dashboard-fade-up")} style={{ animationDelay: "60ms" }}>
          <div className="flex items-center justify-between">
            <SectionHeader title="Insights" description="Live AI generation progress linked to exam workspaces." icon={Sparkles} />
          </div>

          <div className="mt-4 -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
            {runningJobs.map((job, index) => {
              const progress = normalizeJobProgress(job.progress)
              const isComplete = progress >= 100
              return (
                <div
                  key={job.id}
                  className="dashboard-fade-up min-w-[270px] snap-start rounded-2xl border bg-background p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-md"
                  style={{ animationDelay: `${90 + index * 40}ms` }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{job.quiz_title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{job.stage}</p>
                    </div>
                    <Badge className={statusBadgeClasses(isComplete ? "COMPLETED" : "PROCESSING")}>
                      {Math.round(progress)}%
                    </Badge>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500 ease-in-out",
                        isComplete ? "bg-emerald-500" : "bg-blue-500"
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-end">
                    <Link
                      href={`/quiz/${job.quiz_id}`}
                      className="text-xs font-medium text-foreground transition-colors hover:text-primary"
                    >
                      View details
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader title="Operational Snapshot" description="Exams organized by readiness, status, and immediate actions." icon={pageIcons.exams} />

          {/* Bulk Actions Bar */}
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 ? (
              <>
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                >
                  <X className="mr-1.5 size-4" />
                  Clear
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowBulkDeleteDialog(true)}
                >
                  <Trash2 className="mr-1.5 size-4" />
                  Delete Selected
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={visibleQuizzes.length === 0}
              >
                <CheckSquare className="mr-1.5 size-4" />
                Select All
              </Button>
            )}
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`exam-skeleton-${index}`}
                className={cn("dashboard-fade-up", pageCardClass)}
                style={{ animationDelay: `${120 + index * 50}ms` }}
              >
                <div className="skeleton h-4 w-32" />
                <div className="mt-4 skeleton h-6 w-16" />
                <div className="mt-3 skeleton h-3 w-24" />
              </div>
            ))
          : visibleQuizzes.map((quiz, index) => {
              const isLive = liveQuizIds.has(quiz.id)
              const isPublished = Boolean(quiz.is_published)
              const linkedJob = runningJobsByQuizId.get(quiz.id)
              const status: ExamFilter = linkedJob ? "PROCESSING" : isLive ? "LIVE" : isPublished ? "PUBLISHED" : "DRAFT"
              const questionCount = quiz.question_count ?? 0
              const durationLabel = quiz.duration_minutes ? `${quiz.duration_minutes} min` : "No time limit"
              const readiness = getReadinessProgress(questionCount, Boolean(quiz.duration_minutes), isPublished)
              const isSelected = selectedIds.has(quiz.id)
              const openExamId = isPublished && quiz.public_id ? quiz.public_id : quiz.id
              const openExamHref = `/exam/${openExamId}`

              // Progress bar color: green=ready (80%+), yellow=in-progress (40-79%), red=needs attention (<40%)
              const progressBarColor =
                readiness >= 80
                  ? "bg-emerald-500"
                  : readiness >= 40
                  ? "bg-amber-500"
                  : "bg-rose-500"

              // Tooltip content for quick preview
              const tooltipPreview = (
                <span>
                  {questionCount} questions | {durationLabel} | {status}
                  {questionCount === 0 && " - Add questions to get started"}
                </span>
              )

              return (
                <div
                  key={quiz.id}
                  className={cn(
                    "dashboard-fade-up group relative",
                    pageCardInteractiveClass,
                    "hover:border-primary/30 hover:shadow-lg",
                    isSelected && "ring-2 ring-primary ring-offset-2"
                  )}
                  style={{ animationDelay: `${120 + index * 60}ms` }}
                >
                  {/* Selection checkbox */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSelection(quiz.id)
                    }}
                    className="absolute left-3 top-3 z-10 flex size-5 items-center justify-center rounded border bg-background transition-colors hover:bg-muted"
                    aria-label={isSelected ? "Deselect exam" : "Select exam"}
                  >
                    {isSelected ? (
                      <CheckSquare className="size-4 text-primary" />
                    ) : (
                      <Square className="size-4 text-muted-foreground" />
                    )}
                  </button>

                  <div className="pointer-events-none absolute right-4 top-4 flex translate-y-1 gap-2 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
                    <Link href={`/quiz/${quiz.id}?tab=questions`} className={cn(buttonVariants({ size: "icon", variant: "outline" }), "h-8 w-8")}>
                      <PencilLine className="size-4" />
                    </Link>
                    <button type="button" aria-label="Delete exam" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-500/10 dark:text-rose-400">
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <div className="flex items-start justify-between gap-3 pl-6">
                    <div className="space-y-1.5">
                      <Tooltip content={tooltipPreview}>
                        <p className="text-base font-semibold text-foreground line-clamp-1 cursor-default">{quiz.title}</p>
                      </Tooltip>
                      <p className="text-xs text-muted-foreground">Updated {formatUpdatedAt(quiz.updated_at)}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <Badge className={statusBadgeClasses(status)}>{status}</Badge>
                      {linkedJob ? <Badge className={statusBadgeClasses("PROCESSING")}>PROCESSING</Badge> : null}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-foreground" />
                      <span>{questionCount} questions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock3 className="size-4 text-foreground" />
                      <span>{durationLabel}</span>
                    </div>
                  </div>

                  <div className="mt-5 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-[var(--text-muted)]">
                      <span>Setup progress</span>
                      <span>{readiness}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-[var(--bg-secondary)]">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          progressBarColor
                        )}
                        style={{ width: `${readiness}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <Link
                      href={openExamHref}
                      className={cn(buttonVariants({ size: "sm" }), "bg-primary text-primary-foreground hover:bg-primary/90")}
                    >
                      Open Exam
                    </Link>
                    <Link
                      href={`/quiz/${quiz.id}?tab=questions`}
                      className={cn(buttonVariants({ size: "sm", variant: "outline" }), "text-foreground")}
                    >
                      <PencilLine className="mr-1.5 size-4" />
                      Edit
                    </Link>
                    <Link
                      href={`/quiz/${quiz.id}?tab=results`}
                      className="px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Results
                    </Link>
                  </div>
                </div>
              )
            })}
        </div>
      </section>

      {!isLoading && visibleQuizzes.length === 0 ? (
        <div className="rounded-3xl border bg-background p-10 text-center">
          {/* Empty state illustration */}
          <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-muted">
            <FolderOpen className="size-10 text-muted-foreground" />
          </div>
          <p className="text-lg font-semibold text-foreground">
            {quizzes.length === 0 ? "No exams yet" : "No exams found"}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {quizzes.length === 0
              ? "Create your first exam to start assessing your students with AI-powered quizzes."
              : "Try adjusting your search or filter to find what you're looking for."}
          </p>
          {quizzes.length === 0 && (
            <div className="mt-6">
              <Link href="/quizzes/create" className={cn(buttonVariants({ size: "lg" }), "bg-primary text-primary-foreground hover:bg-primary/90")}>
                Create your first exam
              </Link>
            </div>
          )}
        </div>
      ) : null}

      {liveData?.alerts?.length ? (
        <div className={cn(pageCardClass, "dashboard-fade-up")} style={{ animationDelay: "180ms" }}>
          <SectionHeader title="Live Monitoring Alerts" description="Operational alerts flowing from active exams." icon={Activity} />
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            {liveData.alerts.map((alert, index) => (
              <div key={`${alert.quiz_id}-${index}`} className="rounded-xl border bg-background px-3 py-2">
                <span className="font-medium text-foreground">{alert.quiz_name}:</span> {alert.message}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} Exam{selectedIds.size > 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.size} selected exam{selectedIds.size > 1 ? "s" : ""}?
              This action cannot be undone and all associated questions and results will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkDeleteDialog(false)}
              disabled={bulkDeleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : `Delete ${selectedIds.size} Exam${selectedIds.size > 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
