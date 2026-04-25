"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, FileQuestion, FileText, Search, Sparkles, User } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { dashboardApi } from "@/lib/api/dashboard"
import { quizApi } from "@/lib/api/quiz"

type SearchItem = {
  id: string
  label: string
  href: string
  description?: string
  kind: "exam" | "question" | "student"
}

function normalize(value: string) {
  return value.toLowerCase().trim()
}

function highlightMatch(text: string, query: string) {
  if (!query || !text) return <>{text}</>
  const lowered = text.toLowerCase()
  const match = lowered.indexOf(query.toLowerCase())
  if (match === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, match)}
      <span className="text-[var(--text-primary)] underline decoration-[var(--brand-accent)]/40">{text.slice(match, match + query.length)}</span>
      {text.slice(match + query.length)}
    </>
  )
}

export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isFocused, setIsFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const listId = "global-search-list"

  const { data: quizzes = [], isLoading: loadingQuizzes } = useQuery({
    queryKey: ["search-quizzes"],
    queryFn: quizApi.getAll,
    staleTime: 60000,
  })

  const { data: liveExams, isLoading: loadingLive } = useQuery({
    queryKey: ["search-live-exams"],
    queryFn: dashboardApi.getLiveExams,
    staleTime: 60000,
  })

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["search-summary"],
    queryFn: dashboardApi.getSummary,
    staleTime: 60000,
  })

  const isSearching = loadingQuizzes || loadingLive || loadingSummary

  useEffect(() => {
    const handler = window.setTimeout(() => setDebouncedQuery(query), 300)
    return () => window.clearTimeout(handler)
  }, [query])

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const grouped = useMemo(() => {
    const queryText = normalize(debouncedQuery)
    if (!queryText) return []

    const exams: SearchItem[] = quizzes
      .filter((q) => q.title.toLowerCase().includes(queryText) || (q.description && q.description.toLowerCase().includes(queryText)))
      .map((q) => ({
        id: `exam-${q.id}`,
        label: q.title,
        description: q.description || "Exam",
        href: `/quiz/${q.id}`,
        kind: "exam" as const,
      }))
      .slice(0, 4)

    const questions: SearchItem[] = (summary?.recent_activity || [])
      .filter((a) => /question/i.test(a.event))
      .filter((a) => a.title.toLowerCase().includes(queryText))
      .map((a) => ({
        id: `q-${a.id}`,
        label: a.title,
        description: `Recent question activity`,
        href: `/dashboard`,
        kind: "question" as const,
      }))
      .slice(0, 4)

    const students: SearchItem[] = (liveExams?.items || [])
      .flatMap((exam) => exam.students.map((s) => ({ ...s, quiz_id: exam.quiz_id, quiz_name: exam.quiz_name })))
      .filter((s) => s.student_name.toLowerCase().includes(queryText))
      .map((s) => ({
        id: `student-${s.attempt_id}`,
        label: s.student_name,
        description: `Active in ${s.quiz_name}`,
        href: `/quiz/${s.quiz_id}?tab=monitoring`,
        kind: "student" as const,
      }))
      .slice(0, 4)

    const sections = []
    if (exams.length > 0) sections.push({ title: "Exams", items: exams })
    if (questions.length > 0) sections.push({ title: "Questions", items: questions })
    if (students.length > 0) sections.push({ title: "Students", items: students })

    return sections
  }, [debouncedQuery, quizzes, summary, liveExams])

  const flattened = useMemo(() => grouped.flatMap((group) => group.items), [grouped])

  useEffect(() => {
    if (activeIndex >= flattened.length) {
      setActiveIndex(0)
    }
  }, [activeIndex, flattened.length])

  const selectItem = (item: SearchItem) => {
    setOpen(false)
    setQuery("")
    router.push(item.href)
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!open && event.key !== "Tab") setOpen(true)
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, Math.max(flattened.length - 1, 0)))
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    }
    if (event.key === "Enter" && flattened[activeIndex]) {
      event.preventDefault()
      selectItem(flattened[activeIndex])
    }
    if (event.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className={cn("relative w-full max-w-xl", className)}>
      <div className="relative">
        <Search
          className={cn(
            "pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 transition-colors duration-200",
            isFocused ? "text-[var(--brand-accent)]" : "text-[var(--text-muted)]"
          )}
        />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
            if (!open) setOpen(true)
          }}
          onFocus={() => {
            if (query) setOpen(true)
            setIsFocused(true)
          }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={onKeyDown}
          placeholder="Search exams, questions, students..."
          className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] pl-11 pr-24 text-sm text-[var(--text-primary)] transition-[border-color,box-shadow] duration-200 ease-in-out placeholder:text-[var(--text-muted)] focus-visible:border-[var(--brand-accent)] focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-[var(--brand-accent-glow)]"
          aria-haspopup="listbox"
          aria-controls={listId}
          aria-activedescendant={flattened[activeIndex]?.id}
        />
        {!query && (
          <div className="absolute right-3 top-2.5 flex items-center gap-1 rounded-md border border-[var(--brand-accent-border)] bg-[var(--sidebar-accent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-accent)]">
            <Sparkles className="size-3" />
            Smart
          </div>
        )}
      </div>

      {open && query ? (
        <div
          id={listId}
          className="absolute z-30 mt-3 w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-2 shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
          style={{ animation: "dropdown-enter 150ms ease forwards" }}
          role="listbox"
        >
          {isSearching && !debouncedQuery ? (
             <div className="space-y-2 p-2">
               <div className="h-12 animate-pulse rounded-xl bg-[var(--bg-tertiary)]" />
               <div className="h-12 animate-pulse rounded-xl bg-[var(--bg-tertiary)]" />
             </div>
          ) : flattened.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-primary)]/70 p-4 text-center text-sm text-[var(--text-muted)]">
              No results found for your search.
            </div>
          ) : (
            <div className="space-y-3">
              {grouped.map((group) => (
                <div key={group.title} className="space-y-1">
                  <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{group.title}</p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const index = flattened.findIndex((entry) => entry.id === item.id)
                      const active = index === activeIndex
                      const Icon = item.kind === "question" ? FileQuestion : item.kind === "student" ? User : FileText
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectItem(item)}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={cn(
                            "group flex w-full items-start justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-all duration-150",
                            active
                              ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                              : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                          )}
                          role="option"
                          aria-selected={active}
                          id={item.id}
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="mt-0.5 inline-flex size-8 items-center justify-center rounded-full bg-[var(--bg-primary)] text-[var(--brand-accent)]">
                              <Icon className="size-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-[var(--text-primary)]">{highlightMatch(item.label, debouncedQuery)}</p>
                              {item.description ? <p className="truncate text-xs text-[var(--text-muted)]">{item.description}</p> : null}
                            </div>
                          </div>
                          <ArrowRight className="mt-1 size-4 shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
