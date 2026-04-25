"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Search, Sparkles } from "lucide-react"
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
      <span className="text-foreground underline decoration-primary/40">{text.slice(match, match + query.length)}</span>
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
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search exams, questions, or topics..."
          className="h-11 w-full rounded-full border border-border/80 bg-background/95 pl-11 pr-10 text-sm text-foreground shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listId}
          aria-activedescendant={flattened[activeIndex]?.id}
        />
        <div className="absolute right-3 top-2.5 flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
          <Sparkles className="size-3" />
          Smart
        </div>
      </div>

      {open ? (
        <div
          id={listId}
          className="absolute z-30 mt-3 w-full rounded-2xl border border-border/90 bg-popover p-3 shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200"
          role="listbox"
        >
          {isSearching ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`search-loading-${index}`} className="h-12 animate-pulse rounded-xl bg-muted/60" />
              ))}
            </div>
          ) : flattened.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-background/70 p-4 text-center text-sm text-muted-foreground">
              No results. Try a broader keyword.
            </div>
          ) : (
            <div className="space-y-3">
              {grouped.map((group) => (
                <div key={group.title} className="space-y-1">
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{group.title}</p>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const index = flattened.findIndex((entry) => entry.id === item.id)
                      const active = index === activeIndex
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectItem(item)}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={cn(
                            "flex w-full items-start justify-between rounded-xl border border-transparent px-3 py-2 text-left text-sm transition-all duration-150",
                            active
                              ? "border-primary/30 bg-muted/60 text-foreground"
                              : "text-muted-foreground hover:border-muted hover:bg-muted/40 hover:text-foreground"
                          )}
                          role="option"
                          aria-selected={active}
                          id={item.id}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{highlightMatch(item.label, debouncedQuery)}</p>
                            {item.description ? <p className="truncate text-xs text-muted-foreground">{item.description}</p> : null}
                          </div>
                          <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div className="border-t pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    router.push("/exams")
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-accent)] hover:underline"
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
