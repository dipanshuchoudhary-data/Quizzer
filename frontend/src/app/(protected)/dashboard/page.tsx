"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Manrope } from "next/font/google"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileText,
  Search,
  Sparkles,
  Users,
} from "lucide-react"
import { dashboardApi } from "@/lib/api/dashboard"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { KpiCard, PageHeader, SectionHeader, pageCardClass, pageCardInteractiveClass, pageIcons } from "@/components/page/page-system"
import { useAuthStore } from "@/stores/useAuthStore"
import { getDisplayName } from "@/lib/user"

const dashboardFont = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"] })
const RECENT_SEARCHES_KEY = "quizzer:dashboard-recent-searches-v1"

type ExamTab = "ALL" | "ACTIVE" | "COMPLETED" | "DRAFTS"

type SearchResultItem = {
  id: string
  title: string
  meta: string
  href?: string
}

function isRecent(dateText?: string, days = 7) {
  if (!dateText) return false
  const parsed = new Date(dateText)
  if (Number.isNaN(parsed.getTime())) return false
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return parsed.getTime() >= cutoff
}

function formatDateLabel(dateText?: string) {
  if (!dateText) return "Updated recently"
  const parsed = new Date(dateText)
  if (Number.isNaN(parsed.getTime())) return "Updated recently"
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(parsed)
}

function statusTone(status: "Active" | "Completed" | "Draft") {
  if (status === "Active") return "bg-[var(--brand-accent-soft)] text-[var(--brand-accent)] border border-[var(--brand-accent)]/20"
  if (status === "Completed") return "bg-blue-500/10 text-blue-400 border border-blue-500/20"
  return "bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-color)]"
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase()
}

