"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Clock3, FileQuestion, FileText, Plus, Search, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { ALL_NAV_ITEMS, NAV_ACTIONS } from "./nav-config"

type SearchItem = {
  id: string
  label: string
  href: string
  description?: string
  keywords?: string[]
  kind: "exam" | "question" | "page"
}

const RECENT_KEY = "quizzer:recent-searches"
const MAX_RECENT = 5

function normalize(value: string) {
  return value.toLowerCase().trim()
}

function scoreMatch(query: string, text: string) {
  const q = normalize(query)
  const t = normalize(text)
  if (!q) return 0
  if (t.includes(q)) return 100 - t.indexOf(q) * 2
  let qi = 0
  let score = 0
  for (let i = 0; i < t.length; i += 1) {
    if (t[i] === q[qi]) {
      qi += 1
      score += 4
    }
    if (qi >= q.length) return score
  }
  return 0
}

function rankResults(query: string, items: SearchItem[]) {
  if (!query) return items
  return items
    .map((item) => {
      const haystack = [item.label, item.description, item.keywords?.join(" ")].filter(Boolean).join(" ")
      return { item, score: scoreMatch(query, haystack) }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item)
}

function highlightMatch(text: string, query: string) {
  if (!query) return text
  const lowered = text.toLowerCase()
  const match = lowered.indexOf(query.toLowerCase())
  if (match === -1) return text
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
  const [isSearching, setIsSearching] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [recent, setRecent] = useState<SearchItem[]>([])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const listId = "global-search-list"

  const items = useMemo<SearchItem[]>(() => {
    const navItems = ALL_NAV_ITEMS.map((item) => ({
      id: item.id,
      label: item.label,
      href: item.href,
      description: item.description,
      keywords: item.keywords,
      kind: item.href.includes("exam") || item.href.includes("quiz") ? ("exam" as const) : ("page" as const),
    }))
    const actionItems = NAV_ACTIONS.filter((action) => action.href).map((action) => ({
      id: action.id,
      label: action.label,
      href: action.href ?? "/dashboard",
      description: action.description,
      keywords: action.keywords,
      kind: /question|import|review/i.test(action.label) ? ("question" as const) : ("exam" as const),
    }))
    return [...actionItems, ...navItems]
  }, [])

  useEffect(() => {
    const stored = window.localStorage.getItem(RECENT_KEY)
    if (!stored) return
    try {
      const parsed = JSON.parse(stored) as SearchItem[]
      setRecent(Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [])
    } catch {
      setRecent([])
    }
  }, [])

  useEffect(() => {
    const handler = window.setTimeout(() => setDebouncedQuery(query), 300)
    return () => window.clearTimeout(handler)
  }, [query])

  useEffect(() => {
    const normalized = normalize(query)
    if (!normalized) {
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    const handler = window.setTimeout(() => setIsSearching(false), 220)
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

  const ranked = useMemo(() => rankResults(debouncedQuery, items), [debouncedQuery, items])

  const grouped = useMemo(() => {
    const queryText = normalize(debouncedQuery)
    const exams = ranked.filter((item) => item.kind === "exam").slice(0, 6)
    const questions = ranked.filter((item) => item.kind === "question").slice(0, 6)
    const recentItems = recent
      .filter((entry) => (queryText ? entry.label.toLowerCase().includes(queryText) : true))
      .slice(0, 5)
    return [
      { title: "Exams", items: exams },
      { title: "Questions", items: questions },
      { title: "Recent Searches", items: recentItems },
    ]
  }, [debouncedQuery, ranked, recent])

  const flattened = useMemo(() => grouped.flatMap((group) => group.items), [grouped])
  const createItem = useMemo(
    () =>
      NAV_ACTIONS.find((action) => /create/i.test(action.label) && action.href)?.href
        ? {
            href: NAV_ACTIONS.find((action) => /create/i.test(action.label) && action.href)!.href!,
            label: "Create Quiz",
            description: "Start a fresh exam workflow from the global create flow.",
          }
        : null,
    []
  )

  useEffect(() => {
    if (activeIndex >= flattened.length) {
      setActiveIndex(0)
    }
  }, [activeIndex, flattened.length])

  const selectItem = (item: SearchItem) => {
    setOpen(false)
    setQuery("")
    router.push(item.href)
    const nextRecent = [item, ...recent.filter((entry) => entry.id !== item.id)].slice(0, MAX_RECENT)
    setRecent(nextRecent)
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(nextRecent))
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
          }}
          onFocus={() => {
            setOpen(true)
            setIsFocused(true)
          }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={onKeyDown}
          placeholder="Search exams, questions, or topics..."
          className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] pl-11 pr-24 text-sm text-[var(--text-primary)] transition-[border-color,box-shadow] duration-200 ease-in-out placeholder:text-[var(--text-muted)] focus-visible:border-[var(--brand-accent)] focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-[var(--brand-accent-glow)]"
          aria-haspopup="listbox"
          aria-controls={listId}
          aria-activedescendant={flattened[activeIndex]?.id}
        />
        <div className="absolute right-3 top-2.5 flex items-center gap-1 rounded-md border border-[var(--brand-accent-border)] bg-[var(--sidebar-accent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-accent)]">
          <Sparkles className="size-3" />
          Smart
        </div>
      </div>

      {open ? (
        <div
          id={listId}
          className="absolute z-30 mt-3 w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-2 shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
          style={{ animation: "dropdown-enter 150ms ease forwards" }}
          role="listbox"
        >
          {isSearching ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`search-loading-${index}`} className="h-12 animate-pulse rounded-xl bg-[var(--bg-tertiary)]" />
              ))}
            </div>
          ) : flattened.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-primary)]/70 p-4 text-center text-sm text-[var(--text-muted)]">
              No results. Try a broader keyword.
            </div>
          ) : (
            <div className="space-y-3">
              {createItem ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    router.push(createItem.href)
                  }}
                  className="flex w-full items-start gap-3 rounded-lg border-l-[3px] border-[var(--brand-accent)] bg-[var(--brand-accent-soft)] px-3 py-3 text-left transition-colors hover:bg-[var(--bg-tertiary)]"
                >
                  <span className="mt-0.5 inline-flex size-8 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[var(--brand-accent)] shadow-sm">
                    <Plus className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--brand-accent)]">{createItem.label}</span>
                    <span className="block text-xs text-[var(--text-secondary)]">{createItem.description}</span>
                  </span>
                </button>
              ) : null}
              {grouped.map((group) => (
                <div key={group.title} className="space-y-1">
                  <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{group.title}</p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const index = flattened.findIndex((entry) => entry.id === item.id)
                      const active = index === activeIndex
                      const Icon = group.title === "Questions" ? FileQuestion : group.title === "Recent Searches" ? Clock3 : FileText
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
              <div className="border-t border-[var(--border-color)] pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    router.push("/exams")
                  }}
                  className="flex w-full items-center justify-center gap-1 p-2 text-xs font-semibold text-[var(--brand-accent)] hover:underline"
                >
                  View all results
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
