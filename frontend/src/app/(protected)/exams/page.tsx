"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ArrowDown,
  ArrowUpDown,
  ArrowUp,
  BarChart3,
  CheckSquare,
  ChevronDown,
  Clock3,
  FileText,
  FolderOpen,
  MoreHorizontal,
  PencilLine,
  Plus,
  Search,
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
import { Checkbox } from "@/components/ui/checkbox"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  assignQuizToCluster,
  assignQuizzesToCluster,
  buildCourseClusterOptions,
  loadCourseLibrary,
  loadQuizOrganizationMap,
  mergeCourseFromAssignment,
  saveCourseLibrary,
  saveQuizOrganizationMap,
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
type ExamStatus = Exclude<ExamFilter, "ALL">
type SortOption = "updated" | "created" | "name" | "questions" | "status"
type ClusterExamOrderMap = Record<string, string[]>
type RelativeUpdated = "any" | "today" | "week" | "month" | "custom"
type DifficultyLevel = "ALL" | "LOW" | "MEDIUM" | "HIGH"

type AdvancedFilters = {
  query: string
  questionMin: string
  questionMax: string
  createdFrom: string
  createdTo: string
  statuses: ExamStatus[]
  clusterValue: string
  difficulty: DifficultyLevel
  updatedRelative: RelativeUpdated
  updatedFrom: string
  updatedTo: string
}

const CLUSTER_ORDER_STORAGE_KEY = "quizzer_cluster_exam_order_v1"
const STATUS_OPTIONS: ExamStatus[] = ["LIVE", "DRAFT", "PROCESSING", "PUBLISHED"]

const defaultAdvancedFilters: AdvancedFilters = {
  query: "",
  questionMin: "",
  questionMax: "",
  createdFrom: "",
  createdTo: "",
  statuses: [],
  clusterValue: "__all__",
  difficulty: "ALL",
  updatedRelative: "any",
  updatedFrom: "",
  updatedTo: "",
}

function loadClusterExamOrderMap(): ClusterExamOrderMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(CLUSTER_ORDER_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ClusterExamOrderMap
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function saveClusterExamOrderMap(value: ClusterExamOrderMap) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(CLUSTER_ORDER_STORAGE_KEY, JSON.stringify(value))
}

function buildOrderedClusterExamIds(clusterValue: string, clusterExamIds: string[], orderMap: ClusterExamOrderMap) {
  const existing = orderMap[clusterValue] ?? []
  const available = new Set(clusterExamIds)
  const preferred = existing.filter((id) => available.has(id))
  const remaining = clusterExamIds.filter((id) => !preferred.includes(id))
  return [...preferred, ...remaining]
}

function getDifficultyLevel(questionCount: number): DifficultyLevel {
  if (questionCount >= 25) return "HIGH"
  if (questionCount >= 10) return "MEDIUM"
  return "LOW"
}

function resolveExamStatus(isLive: boolean, isPublished: boolean, hasProcessing: boolean): ExamStatus {
  if (hasProcessing) return "PROCESSING"
  if (isLive) return "LIVE"
  if (isPublished) return "PUBLISHED"
  return "DRAFT"
}

