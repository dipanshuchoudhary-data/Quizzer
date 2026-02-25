"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { quizApi } from "@/lib/api/quiz"
import { getApiErrorMessage } from "@/lib/api/error"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { LifecycleBadge } from "@/components/common/LifecycleBadge"
import { QuizCreationWizard } from "@/features/quiz/creation/QuizCreationWizard"
import { useQuizSelectionStore } from "@/stores/useQuizSelectionStore"

type GroupMode = "none" | "course" | "status"
type SortMode = "newest" | "oldest" | "modified" | "alpha"

type CourseMap = Record<string, string>

const COURSE_KEY = "quizzer_course_map"

function getCourseMap(): CourseMap {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(window.localStorage.getItem(COURSE_KEY) ?? "{}")
  } catch {
    return {}
  }
}

function saveCourseMap(map: CourseMap) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(COURSE_KEY, JSON.stringify(map))
}

export default function QuizzesPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const [openCreate, setOpenCreate] = useState(false)
  const [courseMap, setCourseMap] = useState<CourseMap>({})
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const selectedQuizIds = useQuizSelectionStore((s) => s.selectedQuizIds)
  const toggleQuiz = useQuizSelectionStore((s) => s.toggleQuiz)
  const clearQuizSelection = useQuizSelectionStore((s) => s.clearQuizSelection)

  const q = searchParams.get("q") ?? ""
  const status = searchParams.get("status") ?? "all"
  const course = searchParams.get("course") ?? "all"
  const created = searchParams.get("created") ?? "all"
  const sort = (searchParams.get("sort") ?? "newest") as SortMode
  const group = (searchParams.get("group") ?? "none") as GroupMode

  const { data: quizzes = [], isLoading, refetch } = useQuery({
    queryKey: ["quizzes"],
    queryFn: quizApi.getAll,
  })

  useEffect(() => {
    setCourseMap(getCourseMap())
  }, [])

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setOpenCreate(true)
    }
  }, [searchParams])

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete("create")
    next.delete("source")
    if (!value || value === "all" || value === "none") next.delete(key)
    else next.set(key, value)
    router.replace(`${pathname}?${next.toString()}`)
  }

  const deleteQuiz = useMutation({
    mutationFn: quizApi.deleteById,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] })
      toast.success("Quiz deleted")
    },
  })

  const publishQuiz = useMutation({
    mutationFn: quizApi.publish,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quizzes"] })
      toast.success("Publish requested")
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, "Publish blocked by validation")),
  })

  const regenerateQuiz = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { extracted_text: string; blueprint: Record<string, unknown> } }) =>
      quizApi.generate(id, payload),
    onSuccess: () => toast.success("AI regeneration started"),
    onError: () => toast.error("Could not regenerate selected quiz"),
  })

  useEffect(() => {
    const focusSearch = () => {
      const node = document.getElementById("quiz-search-input") as HTMLInputElement | null
      node?.focus()
    }
    const bulkPublish = () => {
      if (selectedQuizIds.length === 0) {
        toast.error("No quizzes selected")
        return
      }
      selectedQuizIds.forEach((id) => publishQuiz.mutate(id))
    }
    const bulkRegenerate = () => {
      if (selectedQuizIds.length === 0) {
        toast.error("No quizzes selected")
        return
      }
      selectedQuizIds.forEach((id) =>
        regenerateQuiz.mutate({
          id,
          payload: { extracted_text: "Command palette regeneration", blueprint: { regenerate: true } },
        })
      )
    }

    window.addEventListener("quizzer:search-focus", focusSearch)
    window.addEventListener("quizzer:bulk-publish", bulkPublish)
    window.addEventListener("quizzer:bulk-regenerate", bulkRegenerate)
    return () => {
      window.removeEventListener("quizzer:search-focus", focusSearch)
      window.removeEventListener("quizzer:bulk-publish", bulkPublish)
      window.removeEventListener("quizzer:bulk-regenerate", bulkRegenerate)
    }
  }, [selectedQuizIds, publishQuiz, regenerateQuiz])

  const filtered = useMemo(() => {
    const now = Date.now()
    let list = quizzes.filter((quiz) => {
      const c = courseMap[quiz.id] ?? "Unassigned"
      const statusMatch = status === "all" || quiz.ai_generation_status.toLowerCase() === status.toLowerCase()
      const courseMatch = course === "all" || c === course
      const qMatch = q.length === 0 || quiz.title.toLowerCase().includes(q.toLowerCase())

      let dateMatch = true
      if (created === "today" && quiz.created_at) {
        dateMatch = now - new Date(quiz.created_at).getTime() < 86_400_000
      }
      if (created === "week" && quiz.created_at) {
        dateMatch = now - new Date(quiz.created_at).getTime() < 7 * 86_400_000
      }
      return statusMatch && courseMatch && qMatch && dateMatch
    })

    list = [...list].sort((a, b) => {
      if (sort === "alpha") return a.title.localeCompare(b.title)
      if (sort === "oldest") return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
      if (sort === "modified") return new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    })
    return list
  }, [quizzes, courseMap, status, course, q, created, sort])

  const grouped = useMemo(() => {
    if (group === "none") return { All: filtered }
    return filtered.reduce<Record<string, typeof filtered>>((acc, quiz) => {
      const key = group === "course" ? courseMap[quiz.id] ?? "Unassigned" : quiz.ai_generation_status
      acc[key] = acc[key] ? [...acc[key], quiz] : [quiz]
      return acc
    }, {})
  }, [filtered, group, courseMap])

  const courseOptions = useMemo(
    () => ["Unassigned", ...Array.from(new Set(Object.values(courseMap).filter(Boolean)))],
    [courseMap]
  )

  const applyCourseToSelected = (value: string) => {
    if (selectedQuizIds.length === 0) return
    const next = { ...courseMap }
    selectedQuizIds.forEach((id) => {
      next[id] = value
    })
    setCourseMap(next)
    saveCourseMap(next)
    toast.success(`Moved ${selectedQuizIds.length} quiz(es) to ${value}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Quiz Management</h1>
        <p className="text-sm text-muted-foreground">Use top-right Create Quiz to open the AI flow.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters & Sorting</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Input
            id="quiz-search-input"
            placeholder="Search by title"
            value={q}
            onChange={(e) => setParam("q", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault()
            }}
          />
          <Select value={status} onValueChange={(v) => setParam("status", v)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="PROCESSING">Processing</SelectItem>
              <SelectItem value="PUBLISHED">Published</SelectItem>
            </SelectContent>
          </Select>
          <Select value={course} onValueChange={(v) => setParam("course", v)}>
            <SelectTrigger><SelectValue placeholder="Course/Class" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courseOptions.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={created} onValueChange={(v) => setParam("created", v)}>
            <SelectTrigger><SelectValue placeholder="Date Created" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Date</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setParam("sort", v)}>
            <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="modified">Recently Modified</SelectItem>
              <SelectItem value="alpha">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={group} onValueChange={(v) => setParam("group", v)}>
            <SelectTrigger><SelectValue placeholder="Grouping" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Grouping</SelectItem>
              <SelectItem value="course">Group by Course</SelectItem>
              <SelectItem value="status">Group by Status</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedQuizIds.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <span className="text-sm text-muted-foreground">{selectedQuizIds.length} selected</span>
            <Button size="sm" variant="destructive" onClick={() => selectedQuizIds.forEach((id) => deleteQuiz.mutate(id))}>
              Delete
            </Button>
            <Button size="sm" variant="outline" onClick={() => selectedQuizIds.forEach((id) => publishQuiz.mutate(id))}>
              Publish
            </Button>
            <Select onValueChange={applyCourseToSelected}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Move to course" />
              </SelectTrigger>
              <SelectContent>
                {["Unassigned", "Math", "Physics", "CS", "History"].map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={clearQuizSelection}>Clear</Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? <p className="text-sm text-muted-foreground">Loading quizzes...</p> : null}

      <div className="space-y-3">
        {Object.entries(grouped).map(([groupLabel, items]) => {
          const collapsed = collapsedGroups[groupLabel] ?? false
          return (
            <Card key={groupLabel}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{groupLabel} ({items.length})</CardTitle>
                {group !== "none" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCollapsedGroups((prev) => ({ ...prev, [groupLabel]: !collapsed }))}
                  >
                    {collapsed ? "Expand" : "Collapse"}
                  </Button>
                )}
              </CardHeader>
              {!collapsed && (
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((quiz) => (
                    <div key={quiz.id} className="rounded-lg border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedQuizIds.includes(quiz.id)}
                            onCheckedChange={() => toggleQuiz(quiz.id)}
                          />
                          <p className="line-clamp-1 font-medium">{quiz.title}</p>
                        </div>
                        <LifecycleBadge lifecycle={quiz.ai_generation_status} />
                      </div>
                      <p className="line-clamp-2 text-sm text-muted-foreground">{quiz.description || "No description provided."}</p>
                      <div className="mt-2">
                        <Select
                          value={courseMap[quiz.id] ?? "Unassigned"}
                          onValueChange={(value) => {
                            const next = { ...courseMap, [quiz.id]: value }
                            setCourseMap(next)
                            saveCourseMap(next)
                          }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Unassigned", "Math", "Physics", "CS", "History"].map((option) => (
                              <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Link href={`/quiz/${quiz.id}`} className="flex-1">
                          <Button className="w-full" variant="outline">Open</Button>
                        </Link>
                        <Button size="sm" variant="outline" onClick={() => publishQuiz.mutate(quiz.id)}>
                          Publish
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteQuiz.mutate(quiz.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Secondary Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline">Import Quiz</Button>
          <Button variant="outline">Templates</Button>
          <Button variant="outline">Analytics</Button>
        </CardContent>
      </Card>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>AI Quiz Creation</DialogTitle>
          </DialogHeader>
          <QuizCreationWizard
            onDone={() => {
              setOpenCreate(false)
              clearQuizSelection()
              void refetch()
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
