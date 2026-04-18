"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
  FolderPlus,
  PencilLine,
  Sparkles,
  Square,
  Trash2,
  X,
  Layers
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
import {
  assignQuizToCluster,
  assignQuizzesToCluster,
  buildCourseClusterOptions,
  loadCourseLibrary,
  loadQuizOrganizationMap,
  mergeCourseFromAssignment,
  saveCourseLibrary,
  type CourseDefinition,
  type QuizOrganizationMap,
} from "@/features/quiz/organization/storage"

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
  if (status === "LIVE") return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200"
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
  const [courseLibrary, setCourseLibrary] = useState<CourseDefinition[]>([])
  const [organizationMap, setOrganizationMap] = useState<QuizOrganizationMap>({})
  const [clusterFilter, setClusterFilter] = useState("__all__")
  const [bulkClusterValue, setBulkClusterValue] = useState("__none__")
  
  // Cluster UX new states
  const [activeClusterModal, setActiveClusterModal] = useState<string | null>(null)
  const [showCreateClusterDialog, setShowCreateClusterDialog] = useState(false)
  const [newCourseName, setNewCourseName] = useState("")
  const [newUnitName, setNewUnitName] = useState("")

  useEffect(() => {
    setCourseLibrary(loadCourseLibrary())
    setOrganizationMap(loadQuizOrganizationMap())
  }, [])

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
  const runningJobs = useMemo(() => summary?.running_jobs ?? [], [summary?.running_jobs])
  const runningJobsByQuizId = useMemo(
    () => new Map(runningJobs.map((job) => [job.quiz_id, job])),
    [runningJobs]
  )
  const clusterOptions = useMemo(() => buildCourseClusterOptions(courseLibrary), [courseLibrary])

  const getQuizClusterValue = useCallback(
    (quizId: string) => {
      const quizOrg = organizationMap[quizId]
      return quizOrg?.course_name
        ? `${quizOrg.course_name}__quizzer_cluster__${quizOrg.unit_name ?? ""}`
        : "__none__"
    },
    [organizationMap]
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
      const quizClusterValue = getQuizClusterValue(quiz.id)
      const matchesCluster = clusterFilter === "__all__" ? true : clusterFilter === quizClusterValue

      return matchesFilter && matchesQuery && matchesCluster
    })

    return filtered.sort((a, b) => {
      if (sortBy === "alphabetical") {
        return (a.title ?? "").localeCompare(b.title ?? "")
      }
      if (sortBy === "created") {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
        return dateB - dateA
      }
      const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0
      return dateB - dateA
    })
  }, [clusterFilter, filter, getQuizClusterValue, liveQuizIds, quizzes, runningJobsByQuizId, searchQuery, sortBy])

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

  const selectAll = () => setSelectedIds(new Set(visibleQuizzes.map((q) => q.id)))
  const clearSelection = () => setSelectedIds(new Set())

  const handleCreateCluster = () => {
    const courseName = newCourseName.trim()
    const unitName = newUnitName.trim()
    if (!courseName) {
      toast.error("Course name is required")
      return
    }
    const nextLibrary = mergeCourseFromAssignment(courseLibrary, courseName, unitName || undefined)
    setCourseLibrary(nextLibrary)
    saveCourseLibrary(nextLibrary)
    setNewCourseName("")
    setNewUnitName("")
    setShowCreateClusterDialog(false)
    toast.success("Cluster created")
  }

  const handleAssignSelectedToCluster = () => {
    if (selectedIds.size === 0) return
    const selectedCluster = clusterOptions.find((option) => option.value === bulkClusterValue)
    assignQuizzesToCluster(
      Array.from(selectedIds),
      selectedCluster
        ? { course_name: selectedCluster.course_name, unit_name: selectedCluster.unit_name }
        : null
    )
    setOrganizationMap(loadQuizOrganizationMap())
    toast.success(selectedCluster ? "Exams organized into cluster" : "Exams removed from cluster")
    clearSelection()
  }

  const selectClusterExams = (clusterValue: string) => {
    const ids = quizzes
      .filter((quiz) => getQuizClusterValue(quiz.id) === clusterValue)
      .map((quiz) => quiz.id)
    setSelectedIds(new Set(ids))
    toast.success(`Selected ${ids.length} exams from cluster`)
  }

  const clusterSnapshots = useMemo(
    () =>
      clusterOptions.map((option) => {
        const clusterQuizzes = quizzes
          .filter((quiz) => getQuizClusterValue(quiz.id) === option.value)
          .sort((a, b) => {
            const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0
            const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0
            return dateB - dateA
          })

        return {
          ...option,
          total: clusterQuizzes.length,
          recent: clusterQuizzes.slice(0, 5),
        }
      }),
    [clusterOptions, getQuizClusterValue, quizzes]
  )

  return (
    <section className="space-y-8 pb-32">
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
                className="w-full sm:w-56 bg-background"
              />
              <Select value={filter} onValueChange={(value) => setFilter(value as ExamFilter)}>
                <SelectTrigger className="w-[156px] bg-background">
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
                <SelectTrigger className="w-[140px] bg-background">
                  <ArrowUpDown className="mr-2 size-4 text-muted-foreground" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated">Last Updated</SelectItem>
                  <SelectItem value="created">Date Created</SelectItem>
                  <SelectItem value="alphabetical">Alphabetical</SelectItem>
                </SelectContent>
              </Select>
              <Select value={clusterFilter} onValueChange={setClusterFilter}>
                <SelectTrigger className="w-[190px] bg-background">
                  <SelectValue placeholder="All clusters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All clusters</SelectItem>
                  <SelectItem value="__none__">Unclustered only</SelectItem>
                  {clusterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                        isComplete ? "bg-emerald-500" : "bg-orange-500"
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

      {/* Unified Exam Clusters Grid */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SectionHeader
            title="Exam Clusters"
            description="Organize exams effortlessly by linking them to specific courses and batches."
            icon={FolderOpen}
          />
          <Button 
            onClick={() => setShowCreateClusterDialog(true)}
            variant="secondary" 
            className="rounded-full shadow-sm"
          >
            <FolderPlus className="mr-2 size-4" />
            New Cluster
          </Button>
        </div>
        
        {clusterOptions.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {clusterSnapshots.map((cluster) => (
              <div key={cluster.value} className={cn(pageCardInteractiveClass, "group space-y-3 dashboard-fade-up")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <FolderOpen className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground leading-tight">{cluster.label}</p>
                      <p className="text-xs text-muted-foreground font-medium">{cluster.total} exam{cluster.total === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-background/50 p-3 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
                    <Layers className="size-3" /> Recent Activity
                  </p>
                  {cluster.recent.length > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {cluster.recent.map((quiz) => (
                        <li key={`${cluster.value}-${quiz.id}`} className="truncate text-xs font-medium text-foreground/80 flex items-center gap-2">
                          <div className="size-1 rounded-full bg-primary/50 shrink-0" />
                          <span className="truncate">{quiz.title}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground py-2 italic">This cluster is currently empty.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40">
                  <Button size="sm" variant="default" className="flex-1 rounded-lg shadow-sm" onClick={() => setActiveClusterModal(cluster.value)}>
                    Open Cluster
                  </Button>
                  <Tooltip content="Select all exams inside">
                    <Button size="sm" variant="outline" className="px-3 rounded-lg" onClick={() => selectClusterExams(cluster.value)}>
                      Select
                    </Button>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed bg-muted/10 p-8 flex flex-col items-center justify-center text-center">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
              <FolderOpen className="size-6" />
            </div>
            <p className="font-semibold">No clusters yet</p>
            <p className="text-sm text-muted-foreground max-w-[300px] mt-1 mb-4">Clusters help you cleanly separate your math tests from your history tests.</p>
            <Button onClick={() => setShowCreateClusterDialog(true)} variant="outline">
              Create your first cluster
            </Button>
          </div>
        )}
      </section>

      {/* Filterable List */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader title="Operational Snapshot" description="Exams organized by readiness, status, and targeted properties." icon={pageIcons.exams} />
          
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            className="rounded-full shadow-sm"
            disabled={visibleQuizzes.length === 0}
          >
            <CheckSquare className="mr-2 size-4 text-primary" />
            Select All Exams
          </Button>
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
              const durationLabel = quiz.duration_minutes ? `${quiz.duration_minutes} min` : "No limit"
              const readiness = getReadinessProgress(questionCount, Boolean(quiz.duration_minutes), isPublished)
              const isSelected = selectedIds.has(quiz.id)
              const openExamId = isPublished && quiz.public_id ? quiz.public_id : quiz.id
              const openExamHref = `/exam/${openExamId}`
              const quizCluster = organizationMap[quiz.id]
              const clusterLabel = quizCluster?.course_name
                ? `${quizCluster.course_name}${quizCluster.unit_name ? ` • ${quizCluster.unit_name}` : ""}`
                : "Unclustered"

              const progressBarColor = readiness >= 80 ? "bg-emerald-500" : readiness >= 40 ? "bg-amber-500" : "bg-rose-500"

              return (
                <div
                  key={quiz.id}
                  className={cn(
                    "dashboard-fade-up group relative",
                    pageCardInteractiveClass,
                    "hover:border-primary/30 hover:shadow-lg",
                    isSelected && "ring-2 ring-primary ring-offset-2 border-primary/50 bg-primary/5"
                  )}
                  style={{ animationDelay: `${120 + index * 60}ms` }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSelection(quiz.id)
                    }}
                    className={cn(
                      "absolute left-3 top-3 z-10 flex size-6 items-center justify-center rounded border bg-background transition-all hover:bg-muted shadow-sm",
                      isSelected && "bg-primary border-primary hover:bg-primary/90"
                    )}
                  >
                    {isSelected ? (
                      <CheckSquare className="size-4 text-primary-foreground" />
                    ) : (
                      <Square className="size-4 text-muted-foreground" />
                    )}
                  </button>

                  <div className="pointer-events-none absolute right-4 top-4 flex translate-y-1 gap-2 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
                    <Link href={`/quiz/${quiz.id}?tab=questions`} className={cn(buttonVariants({ size: "icon", variant: "outline" }), "h-8 w-8 shadow-sm bg-background")}>
                      <PencilLine className="size-4" />
                    </Link>
                  </div>

                  <div className="flex items-start justify-between gap-3 pl-8">
                    <div className="space-y-1.5 flex-1 pr-2">
                      <Tooltip content={`${questionCount} questions | ${durationLabel} | ${status}`}>
                        <p className="text-[15px] font-bold text-foreground line-clamp-1 cursor-default">{quiz.title}</p>
                      </Tooltip>
                      <p className="text-[11px] font-medium text-muted-foreground">{formatUpdatedAt(quiz.updated_at)}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <Badge className={statusBadgeClasses(status)}>{status}</Badge>
                      <Badge variant={quizCluster?.course_name ? "secondary" : "outline"} className="max-w-[120px] truncate text-[10px]">
                        {clusterLabel}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-foreground/70" />
                      <span>{questionCount} q</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock3 className="size-4 text-foreground/70" />
                      <span>{durationLabel}</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      <span>Setup progress</span>
                      <span className={cn(readiness >= 80 ? "text-emerald-600 dark:text-emerald-400" : "")}>{readiness}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
                      <div className={cn("h-full rounded-full transition-all duration-300", progressBarColor)} style={{ width: `${readiness}%` }} />
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-2 border-t pt-4">
                    <Link
                      href={openExamHref}
                      className={cn(buttonVariants({ size: "sm" }), "flex-1 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 shadow-sm")}
                    >
                      Open Exam
                    </Link>
                    <Link
                      href={`/quiz/${quiz.id}?tab=results`}
                      className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-lg transition-colors"
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
        <div className="rounded-3xl border bg-background p-10 text-center shadow-sm">
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
               <Link href="/quizzes/create" className={cn(buttonVariants({ size: "lg" }), "rounded-full shadow-md")}>
                Create Exam
              </Link>
            </div>
          )}
        </div>
      ) : null}

      {/* Floating Sticky Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className="flex flex-wrap items-center gap-3 rounded-full border border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-2.5 shadow-2xl shadow-primary/10">
            <span className="flex items-center justify-center rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary tracking-wide">
              {selectedIds.size} selected
            </span>
            <div className="hidden sm:block h-5 w-px bg-border/80" />
            
            <Select value={bulkClusterValue} onValueChange={setBulkClusterValue}>
              <SelectTrigger className="h-9 w-[190px] rounded-full border-dashed bg-transparent hover:bg-muted/50 focus:ring-0 text-xs font-medium">
                <SelectValue placeholder="Move to cluster..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-muted-foreground font-semibold">Remove from cluster</SelectItem>
                {clusterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                       <FolderOpen className="size-3.5 text-muted-foreground" />
                       {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="default" size="sm" className="rounded-full h-9 px-5 shadow-sm" onClick={handleAssignSelectedToCluster}>
              Apply
            </Button>
            
            <div className="hidden sm:block h-5 w-px bg-border/80" />
            <Tooltip content="Delete selected">
              <Button variant="ghost" size="sm" className="rounded-full h-9 w-9 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => setShowBulkDeleteDialog(true)}>
                <Trash2 className="size-4" />
              </Button>
            </Tooltip>
            <Button variant="ghost" size="sm" className="rounded-full h-9 px-4 font-semibold text-muted-foreground hover:text-foreground" onClick={clearSelection}>
              <X className="mr-1.5 size-4" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Cluster Dedicated Overview Modal */}
      <Dialog open={!!activeClusterModal} onOpenChange={(open) => !open && setActiveClusterModal(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden bg-background border-border/60 shadow-2xl">
          {(() => {
            const activeOption = clusterOptions.find(o => o.value === activeClusterModal);
            if (!activeOption) return <div className="p-10 text-center">Cluster not found</div>;
            
            const clusterExams = quizzes.filter(q => getQuizClusterValue(q.id) === activeOption.value)
              .sort((a,b) => (b.updated_at ? new Date(b.updated_at).getTime() : 0) - (a.updated_at ? new Date(a.updated_at).getTime() : 0));

            return (
              <>
                <div className="border-b bg-muted/30 px-6 py-5">
                  <DialogHeader>
                    <div className="flex items-center gap-4">
                      <div className="flex size-14 items-center justify-center rounded-2xl bg-background border shadow-sm text-primary">
                        <FolderOpen className="size-6" />
                      </div>
                      <div className="text-left">
                        <DialogTitle className="text-xl font-bold">{activeOption.label}</DialogTitle>
                        <DialogDescription className="mt-1 font-semibold text-muted-foreground">
                          {clusterExams.length} {clusterExams.length === 1 ? 'exam' : 'exams'} assigned inside this cluster.
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-background space-y-4">
                  {clusterExams.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed rounded-2xl bg-muted/20">
                      <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <FolderOpen className="size-8 text-muted-foreground/50" />
                      </div>
                      <p className="text-base font-bold text-foreground">This cluster is completely empty.</p>
                      <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                        Select exams from your dashboard dashboard, then use the bottom action bar to move them here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {clusterExams.map((exam, index) => {
                        const isLive = liveQuizIds.has(exam.id)
                        const status = runningJobsByQuizId.has(exam.id) ? "PROCESSING" : isLive ? "LIVE" : exam.is_published ? "PUBLISHED" : "DRAFT"
                        const questionCount = exam.question_count ?? 0
                        
                        return (
                          <div key={exam.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-2xl hover:bg-muted/30 transition-all hover:shadow-sm gap-4 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${index * 40}ms`, animationFillMode: "both" }}>
                            <div className="flex items-start gap-4">
                              <div className="mt-1 flex size-10 items-center justify-center rounded-full bg-background border shadow-sm shrink-0">
                                <FileText className="size-4 text-muted-foreground" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-[15px] font-bold text-foreground leading-tight">{exam.title}</p>
                                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                                  <span>{formatUpdatedAt(exam.updated_at)}</span>
                                  <span className="size-1 rounded-full bg-muted-foreground/30" />
                                  <span>{questionCount} q</span>
                                  <span className="size-1 rounded-full bg-muted-foreground/30" />
                                  <Badge className={cn("text-[8px] h-4 py-0", statusBadgeClasses(status))}>{status}</Badge>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0 ml-14 sm:ml-0">
                              <Button size="sm" className="h-9 px-4 rounded-lg shadow-sm" asChild>
                                <Link href={exam.is_published && exam.public_id ? `/exam/${exam.public_id}` : `/quiz/${exam.id}`}>Open Exam</Link>
                              </Button>
                              <Tooltip content="Remove exam from this cluster">
                                <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                  onClick={() => {
                                    assignQuizToCluster(exam.id, null);
                                    setOrganizationMap(loadQuizOrganizationMap());
                                    toast.success("Exam removed from cluster");
                                  }}>
                                  <Trash2 className="size-4" />
                                </Button>
                              </Tooltip>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Create Cluster Dialog */}
      <Dialog open={showCreateClusterDialog} onOpenChange={setShowCreateClusterDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Cluster</DialogTitle>
            <DialogDescription>
              Group exams by courses, batches, or subjects to keep your workspace flawlessly structured.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-6">
            <div className="grid gap-2">
              <label htmlFor="course" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Course or Subject Name *</label>
              <Input
                id="course"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                placeholder="e.g., Mathematics 101"
                className="focus-visible:ring-primary shadow-sm"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="unit" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Batch / Unit (Optional)</label>
              <Input
                id="unit"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                placeholder="e.g., Fall Semester 2025"
                className="focus-visible:ring-primary shadow-sm"
              />
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="ghost" className="font-semibold" onClick={() => setShowCreateClusterDialog(false)}>Cancel</Button>
            <Button className="px-6 shadow-sm" onClick={handleCreateCluster}>Create Cluster</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
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
            <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)} disabled={bulkDeleteMutation.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))} disabled={bulkDeleteMutation.isPending}>
              {bulkDeleteMutation.isPending ? "Deleting..." : `Delete ${selectedIds.size} Exam${selectedIds.size > 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