function normalizeDateOnly(dateValue: string) {
  const parsed = new Date(dateValue)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function isDefaultAdvancedFilters(filters: AdvancedFilters) {
  return JSON.stringify(filters) === JSON.stringify(defaultAdvancedFilters)
}

function normalizeJobProgress(progress: number) {
  const normalized = progress <= 1 ? progress * 100 : progress
  return Math.min(100, Math.max(0, normalized))
}

function statusBadgeClasses(status: ExamFilter | "COMPLETED") {
  if (status === "LIVE") return "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300 border-0 shadow-none font-medium"
  if (status === "PUBLISHED") return "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300 border-0 shadow-none font-medium"
  if (status === "PROCESSING") return "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300 border-0 shadow-none font-medium"
  if (status === "COMPLETED") return "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300 border-0 shadow-none font-medium"
  if (status === "DRAFT") return "bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300 border-0 shadow-none font-medium"
  return "bg-muted text-foreground border-0 shadow-none font-medium"
}

function getCardGradient(title: string) {
  const t = title.toLowerCase()
  if (t.includes("js") || t.includes("javascript") || t.includes("node")) return "linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(16, 185, 129, 0.02))"
  if (t.includes("web") || t.includes("react") || t.includes("html") || t.includes("css")) return "linear-gradient(135deg, rgba(245, 158, 11, 0.06), rgba(245, 158, 11, 0.02))"
  if (t.includes("db") || t.includes("database") || t.includes("sql") || t.includes("mongo")) return "linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(59, 130, 246, 0.02))"
  if (t.includes("dsa") || t.includes("algorithm") || t.includes("data structure")) return "linear-gradient(135deg, rgba(139, 92, 246, 0.06), rgba(139, 92, 246, 0.02))"
  return "linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(59, 130, 246, 0.04))"
}

function getCardIconBg(title: string) {
  const t = title.toLowerCase()
  if (t.includes("js") || t.includes("javascript") || t.includes("node")) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
  if (t.includes("web") || t.includes("react") || t.includes("html") || t.includes("css")) return "bg-amber-500/10 text-amber-600 dark:text-amber-400"
  if (t.includes("db") || t.includes("database") || t.includes("sql") || t.includes("mongo")) return "bg-blue-500/10 text-blue-600 dark:text-blue-400"
  if (t.includes("dsa") || t.includes("algorithm") || t.includes("data structure")) return "bg-purple-500/10 text-purple-600 dark:text-purple-400"
  return "bg-primary/10 text-primary"
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
  const [sortBy, setSortBy] = useState<SortOption>("updated")
  const [appliedFilters, setAppliedFilters] = useState<AdvancedFilters>(defaultAdvancedFilters)
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>(defaultAdvancedFilters)
  const [searchPanelOpen, setSearchPanelOpen] = useState(false)
  const [clusterSearchQuery, setClusterSearchQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [examPendingDelete, setExamPendingDelete] = useState<{ id: string; title: string } | null>(null)
  const [courseLibrary, setCourseLibrary] = useState<CourseDefinition[]>([])
  const [organizationMap, setOrganizationMap] = useState<QuizOrganizationMap>({})
  const [bulkClusterValue, setBulkClusterValue] = useState("__none__")
  const [selectedClusterValues, setSelectedClusterValues] = useState<Set<string>>(new Set())
  
  // Cluster UX new states
  const [activeClusterModal, setActiveClusterModal] = useState<string | null>(null)
  const [showAddExamsDialog, setShowAddExamsDialog] = useState(false)
  const [pendingClusterExamIds, setPendingClusterExamIds] = useState<Set<string>>(new Set())
  const [clusterExamOrderMap, setClusterExamOrderMap] = useState<ClusterExamOrderMap>({})
  const [showCreateClusterDialog, setShowCreateClusterDialog] = useState(false)
  const [newCourseName, setNewCourseName] = useState("")
  const [newUnitName, setNewUnitName] = useState("")
  const searchButtonRef = useRef<HTMLButtonElement | null>(null)
  const searchPanelRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  // Undo states
  const [pendingDeleteExamIds, setPendingDeleteExamIds] = useState<Set<string>>(new Set())
  const [pendingDeleteClusterValues, setPendingDeleteClusterValues] = useState<Set<string>>(new Set())
  const [showClusterDeleteDialog, setShowClusterDeleteDialog] = useState(false)
  const [clustersPendingDelete, setClustersPendingDelete] = useState<string[]>([])
  const [clusterDeleteOption, setClusterDeleteOption] = useState<'cluster-only' | 'with-exams' | null>(null)

  useEffect(() => {
    setCourseLibrary(loadCourseLibrary())
    setOrganizationMap(loadQuizOrganizationMap())
    setClusterExamOrderMap(loadClusterExamOrderMap())
  }, [])

  useEffect(() => {
    if (!searchPanelOpen) return

    setDraftFilters(appliedFilters)
    // Keep focus on top search bar when filter panel opens (not on first filter input)
    searchInputRef.current?.focus()

    const onDocumentMouseDown = (event: MouseEvent) => {
      const targetNode = event.target as Node
      const clickedSearchButton = searchButtonRef.current?.contains(targetNode)
      const clickedPanel = searchPanelRef.current?.contains(targetNode)
      if (!clickedSearchButton && !clickedPanel) {
        setSearchPanelOpen(false)
      }
    }

    const onDocumentKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchPanelOpen(false)
        searchButtonRef.current?.focus()
      }
    }

    document.addEventListener("mousedown", onDocumentMouseDown)
    document.addEventListener("keydown", onDocumentKeydown)
    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown)
      document.removeEventListener("keydown", onDocumentKeydown)
    }
  }, [appliedFilters, searchPanelOpen])

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

  const displayClusterOptions = useMemo(
    () => clusterOptions.filter((option) => !pendingDeleteClusterValues.has(option.value)),
    [clusterOptions, pendingDeleteClusterValues]
  )

  const getQuizClusterValue = useCallback(
    (quizId: string) => {
      const quizOrg = organizationMap[quizId]
      return quizOrg?.course_name
        ? `${quizOrg.course_name}__quizzer_cluster__${quizOrg.unit_name ?? ""}`
        : "__none__"
    },
    [organizationMap]
  )

  const persistClusterOrderMap = useCallback((next: ClusterExamOrderMap) => {
    setClusterExamOrderMap(next)
    saveClusterExamOrderMap(next)
  }, [])

  const filteredClusterOptions = useMemo(() => {
    const query = clusterSearchQuery.trim().toLowerCase()
    if (!query) return displayClusterOptions
    return displayClusterOptions.filter((option) => option.label.toLowerCase().includes(query))
  }, [displayClusterOptions, clusterSearchQuery])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (appliedFilters.query.trim()) count += 1
    if (appliedFilters.questionMin || appliedFilters.questionMax) count += 1
    if (appliedFilters.createdFrom || appliedFilters.createdTo) count += 1
    if (appliedFilters.statuses.length > 0) count += 1
    if (appliedFilters.clusterValue !== "__all__") count += 1
    if (appliedFilters.difficulty !== "ALL") count += 1
    if (appliedFilters.updatedRelative !== "any") count += 1
    return count
  }, [appliedFilters])

  const clearAllFilters = useCallback(() => {
    setAppliedFilters(defaultAdvancedFilters)
    setDraftFilters(defaultAdvancedFilters)
    setClusterSearchQuery("")
  }, [])

  const handleSearchPanelKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return
    const panel = searchPanelRef.current
    if (!panel) return
    const selectors = [
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",")
    const focusables = Array.from(panel.querySelectorAll<HTMLElement>(selectors)).filter((node) => node.offsetParent !== null)
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
      return
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }, [])

  const handleSearchInputKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      const inputValue = (event.target as HTMLInputElement).value.trim()
      setAppliedFilters((prev) => ({
        ...prev,
        query: inputValue
      }))
      setSearchPanelOpen(false)
    }
  }, [])

  const visibleQuizzes = useMemo(() => {
    const query = appliedFilters.query.trim().toLowerCase()
    const filtered = quizzes.filter((quiz) => {
      if (pendingDeleteExamIds.has(quiz.id)) return false
      const isLive = liveQuizIds.has(quiz.id)
      const isPublished = Boolean(quiz.is_published)
      const hasProcessing = runningJobsByQuizId.has(quiz.id)
      const status = resolveExamStatus(isLive, isPublished, hasProcessing)
      const matchesQuery =
        query.length === 0 ||
        (quiz.title ?? "").toLowerCase().includes(query) ||
        (quiz.description ?? "").toLowerCase().includes(query)
      const quizClusterValue = getQuizClusterValue(quiz.id)
      const matchesCluster = appliedFilters.clusterValue === "__all__" ? true : appliedFilters.clusterValue === quizClusterValue
      const questionCount = quiz.question_count ?? 0

      const minQuestions = Number.parseInt(appliedFilters.questionMin, 10)
      const maxQuestions = Number.parseInt(appliedFilters.questionMax, 10)
      const matchesMinQuestion = Number.isNaN(minQuestions) ? true : questionCount >= minQuestions
      const matchesMaxQuestion = Number.isNaN(maxQuestions) ? true : questionCount <= maxQuestions

      const createdAt = quiz.created_at ? new Date(quiz.created_at) : null
      const createdFrom = normalizeDateOnly(appliedFilters.createdFrom)
      const createdTo = normalizeDateOnly(appliedFilters.createdTo)
      const matchesCreatedFrom = createdFrom && createdAt ? createdAt >= createdFrom : true
      const matchesCreatedTo =
        createdTo && createdAt
          ? createdAt <= new Date(createdTo.getFullYear(), createdTo.getMonth(), createdTo.getDate(), 23, 59, 59, 999)
          : true

      const matchesStatuses = appliedFilters.statuses.length === 0 ? true : appliedFilters.statuses.includes(status)
      const matchesDifficulty = appliedFilters.difficulty === "ALL" ? true : getDifficultyLevel(questionCount) === appliedFilters.difficulty

      const updatedAt = quiz.updated_at ? new Date(quiz.updated_at) : null
      let matchesRelativeUpdated = true
      if (appliedFilters.updatedRelative !== "any") {
        if (!updatedAt) {
          matchesRelativeUpdated = false
        } else if (appliedFilters.updatedRelative === "today") {
          const start = new Date()
          start.setHours(0, 0, 0, 0)
          matchesRelativeUpdated = updatedAt >= start
        } else if (appliedFilters.updatedRelative === "week") {
          const start = new Date()
          start.setDate(start.getDate() - 7)
          matchesRelativeUpdated = updatedAt >= start
        } else if (appliedFilters.updatedRelative === "month") {
          const start = new Date()
          start.setMonth(start.getMonth() - 1)
          matchesRelativeUpdated = updatedAt >= start
        } else {
          const updatedFrom = normalizeDateOnly(appliedFilters.updatedFrom)
          const updatedTo = normalizeDateOnly(appliedFilters.updatedTo)
          const matchesFrom = updatedFrom ? updatedAt >= updatedFrom : true
          const matchesTo = updatedTo
            ? updatedAt <= new Date(updatedTo.getFullYear(), updatedTo.getMonth(), updatedTo.getDate(), 23, 59, 59, 999)
            : true
          matchesRelativeUpdated = matchesFrom && matchesTo
        }
      }

      return (
        matchesQuery &&
        matchesCluster &&
        matchesMinQuestion &&
        matchesMaxQuestion &&
        matchesCreatedFrom &&
        matchesCreatedTo &&
        matchesStatuses &&
        matchesDifficulty &&
        matchesRelativeUpdated
      )
    })

    return filtered.sort((a, b) => {
      if (sortBy === "name") {
        return (a.title ?? "").localeCompare(b.title ?? "")
      }
      if (sortBy === "questions") {
        return (b.question_count ?? 0) - (a.question_count ?? 0)
      }
      if (sortBy === "status") {
        const aStatus = resolveExamStatus(liveQuizIds.has(a.id), Boolean(a.is_published), runningJobsByQuizId.has(a.id))
        const bStatus = resolveExamStatus(liveQuizIds.has(b.id), Boolean(b.is_published), runningJobsByQuizId.has(b.id))
        const priority: Record<ExamStatus, number> = {
          LIVE: 4,
          PROCESSING: 3,
          PUBLISHED: 2,
          DRAFT: 1,
        }
        return priority[bStatus] - priority[aStatus]
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
  }, [appliedFilters, getQuizClusterValue, liveQuizIds, quizzes, pendingDeleteExamIds, runningJobsByQuizId, sortBy])

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => quizApi.deleteById(id)))
      return ids
    },
    onSuccess: (deletedIdsArray) => {
      const deletedIds = new Set(deletedIdsArray)
      const nextMap = { ...loadQuizOrganizationMap() }
      deletedIds.forEach((id) => {
        delete nextMap[id]
      })
      saveQuizOrganizationMap(nextMap)
      setOrganizationMap(nextMap)
      
      setPendingDeleteExamIds(prev => {
        const next = new Set(prev)
        deletedIdsArray.forEach(id => next.delete(id))
        return next
      })

      toast.success(`${deletedIdsArray.length} exam(s) deleted successfully`)
      queryClient.invalidateQueries({ queryKey: ["quizzes"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] })
    },
    onError: (_, ids) => {
      toast.error("Failed to delete some exams")
      setPendingDeleteExamIds(prev => {
        const next = new Set(prev)
        ids.forEach(id => next.delete(id))
        return next
      })
    },
  })

  const singleDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await quizApi.deleteById(id)
      return id
    },
    onSuccess: (deletedId) => {
      const nextMap = { ...loadQuizOrganizationMap() }
      delete nextMap[deletedId]
      saveQuizOrganizationMap(nextMap)
      setOrganizationMap(nextMap)

      setPendingDeleteExamIds(prev => {
        const next = new Set(prev)
        next.delete(deletedId)
        return next
      })

      toast.success("Exam deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["quizzes"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] })
    },
    onError: (_, id) => {
      toast.error("Failed to delete exam")
      setPendingDeleteExamIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    },
  })

  const executeExamDeleteWithUndo = (idsToProcess: string[]) => {
    if (idsToProcess.length === 0) return

    setPendingDeleteExamIds((prev) => {
      const next = new Set(prev)
      idsToProcess.forEach((id) => next.add(id))
      return next
    })

    setSelectedIds((prev) => {
      const next = new Set(prev)
      idsToProcess.forEach((id) => next.delete(id))
      return next
    })

    const timeoutId = setTimeout(() => {
      if (idsToProcess.length === 1) {
        singleDeleteMutation.mutate(idsToProcess[0])
      } else {
        bulkDeleteMutation.mutate(idsToProcess)
      }
    }, 3000)

    toast(`Deleting ${idsToProcess.length} exam${idsToProcess.length > 1 ? "s" : ""}...`, {
      duration: 3000,
      action: {
        label: "Undo",
        onClick: () => {
          clearTimeout(timeoutId)
          setPendingDeleteExamIds((prev) => {
            const next = new Set(prev)
            idsToProcess.forEach((id) => next.delete(id))
            return next
          })
          toast.success("Deletion undone")
        },
      },
    })
  }

  const executeClusterDeleteWithUndo = (clusterValues: string[]) => {
    if (clusterValues.length === 0) return
    setClustersPendingDelete(clusterValues)
    setClusterDeleteOption(null)
    setShowClusterDeleteDialog(true)
  }

  const performClusterDelete = (deleteWithExams: boolean) => {
    const clusterValues = clustersPendingDelete
    if (clusterValues.length === 0) return

    setPendingDeleteClusterValues((prev) => {
      const next = new Set(prev)
      clusterValues.forEach((val) => next.add(val))
      return next
    })

    setSelectedClusterValues((prev) => {
      const next = new Set(prev)
      clusterValues.forEach((val) => next.delete(val))
      return next
    })

    if (activeClusterModal && clusterValues.includes(activeClusterModal)) {
      setActiveClusterModal(null)
    }

    const timeoutId = setTimeout(() => {
      if (deleteWithExams) {
        deleteClusters(clusterValues)
      } else {
        deleteClusterOnly(clusterValues)
      }
      setPendingDeleteClusterValues((prev) => {
        const next = new Set(prev)
        clusterValues.forEach((val) => next.delete(val))
        return next
      })
    }, 3000)

    toast(`Deleting ${clusterValues.length} cluster${clusterValues.length > 1 ? "s" : ""}...`, {
      duration: 3000,
      action: {
        label: "Undo",
        onClick: () => {
          clearTimeout(timeoutId)
          setPendingDeleteClusterValues((prev) => {
            const next = new Set(prev)
            clusterValues.forEach((val) => next.delete(val))
            return next
          })
          toast.success("Deletion undone")
        },
      },
    })

    setShowClusterDeleteDialog(false)
    setClustersPendingDelete([])
    setClusterDeleteOption(null)
  }

  const deleteClusterOnly = (clusterValues: string[]) => {
    const valuesToDelete = new Set(clusterValues)
    const optionsToDelete = clusterOptions.filter((option) => valuesToDelete.has(option.value))
    if (optionsToDelete.length === 0) return

    const courseNamesToDelete = new Set(
      optionsToDelete.filter((option) => !option.unit_name).map((option) => option.course_name.toLowerCase())
    )
    const unitsByCourse = new Map<string, Set<string>>()

    optionsToDelete.forEach((option) => {
      if (!option.unit_name) return
      const key = option.course_name.toLowerCase()
      const units = unitsByCourse.get(key) ?? new Set<string>()
      units.add(option.unit_name.toLowerCase())
      unitsByCourse.set(key, units)
    })

    const nextLibrary = courseLibrary
      .filter((course) => !courseNamesToDelete.has(course.name.toLowerCase()))
      .map((course) => {
        const unitsToDelete = unitsByCourse.get(course.name.toLowerCase())
        if (!unitsToDelete) return course
        return {
          ...course,
          units: course.units.filter((unit) => !unitsToDelete.has(unit.toLowerCase())),
        }
      })
      .filter((course) => {
        if (!unitsByCourse.has(course.name.toLowerCase())) return true
        return course.units.length > 0
      })

    setCourseLibrary(nextLibrary)
    saveCourseLibrary(nextLibrary)

    const nextOrderMap = { ...clusterExamOrderMap }
    clusterValues.forEach((value) => {
      delete nextOrderMap[value]
    })
    persistClusterOrderMap(nextOrderMap)
    setSelectedClusterValues((prev) => {
      const next = new Set(prev)
      clusterValues.forEach((value) => next.delete(value))
      return next
    })
    if (activeClusterModal && valuesToDelete.has(activeClusterModal)) {
      setActiveClusterModal(null)
    }
    toast.success(`${optionsToDelete.length} cluster${optionsToDelete.length === 1 ? "" : "s"} deleted (exams kept unclustered)`)
  }

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

  const toggleSelectAll = () => {
    const allIds = new Set(visibleQuizzes.map((q) => q.id))
    if (selectedIds.size === visibleQuizzes.length && visibleQuizzes.length > 0) {
      // All are selected, so unselect all
      setSelectedIds(new Set())
    } else {
      // Not all selected or no selection, so select all
      setSelectedIds(allIds)
    }
  }
  const selectAll = () => setSelectedIds(new Set(visibleQuizzes.map((q) => q.id)))
  const clearSelection = () => setSelectedIds(new Set())

  const toggleClusterSelection = (clusterValue: string) => {
    setSelectedClusterValues((prev) => {
      const next = new Set(prev)
      if (next.has(clusterValue)) {
        next.delete(clusterValue)
      } else {
        next.add(clusterValue)
      }
      return next
    })
  }

  const clearClusterSelection = () => setSelectedClusterValues(new Set())

  const deleteClusters = (clusterValues: string[]) => {
    const valuesToDelete = new Set(clusterValues)
    const optionsToDelete = clusterOptions.filter((option) => valuesToDelete.has(option.value))
    if (optionsToDelete.length === 0) return

    const courseNamesToDelete = new Set(
      optionsToDelete.filter((option) => !option.unit_name).map((option) => option.course_name.toLowerCase())
    )
    const unitsByCourse = new Map<string, Set<string>>()

    optionsToDelete.forEach((option) => {
      if (!option.unit_name) return
      const key = option.course_name.toLowerCase()
      const units = unitsByCourse.get(key) ?? new Set<string>()
      units.add(option.unit_name.toLowerCase())
      unitsByCourse.set(key, units)
    })

    const nextLibrary = courseLibrary
      .filter((course) => !courseNamesToDelete.has(course.name.toLowerCase()))
      .map((course) => {
        const unitsToDelete = unitsByCourse.get(course.name.toLowerCase())
        if (!unitsToDelete) return course
        return {
          ...course,
          units: course.units.filter((unit) => !unitsToDelete.has(unit.toLowerCase())),
        }
      })
      .filter((course) => {
        if (!unitsByCourse.has(course.name.toLowerCase())) return true
        return course.units.length > 0
      })

    const nextMap = { ...loadQuizOrganizationMap() }
    Object.keys(nextMap).forEach((quizId) => {
      if (valuesToDelete.has(getQuizClusterValue(quizId))) {
        delete nextMap[quizId]
      }
    })

    setCourseLibrary(nextLibrary)
    saveCourseLibrary(nextLibrary)
    setOrganizationMap(nextMap)
    saveQuizOrganizationMap(nextMap)
    const nextOrderMap = { ...clusterExamOrderMap }
    clusterValues.forEach((value) => {
      delete nextOrderMap[value]
    })
    persistClusterOrderMap(nextOrderMap)
    setSelectedClusterValues((prev) => {
      const next = new Set(prev)
      clusterValues.forEach((value) => next.delete(value))
      return next
    })
    if (activeClusterModal && valuesToDelete.has(activeClusterModal)) {
      setActiveClusterModal(null)
    }
    toast.success(`${optionsToDelete.length} cluster${optionsToDelete.length === 1 ? "" : "s"} deleted`)
  }

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
    const selectedCluster = displayClusterOptions.find((option) => option.value === bulkClusterValue)
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

  const unclusteredQuizzes = useMemo(
    () =>
      quizzes
        .filter((quiz) => getQuizClusterValue(quiz.id) === "__none__")
        .sort((a, b) => (b.updated_at ? new Date(b.updated_at).getTime() : 0) - (a.updated_at ? new Date(a.updated_at).getTime() : 0)),
    [getQuizClusterValue, quizzes]
  )

  const openAddExamsDialog = (clusterValue: string) => {
    setActiveClusterModal(clusterValue)
    setPendingClusterExamIds(new Set())
    setShowAddExamsDialog(true)
  }

  const togglePendingClusterExam = (examId: string, checked: boolean) => {
    setPendingClusterExamIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(examId)
      } else {
        next.delete(examId)
      }
      return next
    })
  }

  const savePendingExamsToCluster = () => {
    if (!activeClusterModal || pendingClusterExamIds.size === 0) return
    const selectedCluster = displayClusterOptions.find((option) => option.value === activeClusterModal)
    if (!selectedCluster) return

    const examIds = Array.from(pendingClusterExamIds)
    assignQuizzesToCluster(examIds, {
      course_name: selectedCluster.course_name,
      unit_name: selectedCluster.unit_name,
    })
    setOrganizationMap(loadQuizOrganizationMap())
    persistClusterOrderMap({
      ...clusterExamOrderMap,
      [activeClusterModal]: [...(clusterExamOrderMap[activeClusterModal] ?? []), ...examIds.filter((id) => !(clusterExamOrderMap[activeClusterModal] ?? []).includes(id))],
    })
    setPendingClusterExamIds(new Set())
    setShowAddExamsDialog(false)
    toast.success(`${examIds.length} exam${examIds.length === 1 ? "" : "s"} added to cluster`)
  }

  const removeExamFromCluster = (examId: string, clusterValue: string) => {
    assignQuizToCluster(examId, null)
    setOrganizationMap(loadQuizOrganizationMap())
    if (clusterExamOrderMap[clusterValue]?.includes(examId)) {
      persistClusterOrderMap({
        ...clusterExamOrderMap,
        [clusterValue]: clusterExamOrderMap[clusterValue].filter((id) => id !== examId),
      })
    }
    toast.success("Exam removed from cluster")
  }

  const moveExamInCluster = (clusterValue: string, examId: string, direction: "up" | "down") => {
    const clusterIds = quizzes
      .filter((quiz) => getQuizClusterValue(quiz.id) === clusterValue)
      .sort((a, b) => (b.updated_at ? new Date(b.updated_at).getTime() : 0) - (a.updated_at ? new Date(a.updated_at).getTime() : 0))
      .map((quiz) => quiz.id)
    const orderedIds = buildOrderedClusterExamIds(clusterValue, clusterIds, clusterExamOrderMap)
    const index = orderedIds.indexOf(examId)
    if (index === -1) return
    if (direction === "up" && index === 0) return
    if (direction === "down" && index === orderedIds.length - 1) return

    const swapIndex = direction === "up" ? index - 1 : index + 1
    const nextIds = [...orderedIds]
    const [moved] = nextIds.splice(index, 1)
    nextIds.splice(swapIndex, 0, moved)
    persistClusterOrderMap({
      ...clusterExamOrderMap,
      [clusterValue]: nextIds,
    })
  }

  const clusterSnapshots = useMemo(
    () =>
      displayClusterOptions.map((option) => {
        const clusterQuizzes = quizzes
          .filter((quiz) => getQuizClusterValue(quiz.id) === option.value && !pendingDeleteExamIds.has(quiz.id))
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
    [displayClusterOptions, getQuizClusterValue, quizzes, pendingDeleteExamIds]
  )

  const activeFilterPills = useMemo(() => {
    const pills: Array<{ key: string; label: string; onRemove: () => void }> = []
    if (appliedFilters.query.trim()) {
      pills.push({
        key: "query",
        label: `Search: ${appliedFilters.query.trim()}`,
        onRemove: () =>
          setAppliedFilters((prev) => ({
            ...prev,
            query: "",
          })),
      })
    }
    if (appliedFilters.questionMin || appliedFilters.questionMax) {
      const minLabel = appliedFilters.questionMin || "0"
      const maxLabel = appliedFilters.questionMax || "∞"
      pills.push({
        key: "questions",
        label: `Questions: ${minLabel}-${maxLabel}`,
        onRemove: () =>
          setAppliedFilters((prev) => ({
            ...prev,
            questionMin: "",
            questionMax: "",
          })),
      })
    }
    if (appliedFilters.createdFrom || appliedFilters.createdTo) {
      pills.push({
        key: "created",
        label: `Created: ${appliedFilters.createdFrom || "Any"} to ${appliedFilters.createdTo || "Any"}`,
        onRemove: () =>
          setAppliedFilters((prev) => ({
            ...prev,
            createdFrom: "",
            createdTo: "",
          })),
      })
    }
    if (appliedFilters.statuses.length > 0) {
      pills.push({
        key: "statuses",
        label: `Status: ${appliedFilters.statuses.join(", ")}`,
        onRemove: () =>
          setAppliedFilters((prev) => ({
            ...prev,
            statuses: [],
          })),
      })
    }
    if (appliedFilters.clusterValue !== "__all__") {
      const selectedCluster = displayClusterOptions.find((option) => option.value === appliedFilters.clusterValue)
      pills.push({
        key: "cluster",
        label: `Cluster: ${selectedCluster?.label ?? "Selected"}`,
        onRemove: () =>
          setAppliedFilters((prev) => ({
            ...prev,
            clusterValue: "__all__",
          })),
      })
    }
    if (appliedFilters.difficulty !== "ALL") {
      pills.push({
        key: "difficulty",
        label: `Difficulty: ${appliedFilters.difficulty}`,
        onRemove: () =>
          setAppliedFilters((prev) => ({
            ...prev,
            difficulty: "ALL",
          })),
      })
    }
    if (appliedFilters.updatedRelative !== "any") {
      const updatedLabel =
        appliedFilters.updatedRelative === "today"
          ? "Today"
          : appliedFilters.updatedRelative === "week"
          ? "This week"
          : appliedFilters.updatedRelative === "month"
          ? "This month"
          : `${appliedFilters.updatedFrom || "Any"} to ${appliedFilters.updatedTo || "Any"}`
      pills.push({
        key: "updated",
        label: `Updated: ${updatedLabel}`,
        onRemove: () =>
          setAppliedFilters((prev) => ({
            ...prev,
            updatedRelative: "any",
            updatedFrom: "",
            updatedTo: "",
          })),
      })
    }
    return pills
  }, [appliedFilters, displayClusterOptions])

  return (
    <section className="space-y-8 pb-32">
      <PageHeader
        eyebrow="EXAMS"
        title="Manage and monitor exams"
        subtitle="Track live, published, processing, and draft quizzes from one operational workspace."
      />

      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="relative flex min-h-9 flex-1 items-center gap-2">
              <Input
                ref={searchInputRef}
                type="text"
                value={appliedFilters.query}
                onChange={(event) => {
                  const newQuery = event.target.value
                  setAppliedFilters((prev) => ({ ...prev, query: newQuery }))
                }}
                onKeyDown={handleSearchInputKeyDown}
                placeholder="Search exams by name or keyword..."
                className="h-9 flex-1 rounded-[8px] border-[0.5px] border-border bg-[var(--bg-tertiary)] text-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label="Search exams by name or keyword"
              />
              <Button
                ref={searchButtonRef}
                type="button"
                variant="outline"
                size="icon"
                aria-label="Open advanced exam filters"
                onClick={() => setSearchPanelOpen((current) => !current)}
                className="relative h-9 w-9 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-muted)] shadow-sm hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]/40 focus-visible:ring-offset-2"
              >
                <Search className="size-4" />
                {activeFilterCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--brand-accent)] px-1 text-[10px] font-semibold text-[var(--text-on-green)]">
                    {activeFilterCount}
                  </span>
                ) : null}
            </Button>

            <div className="flex min-h-9 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap">
              {activeFilterPills.map((pill) => (
                <span key={pill.key} className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 text-xs font-medium text-[var(--text-secondary)]">
                  {pill.label}
                  <button
                    type="button"
                    onClick={pill.onRemove}
                    className="inline-flex size-4 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2"
                    aria-label={`Remove ${pill.label} filter`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {activeFilterPills.length > 0 ? (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="h-9 px-1 text-xs font-medium text-[var(--brand-accent-text)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]/40 focus-visible:ring-offset-2"
                  >
                    Clear all filters
                  </button>
              ) : null}
            </div>

            {searchPanelOpen ? (
              <div
                ref={searchPanelRef}
                role="dialog"
                aria-modal="false"
                aria-label="Advanced exam filters"
                onKeyDown={handleSearchPanelKeyDown}
                className="absolute left-0 top-11 z-40 w-full max-w-[620px] rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 shadow-[0_24px_64px_rgba(0,0,0,0.6)] motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Number of questions</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={draftFilters.questionMin}
                        onChange={(event) => setDraftFilters((prev) => ({ ...prev, questionMin: event.target.value }))}
                        placeholder="Min"
                        className="h-9 rounded-[8px] border-[0.5px] border-border focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      />
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={draftFilters.questionMax}
                        onChange={(event) => setDraftFilters((prev) => ({ ...prev, questionMax: event.target.value }))}
                        placeholder="Max"
                        className="h-9 rounded-[8px] border-[0.5px] border-border focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Date created</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={draftFilters.createdFrom}
                        onChange={(event) => setDraftFilters((prev) => ({ ...prev, createdFrom: event.target.value }))}
                        className="h-9 rounded-[8px] border-[0.5px] border-border focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      />
                      <Input
                        type="date"
                        value={draftFilters.createdTo}
                        onChange={(event) => setDraftFilters((prev) => ({ ...prev, createdTo: event.target.value }))}
                        className="h-9 rounded-[8px] border-[0.5px] border-border focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                    <div className="flex flex-wrap gap-2 rounded-[8px] border-[0.5px] border-border p-2">
                      {STATUS_OPTIONS.map((status) => {
                        const checked = draftFilters.statuses.includes(status)
                        return (
                          <label key={status} className="inline-flex items-center gap-2 text-xs text-foreground">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => {
                                const shouldCheck = value === true
                                setDraftFilters((prev) => ({
                                  ...prev,
                                  statuses: shouldCheck
                                    ? [...prev.statuses, status]
                                    : prev.statuses.filter((item) => item !== status),
                                }))
                              }}
                            />
                            {status}
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Cluster</label>
                    <div className="space-y-2 rounded-[8px] border-[0.5px] border-border p-2">
                      <Input
                        value={clusterSearchQuery}
                        onChange={(event) => setClusterSearchQuery(event.target.value)}
                        placeholder="Search clusters..."
                        className="h-9 rounded-[8px] border-[0.5px] border-border focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      />
                      <div className="max-h-28 space-y-1 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => setDraftFilters((prev) => ({ ...prev, clusterValue: "__all__" }))}
                          className={cn(
                            "flex h-8 w-full items-center rounded-[8px] px-2 text-left text-xs",
                            draftFilters.clusterValue === "__all__" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                          )}
                        >
                          All clusters
                        </button>
                        {filteredClusterOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setDraftFilters((prev) => ({ ...prev, clusterValue: option.value }))}
                            className={cn(
                              "flex h-8 w-full items-center rounded-[8px] px-2 text-left text-xs",
                              draftFilters.clusterValue === option.value ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Difficulty level</label>
                    <div className="grid h-9 grid-cols-4 rounded-[8px] border-[0.5px] border-border p-0.5">
                      {(["ALL", "LOW", "MEDIUM", "HIGH"] as DifficultyLevel[]).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setDraftFilters((prev) => ({ ...prev, difficulty: level }))}
                          className={cn(
                            "rounded-[6px] text-xs font-medium",
                            draftFilters.difficulty === level ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                          )}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Last updated</label>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { value: "today", label: "Today" },
                        { value: "week", label: "This week" },
                        { value: "month", label: "This month" },
                        { value: "custom", label: "Custom" },
                      ] as Array<{ value: Exclude<RelativeUpdated, "any">; label: string }>).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setDraftFilters((prev) => ({ ...prev, updatedRelative: option.value }))}
                          className={cn(
                            "h-8 rounded-full border border-border px-3 text-xs",
                            draftFilters.updatedRelative === option.value ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            updatedRelative: "any",
                            updatedFrom: "",
                            updatedTo: "",
                          }))
                        }
                        className={cn(
                          "h-8 rounded-full border border-border px-3 text-xs",
                          draftFilters.updatedRelative === "any" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                        )}
                      >
                        Any
                      </button>
                    </div>
                    {draftFilters.updatedRelative === "custom" ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <Input
                          type="date"
                          value={draftFilters.updatedFrom}
                          onChange={(event) => setDraftFilters((prev) => ({ ...prev, updatedFrom: event.target.value }))}
                          className="h-9 rounded-[8px] border-[0.5px] border-border focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        />
                        <Input
                          type="date"
                          value={draftFilters.updatedTo}
                          onChange={(event) => setDraftFilters((prev) => ({ ...prev, updatedTo: event.target.value }))}
                          className="h-9 rounded-[8px] border-[0.5px] border-border focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftFilters(defaultAdvancedFilters)
                      setClusterSearchQuery("")
                      // Also clear the top search bar
                      setAppliedFilters(defaultAdvancedFilters)
                      setSearchPanelOpen(false)
                    }}
                    className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    Clear all
                  </button>
                  <Button
                    type="button"
                    onClick={() => {
                      // Merge draftFilters with the keyword from top search bar
                      setAppliedFilters((prev) => ({
                        ...draftFilters,
                        query: prev.query // Keep the keyword from top search bar
                      }))
                      setSearchPanelOpen(false)
                    }}
                    className="h-9 rounded-xl border border-primary bg-primary px-4 text-primary-foreground focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]/40 focus-visible:ring-offset-2"
                  >
                    Apply filters
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="h-9 w-[190px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-sm shadow-sm focus:ring-2 focus:ring-[var(--brand-accent)]/40 focus:ring-offset-2 [&>svg]:hidden text-[var(--text-secondary)]">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <ArrowUpDown className="size-4 shrink-0 text-[var(--text-muted)]" />
                  <SelectValue placeholder="Last updated" />
                </span>
                <ChevronDown className="size-4 shrink-0 text-[var(--text-muted)]" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">Last updated</SelectItem>
                <SelectItem value="created">Date created</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
                <SelectItem value="questions">Number of questions</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

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
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="default"
                size="sm"
                className="rounded-full shadow-sm"
                onClick={() => setShowCreateClusterDialog(true)}
              >
                <Plus className="mr-2 size-4" />
                Create Cluster
              </Button>
              {displayClusterOptions.length > 0 ? (
                <>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full shadow-sm"
                  onClick={() => setSelectedClusterValues(new Set(displayClusterOptions.map((cluster) => cluster.value)))}
                >
                  <CheckSquare className="mr-2 size-4" />
                  Select All Clusters
                </Button>
                {selectedClusterValues.size > 0 ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-full shadow-sm"
                    onClick={() => executeClusterDeleteWithUndo(Array.from(selectedClusterValues))}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete {selectedClusterValues.size}
                  </Button>
                ) : null}
                </>
              ) : null}
            </div>
        </div>
        
        {displayClusterOptions.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {clusterSnapshots.map((cluster) => {
              const isClusterSelected = selectedClusterValues.has(cluster.value)

              return (
              <div
                key={cluster.value}
                className={cn(
                  pageCardInteractiveClass,
                  "group relative space-y-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] dashboard-fade-up",
                  isClusterSelected && "ring-2 ring-[var(--brand-accent)] ring-offset-2 border-[var(--brand-accent)]/50 bg-[var(--brand-accent)]/5"
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleClusterSelection(cluster.value)}
                  className={cn(
                    "absolute left-3 top-3 z-10 flex size-6 items-center justify-center rounded border bg-background transition-all hover:bg-muted shadow-sm",
                    isClusterSelected && "bg-primary border-primary hover:bg-primary/90"
                  )}
                  aria-label={isClusterSelected ? "Deselect cluster" : "Select cluster"}
                >
                  {isClusterSelected ? (
                    <CheckSquare className="size-4 text-primary-foreground" />
                  ) : (
                    <Square className="size-4 text-muted-foreground" />
                  )}
                </button>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 pl-8">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--brand-accent-tint)] text-[var(--brand-accent-text)] shrink-0">
                      <FolderOpen className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground leading-tight">{cluster.label}</p>
                      <p className="text-xs text-muted-foreground font-medium">{cluster.total} exam{cluster.total === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        className="relative z-20 h-8 w-8 rounded-lg transition-all duration-200 hover:bg-[var(--brand-accent-tint)] group-hover:shadow-sm"
                      >
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Cluster actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setActiveClusterModal(cluster.value)}>
                        <FolderOpen className="size-4" />
                        Open cluster
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openAddExamsDialog(cluster.value)}>
                        <Plus className="size-4" />
                        Add unclustered exams
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => selectClusterExams(cluster.value)}>
                        <CheckSquare className="size-4" />
                        Select exams inside
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => executeClusterDeleteWithUndo([cluster.value])}
                      >
                        <Trash2 className="size-4" />
                        Delete cluster
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-3 flex-1">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                    <Layers className="size-3" /> Recent Activity
                  </p>
                  {cluster.recent.length > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {cluster.recent.map((quiz) => (
                        <li key={`${cluster.value}-${quiz.id}`} className="truncate text-xs font-medium text-foreground/80 flex items-center gap-2">
                          <div className="size-1 rounded-full bg-[var(--brand-accent)] shrink-0" />
                          <span className="truncate">{quiz.title}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground py-2 italic">This cluster is currently empty.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40">
                  <Button size="sm" variant="default" className="flex-1 rounded-lg bg-[var(--brand-accent)] text-[var(--text-primary)] shadow-sm hover:bg-[var(--brand-accent-strong)]" onClick={() => setActiveClusterModal(cluster.value)}>
                    Open Cluster
                  </Button>
                  <Tooltip content="Add unclustered exams">
                    <Button size="sm" variant="outline" className="px-3 rounded-lg" onClick={() => openAddExamsDialog(cluster.value)}>
                      <Plus className="size-4" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Select all exams inside">
                    <Button size="sm" variant="outline" className="px-3 rounded-lg" onClick={() => selectClusterExams(cluster.value)}>
                      Select
                    </Button>
                  </Tooltip>
                  <Tooltip content="Delete this cluster">
                    <Button
                      size="sm"
                      variant="outline"
                      className="px-3 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => executeClusterDeleteWithUndo([cluster.value])}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </Tooltip>
                </div>
              </div>
              )
            })}
          </div>
        ) : (
            <div className="rounded-2xl border-2 border-dashed bg-muted/10 p-8 flex flex-col items-center justify-center text-center">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
                <FolderOpen className="size-6" />
              </div>
              <p className="font-semibold">No clusters yet</p>
            <p className="text-sm text-muted-foreground max-w-[300px] mt-1">Make your first cluster of exams to organize and batch them by courses, subjects, or batches.</p>
            <Button
              variant="default"
              className="mt-4 rounded-full shadow-sm"
              onClick={() => setShowCreateClusterDialog(true)}
            >
              <Plus className="mr-2 size-4" />
              Create Cluster
            </Button>
            </div>
          )}
      </section>

      {/* Filterable List */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader title="Operational Snapshot" description="Exams organized by readiness, status, and targeted properties." icon={pageIcons.exams} />
          
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              className="rounded-full shadow-sm"
              disabled={visibleQuizzes.length === 0}
            >
              {selectedIds.size === visibleQuizzes.length && visibleQuizzes.length > 0 ? (
                <>
                  <CheckSquare className="mr-2 size-4 text-primary" />
                  Unselect All Exams
                </>
              ) : (
                <>
                  <CheckSquare className="mr-2 size-4 text-primary" />
                  Select All Exams
                </>
              )}
            </Button>
            {selectedIds.size > 0 ? (
              <Button
                variant="destructive"
                size="sm"
                className="rounded-full shadow-sm"
                onClick={() => executeExamDeleteWithUndo(Array.from(selectedIds))}
              >
                <Trash2 className="mr-2 size-4" />
                Delete {selectedIds.size}
              </Button>
            ) : null}
          </div>
        </div>
        
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`exam-skeleton-${index}`}
                className={cn("dashboard-fade-up md:col-span-2 xl:col-span-3", pageCardClass, "animate-pulse")}
                style={{ animationDelay: `${120 + index * 50}ms` }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="h-4 w-52 rounded bg-muted" />
                  <div className="h-6 w-24 rounded-full bg-muted" />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-5/6 rounded bg-muted" />
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <div className="h-8 w-32 rounded-[8px] bg-muted" />
                  <div className="h-8 w-24 rounded-[8px] bg-muted" />
                </div>
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
              const openExamHref = `/quiz/${quiz.id}`
              const studentExamHref = `/exam/${quiz.id}/start`
              const quizCluster = organizationMap[quiz.id]
              const isUnclustered = !quizCluster?.course_name
              const clusterLabel = isUnclustered
                ? "Unclustered"
                : `${quizCluster.course_name}${quizCluster.unit_name ? ` • ${quizCluster.unit_name}` : ""}`

              const progressBarColor = readiness >= 80 ? "bg-[var(--brand-accent)]" : readiness >= 40 ? "bg-amber-500" : "bg-rose-500"
              const cardGradient = getCardGradient(quiz.title ?? "")
              const iconBgClass = getCardIconBg(quiz.title ?? "")

              return (
                <div
                  key={quiz.id}
                  className={cn(
                    "dashboard-fade-up group relative flex flex-col justify-between rounded-[16px] border border-border/60 p-5 transition-all duration-200 ease-in-out",
                    "hover:-translate-y-[2px] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_8px_30px_rgba(255,255,255,0.02)] hover:border-primary/20",
                    isSelected && "ring-2 ring-[var(--brand-accent)] ring-offset-2 border-[var(--brand-accent)]/50 bg-[var(--brand-accent)]/5"
                  )}
                  style={{ animationDelay: `${120 + index * 60}ms`, background: cardGradient }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSelection(quiz.id)
                    }}
                    className={cn(
                      "absolute left-3 top-3 z-10 flex size-6 items-center justify-center rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] transition-all hover:bg-[var(--bg-tertiary)] shadow-sm",
                      isSelected && "bg-[var(--brand-accent)] border-[var(--brand-accent)] hover:bg-[var(--brand-accent-strong)]"
                    )}
                  >
                    {isSelected ? (
                      <CheckSquare className="size-4 text-primary-foreground" />
                    ) : (
                      <Square className="size-4 text-muted-foreground" />
                    )}
                  </button>

                  <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-[var(--bg-secondary)]/90 shadow-sm border border-[var(--border-color)]">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Exam actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={openExamHref}>
                            <FileText className="size-4" />
                            Open student exam
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/quiz/${quiz.id}`}>
                            <FolderOpen className="size-4" />
                            Open workspace
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/quiz/${quiz.id}?tab=questions`}>
                            <PencilLine className="size-4" />
                            Edit questions
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/quiz/${quiz.id}?tab=results`}>
                            <BarChart3 className="size-4" />
                            View results
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => executeExamDeleteWithUndo([quiz.id])}
                        >
                          <Trash2 className="size-4" />
                          Delete exam
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-start justify-between gap-3 pl-8">
                    <div className="flex items-start gap-3 flex-1 pr-2">
                      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl backdrop-blur-md shadow-sm border border-white/10", iconBgClass)}>
                        <FileText className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <Tooltip content={`${questionCount} questions | ${durationLabel} | ${status}`}>
                          <p className="text-[16px] font-bold text-foreground line-clamp-1 cursor-default opacity-90">{quiz.title}</p>
                        </Tooltip>
                        <p className="text-[12px] font-medium text-muted-foreground opacity-80">{formatUpdatedAt(quiz.updated_at)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 pl-8">
                    <Badge className={statusBadgeClasses(status)}>{status}</Badge>
                    {isUnclustered ? (
                      <Badge variant="secondary" className="bg-[#f3f4f6] text-[#374151] dark:bg-[rgba(255,255,255,0.08)] dark:text-[#e5e7eb] border-0 shadow-none font-medium">Unclustered</Badge>
                    ) : (
                      <Badge className="bg-secondary text-secondary-foreground border-transparent max-w-[120px] truncate shadow-none font-medium">{clusterLabel}</Badge>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 opacity-70" />
                      <span>{questionCount} q</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock3 className="size-4 opacity-70" />
                      <span>{durationLabel}</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground opacity-80">
                      <span>Setup progress</span>
                      <span className={cn(readiness >= 80 ? "text-[var(--brand-accent-text)] dark:text-[var(--brand-accent)]" : "")}>{readiness}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
                      <div className={cn("h-full rounded-full transition-all duration-300", progressBarColor)} style={{ width: `${readiness}%` }} />
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-2 border-t pt-4">
                    <Link
                      href={openExamHref}
                      className={cn(buttonVariants({ size: "sm" }), "flex-1 rounded-lg bg-[var(--brand-accent)] text-[var(--text-primary)] shadow-sm hover:bg-[var(--brand-accent-strong)]")}
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

      {!isLoading && visibleQuizzes.length === 0 && (
        <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-10 text-center shadow-sm">
          <div className="mx-auto mb-6 flex size-24 items-center justify-center rounded-full border border-border bg-muted/20">
            <FileText className="size-10 text-muted-foreground" />
          </div>
          <p className="text-lg font-semibold text-foreground">
            {quizzes.length === 0 ? "No exams yet" : "No exams found"}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {quizzes.length === 0
              ? "Create your first exam to start assessing your students with AI-powered quizzes."
              : !isDefaultAdvancedFilters(appliedFilters)
              ? "Try adjusting your filters to find what you're looking for."
              : "No exam data is available for the selected view."}
          </p>
          <div className="mt-6 flex items-center justify-center gap-2">
            {quizzes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Use the Create menu in the top navigation to add your first exam.</p>
            ) : !isDefaultAdvancedFilters(appliedFilters) ? (
              <Button variant="outline" className="h-9 rounded-xl" onClick={clearAllFilters}>
                Clear filters
              </Button>
            ) : null}
            <Select value={bulkClusterValue} onValueChange={setBulkClusterValue}>
              <SelectTrigger className="h-9 w-[190px] rounded-full border-dashed bg-transparent hover:bg-muted/50 focus:ring-0 text-xs font-medium">
                <SelectValue placeholder="Move to cluster..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-muted-foreground font-semibold">Remove from cluster</SelectItem>
                {displayClusterOptions.map((option) => (
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
              <Button variant="ghost" size="sm" className="rounded-full h-9 w-9 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => executeExamDeleteWithUndo(Array.from(selectedIds))}>
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
            const activeOption = displayClusterOptions.find((option) => option.value === activeClusterModal)
            if (!activeOption) return <div className="p-10 text-center">Cluster not found</div>

            const sortedClusterExams = quizzes
              .filter((quiz) => getQuizClusterValue(quiz.id) === activeOption.value)
              .sort((a, b) => (b.updated_at ? new Date(b.updated_at).getTime() : 0) - (a.updated_at ? new Date(a.updated_at).getTime() : 0))
            const orderedClusterExamIds = buildOrderedClusterExamIds(
              activeOption.value,
              sortedClusterExams.map((quiz) => quiz.id),
              clusterExamOrderMap
            )
            const clusterExams = orderedClusterExamIds
              .map((quizId) => sortedClusterExams.find((quiz) => quiz.id === quizId))
              .filter((quiz): quiz is (typeof sortedClusterExams)[number] => Boolean(quiz))
            const recentPreview = sortedClusterExams.slice(0, 3)

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
                          {clusterExams.length} {clusterExams.length === 1 ? "exam" : "exams"} assigned inside this cluster.
                        </DialogDescription>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" className="rounded-lg" onClick={() => openAddExamsDialog(activeOption.value)}>
                        <Plus className="mr-2 size-4" />
                        Add Exams
                      </Button>
                      {clusterExams.length > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg"
                          onClick={() => setSelectedIds(new Set(clusterExams.map((exam) => exam.id)))}
                        >
                          <CheckSquare className="mr-2 size-4" />
                          Select All in Cluster
                        </Button>
                      ) : null}
                    </div>
                  </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-background space-y-4">
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Recent (Top 3)</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {recentPreview.length > 0 ? (
                        recentPreview.map((quiz) => (
                          <Badge key={`recent-${quiz.id}`} variant="outline" className="max-w-[260px] truncate">
                            {quiz.title}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">No recent exams yet.</span>
                      )}
                    </div>
                  </div>
                  {clusterExams.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed rounded-2xl bg-muted/20">
                      <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <FolderOpen className="size-8 text-muted-foreground/50" />
                      </div>
                      <p className="text-base font-bold text-foreground">This cluster is completely empty.</p>
                      <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                        Add exams from unclustered list to start building this teaching batch.
                      </p>
                      <Button className="mt-4 rounded-lg" onClick={() => openAddExamsDialog(activeOption.value)}>
                        <Plus className="mr-2 size-4" />
                        Add Exams
                      </Button>
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
                              <Link
                                href={`/quiz/${exam.id}`}
                                className={cn(buttonVariants({ size: "sm" }), "h-9 rounded-lg px-4 shadow-sm")}
                              >
                                Open Exam
                              </Link>
                              <Tooltip content="Move up">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-9 w-9 p-0 rounded-lg"
                                  disabled={index === 0}
                                  onClick={() => moveExamInCluster(activeOption.value, exam.id, "up")}
                                >
                                  <ArrowUp className="size-4" />
                                </Button>
                              </Tooltip>
                              <Tooltip content="Move down">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-9 w-9 p-0 rounded-lg"
                                  disabled={index === clusterExams.length - 1}
                                  onClick={() => moveExamInCluster(activeOption.value, exam.id, "down")}
                                >
                                  <ArrowDown className="size-4" />
                                </Button>
                              </Tooltip>
                              <Tooltip content="Remove exam from this cluster">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                  onClick={() => removeExamFromCluster(exam.id, activeOption.value)}
                                >
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

      <Dialog open={showAddExamsDialog} onOpenChange={setShowAddExamsDialog}>
        <DialogContent className="sm:max-w-2xl">
          {(() => {
            const activeOption = displayClusterOptions.find((option) => option.value === activeClusterModal)
            if (!activeOption) {
              return (
                <>
                  <DialogHeader>
                    <DialogTitle>Cluster not found</DialogTitle>
                    <DialogDescription>Select a cluster and try again.</DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddExamsDialog(false)}>
                      Close
                    </Button>
                  </DialogFooter>
                </>
              )
            }

            return (
              <>
                <DialogHeader>
                  <DialogTitle>Add Exams to {activeOption.label}</DialogTitle>
                  <DialogDescription>
                    Pick from unclustered exams. Save stays disabled until at least one exam is selected.
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-[52vh] overflow-y-auto rounded-xl border bg-muted/10 p-3">
                  {unclusteredQuizzes.length === 0 ? (
                    <div className="rounded-lg border border-dashed bg-background p-6 text-center text-sm text-muted-foreground">
                      All exams are already assigned to clusters.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {unclusteredQuizzes.map((quiz) => {
                        const checked = pendingClusterExamIds.has(quiz.id)
                        return (
                          <label
                            key={`add-exam-${quiz.id}`}
                            className={cn(
                              "flex items-start gap-3 rounded-lg border bg-background p-3 transition-colors",
                              checked ? "border-primary/60 bg-primary/5" : "hover:bg-muted/40"
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => togglePendingClusterExam(quiz.id, value === true)}
                              className="mt-0.5"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{quiz.title}</p>
                              <p className="text-xs text-muted-foreground">Updated {formatUpdatedAt(quiz.updated_at)}</p>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPendingClusterExamIds(new Set())
                      setShowAddExamsDialog(false)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={savePendingExamsToCluster} disabled={pendingClusterExamIds.size === 0}>
                    Save
                  </Button>
                </DialogFooter>
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

      {/* Delete Cluster Options Dialog */}
      <Dialog open={showClusterDeleteDialog} onOpenChange={setShowClusterDeleteDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Cluster</DialogTitle>
            <DialogDescription>
              Choose what to do with the exams in this cluster.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-6">
            <div className="space-y-3">
              <label 
                className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                style={{
                  borderColor: clusterDeleteOption === 'cluster-only' ? 'var(--brand-accent)' : 'var(--border-color)',
                  backgroundColor: clusterDeleteOption === 'cluster-only' ? 'var(--brand-accent-tint)' : 'transparent'
                }}
              >
                <input 
                  type="radio" 
                  name="delete-option" 
                  value="cluster-only"
                  checked={clusterDeleteOption === 'cluster-only'}
                  onChange={() => setClusterDeleteOption('cluster-only')}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-sm">Delete only cluster</p>
                  <p className="text-xs text-muted-foreground mt-1">Exams will remain as unclustered and you can organize them later.</p>
                </div>
              </label>
              <label 
                className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                style={{
                  borderColor: clusterDeleteOption === 'with-exams' ? 'var(--brand-accent)' : 'var(--border-color)',
                  backgroundColor: clusterDeleteOption === 'with-exams' ? 'var(--brand-accent-tint)' : 'transparent'
                }}
              >
                <input 
                  type="radio" 
                  name="delete-option" 
                  value="with-exams"
                  checked={clusterDeleteOption === 'with-exams'}
                  onChange={() => setClusterDeleteOption('with-exams')}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-sm">Delete cluster and all exams</p>
                  <p className="text-xs text-muted-foreground mt-1">Both the cluster and all exams inside will be permanently deleted.</p>
                </div>
              </label>
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="ghost" className="font-semibold" onClick={() => setShowClusterDeleteDialog(false)}>Cancel</Button>
            <Button 
              variant="destructive"
              className="px-6"
              disabled={!clusterDeleteOption}
              onClick={() => performClusterDelete(clusterDeleteOption === 'with-exams')}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