export default function DashboardPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const displayName = getDisplayName(user)

  const [examTab, setExamTab] = useState<ExamTab>("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [activeSearchIndex, setActiveSearchIndex] = useState(0)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const searchContainerRef = useRef<HTMLDivElement | null>(null)

  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: dashboardApi.getSummary,
    staleTime: 30_000,
  })

  const { data: liveExamsData } = useQuery({
    queryKey: ["dashboard-live-exams"],
    queryFn: dashboardApi.getLiveExams,
    staleTime: 15_000,
  })

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [searchQuery])

  useEffect(() => {
    const normalized = normalizeQuery(searchQuery)
    if (normalized.length === 0) {
      setSearchLoading(false)
      return
    }
    setSearchLoading(true)
    const timeout = window.setTimeout(() => setSearchLoading(false), 220)
    return () => window.clearTimeout(timeout)
  }, [searchQuery])

  useEffect(() => {
    const stored = window.localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!stored) return
    try {
      const parsed = JSON.parse(stored) as string[]
      if (Array.isArray(parsed)) {
        setRecentSearches(parsed.slice(0, 5))
      }
    } catch {
      setRecentSearches([])
    }
  }, [])

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!searchContainerRef.current) return
      if (!searchContainerRef.current.contains(event.target as Node)) {
        setSearchOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false)
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onMouseDown)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  const snapshot = useMemo(() => {
    const total = summary?.stats.total_quizzes ?? 0
    const published = summary?.stats.published_exams ?? 0
    const activeExams = summary?.active_exams ?? []
    const activeAttempts = activeExams.reduce((acc, exam) => acc + exam.active_students, 0)
    const aiJobs = summary?.stats.ai_jobs_running ?? 0

    const totalUpdatedThisWeek = summary?.recent_quizzes.filter((quiz) => isRecent(quiz.updated_at)).length ?? 0
    const publishedThisWeek =
      summary?.recent_quizzes.filter((quiz) => quiz.is_published && isRecent(quiz.updated_at)).length ?? 0

    return {
      total,
      published,
      activeAttempts,
      aiJobs,
      trends: {
        total: totalUpdatedThisWeek,
        published: publishedThisWeek,
      },
    }
  }, [summary])

  const activeExamsById = useMemo(() => {
    const map = new Map<string, { active_students: number; violations_count: number; time_remaining_seconds: number | null }>()
    ;(summary?.active_exams ?? []).forEach((exam) => {
      map.set(exam.id, {
        active_students: exam.active_students,
        violations_count: exam.violations_count,
        time_remaining_seconds: exam.time_remaining_seconds,
      })
    })
    return map
  }, [summary?.active_exams])

  const examCards = useMemo(() => {
    const cards = (summary?.recent_quizzes ?? []).map((quiz) => {
      const active = activeExamsById.get(quiz.id)
      const status = active && (active.time_remaining_seconds ?? 0) > 0 ? "Active" : quiz.is_published ? "Completed" : "Draft"
      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description || "No description provided yet.",
        status: status as "Active" | "Completed" | "Draft",
        updated_at: quiz.updated_at,
        duration: quiz.duration_minutes,
        question_count: quiz.question_count ?? 0,
        active_students: active?.active_students ?? 0,
        violations_count: active?.violations_count ?? 0,
      }
    })

    const byTab = cards.filter((card) => {
      if (examTab === "ALL") return true
      if (examTab === "ACTIVE") return card.status === "Active"
      if (examTab === "COMPLETED") return card.status === "Completed"
      return card.status === "Draft"
    })

    const query = normalizeQuery(debouncedSearchQuery)
    const bySearch =
      query.length === 0
        ? byTab
        : byTab.filter((card) => {
            const haystack = `${card.title} ${card.description} ${card.status}`.toLowerCase()
            return haystack.includes(query)
          })

    return bySearch.sort((a, b) => {
      const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0
      return dateB - dateA
    })
  }, [activeExamsById, debouncedSearchQuery, examTab, summary?.recent_quizzes])

  const searchSections = useMemo(() => {
    const query = normalizeQuery(debouncedSearchQuery)

    const examsItems: SearchResultItem[] = (summary?.recent_quizzes ?? [])
      .filter((quiz) => {
        if (!query) return true
        return `${quiz.title} ${quiz.description ?? ""}`.toLowerCase().includes(query)
      })
      .slice(0, 6)
      .map((quiz) => ({
        id: `exam-${quiz.id}`,
        title: quiz.title,
        meta: `Exam • ${formatDateLabel(quiz.updated_at)}`,
        href: `/quiz/${quiz.id}`,
      }))

    const questionItems: SearchResultItem[] = (summary?.recent_activity ?? [])
      .filter((item) => /question|section|answer|submission/i.test(item.event))
      .filter((item) => {
        if (!query) return true
        return `${item.title} ${item.event}`.toLowerCase().includes(query)
      })
      .slice(0, 6)
      .map((item) => ({
        id: `question-${item.id}`,
        title: item.title,
        meta: `${item.event} • ${formatDateLabel(item.updated_at)}`,
      }))

    const recentItems: SearchResultItem[] = recentSearches.slice(0, 5).map((entry, index) => ({
      id: `recent-${index}`,
      title: entry,
      meta: "Recent search",
    }))

    return [
      { title: "Exams", items: examsItems },
      { title: "Questions", items: questionItems },
      { title: "Recent Searches", items: recentItems },
    ]
  }, [debouncedSearchQuery, recentSearches, summary?.recent_activity, summary?.recent_quizzes])

  const flattenedSearchItems = useMemo(() => searchSections.flatMap((section) => section.items), [searchSections])

  useEffect(() => {
    if (activeSearchIndex >= flattenedSearchItems.length) {
      setActiveSearchIndex(0)
    }
  }, [activeSearchIndex, flattenedSearchItems.length])

  const commitRecentSearch = (query: string) => {
    const normalized = query.trim()
    if (!normalized) return
    const next = [normalized, ...recentSearches.filter((entry) => entry.toLowerCase() !== normalized.toLowerCase())].slice(0, 5)
    setRecentSearches(next)
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next))
  }

  const selectSearchItem = (item: SearchResultItem) => {
    commitRecentSearch(searchQuery)
    setSearchOpen(false)
    if (item.href) {
      router.push(item.href)
      return
    }
    if (item.meta === "Recent search") {
      setSearchQuery(item.title)
      setSearchOpen(true)
    }
  }

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!searchOpen) setSearchOpen(true)
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveSearchIndex((current) => Math.min(current + 1, Math.max(flattenedSearchItems.length - 1, 0)))
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveSearchIndex((current) => Math.max(current - 1, 0))
    }
    if (event.key === "Enter" && flattenedSearchItems[activeSearchIndex]) {
      event.preventDefault()
      selectSearchItem(flattenedSearchItems[activeSearchIndex])
    }
  }

  const topAlert = useMemo(() => {
    const alerts = liveExamsData?.alerts ?? []
    if (alerts.length === 0) return null
    return alerts[0]
  }, [liveExamsData?.alerts])

  return (
    <div className={cn("space-y-8", dashboardFont.className)}>
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome back, ${displayName}.`}
        subtitle="Review status, handle priorities, and move directly to the next action."
      />

      <section className={cn(pageCardClass, "relative overflow-visible border-none bg-none p-0 shadow-none")}>
        <div ref={searchContainerRef} className="relative max-w-4xl">
          <label htmlFor="dashboard-search" className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-accent)]">
            Search workspace
          </label>
          <div className="group relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="dashboard-search"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setActiveSearchIndex(0)
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search exams, questions, or topics..."
              className="h-12 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] pl-11 pr-4 text-sm text-[var(--text-primary)] shadow-sm transition-all duration-200 focus-visible:border-[var(--brand-accent)] focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-[var(--brand-accent-glow)] group-hover:shadow-md"
              aria-expanded={searchOpen}
              aria-haspopup="listbox"
            />
          </div>

          {searchOpen ? (
            <div className="absolute z-40 mt-2 w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 shadow-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200">
              {searchLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={`search-skeleton-${index}`} className="h-12 animate-pulse rounded-xl bg-muted/60" />
                  ))}
                </div>
              ) : flattenedSearchItems.length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">No matching results. Try a broader keyword.</div>
              ) : (
                <div className="space-y-3">
                  {searchSections.map((section) => (
                    <div key={section.title} className="space-y-1">
                      <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{section.title}</p>
                      <div className="space-y-1">
                        {section.items.map((item) => {
                          const index = flattenedSearchItems.findIndex((entry) => entry.id === item.id)
                          const isActive = index === activeSearchIndex
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onMouseEnter={() => setActiveSearchIndex(index)}
                              onClick={() => selectSearchItem(item)}
                              className={cn(
                                "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-all duration-150",
                                isActive
                                  ? "border-[rgba(74,222,128,0.3)] bg-[var(--bg-tertiary)]"
                                  : "border-transparent hover:border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/50"
                              )}
                              role="option"
                              aria-selected={isActive}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                                <p className="truncate text-xs text-muted-foreground">{item.meta}</p>
                              </div>
                              {item.href ? <ArrowRight className="size-4 text-muted-foreground" /> : null}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-[var(--border-color)] pt-2">
                    <Link
                      href="/exams"
                      onClick={() => commitRecentSearch(searchQuery)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-accent)] hover:underline"
                    >
                      View all results
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={`stat-skeleton-${index}`} className={cn(pageCardClass, "animate-pulse p-4")}>
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="mt-4 h-8 w-20 rounded bg-muted" />
              <div className="mt-2 h-3 w-28 rounded bg-muted" />
            </div>
          ))
        ) : (
          [
            {
              title: "Total Quizzes",
              value: snapshot.total,
              trend: snapshot.trends.total > 0 ? "Improving" : "Stable",
              trendContext: snapshot.trends.total > 0 ? `+${snapshot.trends.total} this week` : "No change this week",
              status: snapshot.trends.total > 0 ? "positive" : "neutral",
              icon: BookOpen,
            },
            {
              title: "Published Exams",
              value: snapshot.published,
              trend: snapshot.trends.published > 0 ? "Growing" : "Stable",
              trendContext: snapshot.trends.published > 0 ? `+${snapshot.trends.published} this week` : "No new publishes",
              status: snapshot.trends.published > 0 ? "positive" : "neutral",
              icon: CheckCircle2,
            },
            {
              title: "Active Attempts",
              value: snapshot.activeAttempts,
              trend: snapshot.activeAttempts > 0 ? "Live now" : "Idle",
              trendContext: snapshot.activeAttempts > 0 ? `${snapshot.activeAttempts} students active` : "No live attempts now",
              status: snapshot.activeAttempts > 0 ? "positive" : "neutral",
              icon: Users,
            },
            {
              title: "AI Jobs Running",
              value: snapshot.aiJobs,
              trend: snapshot.aiJobs > 0 ? "In progress" : "Idle",
              trendContext: snapshot.aiJobs > 0 ? `${snapshot.aiJobs} jobs running` : "No active jobs",
              status: snapshot.aiJobs > 0 ? "positive" : "neutral",
              icon: Sparkles,
            },
          ].map((item) => (
            <KpiCard
              key={item.title}
              title={item.title}
              value={item.value}
              trend={item.trend}
              trendContext={item.trendContext}
              status={item.status as "positive" | "neutral"}
              icon={item.icon}
            />
          ))
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.75fr_1fr]">
        <div className={cn(pageCardClass, "space-y-4 p-6")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionHeader title="Exam Hub" description="Scannable exam cards with clear state and metadata." icon={pageIcons.exams} />
            <Link href="/exams" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">
              View all exams
            </Link>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["ALL", "ACTIVE", "COMPLETED", "DRAFTS"] as ExamTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setExamTab(tab)}
                className={cn(
                  "h-9 rounded-full border px-4 text-xs font-semibold tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2",
                  examTab === tab
                    ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]"
                    : "border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]/80 hover:text-[var(--text-secondary)]"
                )}
              >
                {tab === "ALL" ? "All" : tab === "ACTIVE" ? "Active" : tab === "COMPLETED" ? "Completed" : "Drafts"}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`exam-row-skeleton-${index}`} className="rounded-2xl border p-4">
                  <div className="h-4 w-44 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-muted" />
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="h-3 animate-pulse rounded bg-muted" />
                    <div className="h-3 animate-pulse rounded bg-muted" />
                    <div className="h-3 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : examCards.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-muted/10 p-10 text-center">
              <FileText className="mx-auto size-10 text-muted-foreground" />
              <p className="mt-3 text-lg font-semibold text-foreground">No exams found</p>
              <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or exam filter.</p>
              <p className="mt-3 text-xs text-muted-foreground">Use the Create menu in the top navigation to add a new exam.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {examCards.map((exam) => (
                <Link
                  key={exam.id}
                  href={`/quiz/${exam.id}`}
                  className={cn(
                    pageCardInteractiveClass,
                    "space-y-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-foreground">{exam.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{exam.description}</p>
                    </div>
                    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", statusTone(exam.status))}>{exam.status}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock3 className="size-3.5" />
                      {exam.duration ? `${exam.duration} min` : "No limit"}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileText className="size-3.5" />
                      {exam.question_count} questions
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="size-3.5" />
                      {exam.active_students} active
                    </div>
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5" />
                      {exam.violations_count} violations
                    </div>
                  </div>

                  <div className="pt-1 text-[11px] font-medium text-muted-foreground">Updated {formatDateLabel(exam.updated_at)}</div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <aside className={cn(pageCardClass, "space-y-4 p-6")}>
          <SectionHeader title="Live attention" description="What requires action right now." icon={Activity} />
          {topAlert ? (
            <div className="rounded-2xl border border-amber-900/30 bg-amber-900/10 p-4">
              <p className="text-sm font-semibold text-foreground">{topAlert.quiz_name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{topAlert.message}</p>
              <Link href={`/quiz/${topAlert.quiz_id}?tab=monitoring`} className={cn(buttonVariants({ size: "sm" }), "mt-3 h-9 rounded-[10px]")}>
                Open monitoring
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--brand-accent)]/20 bg-[var(--brand-accent)]/5 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-700 dark:text-emerald-300" />
                <p className="text-sm font-semibold text-foreground">Everything looks stable</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">No urgent alerts in live exams right now.</p>
            </div>
          )}

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-4">
            <p className="text-sm font-semibold text-foreground">Recommendations</p>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-1 size-1.5 rounded-full bg-emerald-500" />
                Review exams with high violation counts first.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 size-1.5 rounded-full bg-emerald-500" />
                Keep drafts lightweight and publish only complete sets.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 size-1.5 rounded-full bg-emerald-500" />
                Use search to jump directly to questions and activity logs.
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  )
}
