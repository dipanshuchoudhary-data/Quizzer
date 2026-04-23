"use client"

import { useState } from "react"
import { FileText, Link2, Pencil, Youtube, Globe, X, Plus } from "lucide-react"
import { ContentEditor } from "./content-input/editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Document } from "@/types/document"

type SourceMode = "paste" | "files" | "links"

// ── helpers ──────────────────────────────────────────────────────────────────

const YOUTUBE_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?.*v=([A-Za-z0-9_-]{11})/,
  /(?:https?:\/\/)?youtu\.be\/([A-Za-z0-9_-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
]

function isYouTubeUrl(url: string): boolean {
  return YOUTUBE_PATTERNS.some((p) => p.test(url))
}

function getYouTubeThumbnail(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = pattern.exec(url)
    if (match) return `https://img.youtube.com/vi/${match[1]}/default.jpg`
  }
  return null
}

function getDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

// ── component ─────────────────────────────────────────────────────────────────

export function ContentSource({
  mode,
  onModeChange,
  textValue,
  onTextChange,
  urls,
  onUrlsChange,
  documents,
  onFilesUpload,
}: {
  mode: SourceMode
  onModeChange: (mode: SourceMode) => void
  textValue: string
  onTextChange: (value: string) => void
  urls: string[]
  onUrlsChange: (urls: string[]) => void
  documents: Document[]
  onFilesUpload: (files: File[]) => void
}) {
  const [urlInput, setUrlInput] = useState("")

  const addUrl = () => {
    const trimmed = urlInput.trim()
    if (!trimmed) return
    const next = Array.from(new Set([...urls, trimmed]))
    onUrlsChange(next)
    setUrlInput("")
  }

  const cards: Array<{ mode: SourceMode; title: string; description: string; icon: React.ElementType }> = [
    {
      mode: "paste",
      title: "Paste Content",
      description: "Paste notes, markdown, or scanned OCR text.",
      icon: Pencil,
    },
    {
      mode: "files",
      title: "Import Files",
      description: "Upload PDFs, slides, or documents.",
      icon: FileText,
    },
    {
      mode: "links",
      title: "Add Links",
      description: "Websites or YouTube videos — we'll extract content automatically.",
      icon: Link2,
    },
  ]

  const youtubePreviews = urls.filter(isYouTubeUrl)
  const regularUrls = urls.filter((u) => !isYouTubeUrl(u))

  return (
    <div className="space-y-6">
      {/* ── Mode selector ── */}
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const active = card.mode === mode
          const Icon = card.icon
          return (
            <button
              key={card.mode}
              type="button"
              onClick={() => onModeChange(card.mode)}
              className={cn(
                "group rounded-2xl border bg-background p-4 text-left transition-all duration-150",
                active
                  ? "border-primary/40 bg-primary/5 shadow-sm"
                  : "hover:-translate-y-1 hover:border-primary/30 hover:bg-muted/40 hover:shadow-md"
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", active ? "bg-primary/10 text-primary" : "bg-muted text-foreground")}>
                  <Icon className="size-4" />
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                  {active ? "Selected" : "Select"}
                </span>
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">{card.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
            </button>
          )
        })}
      </div>

      {/* ── Paste mode ── */}
      {mode === "paste" ? (
        <ContentEditor
          value={textValue}
          onChange={onTextChange}
          onFilesDropped={onFilesUpload}
          placeholder="Paste text, markdown, lecture notes, or extracted OCR."
        />
      ) : null}

      {/* ── Files mode ── */}
      {mode === "files" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed bg-muted/40 p-6 text-center">
            <p className="text-sm font-semibold text-foreground">Upload teaching materials</p>
            <p className="mt-1 text-xs text-muted-foreground">PDF, DOCX, PPT, TXT, PNG, JPG</p>
            <div className="mt-4">
              <Input
                type="file"
                multiple
                accept=".pdf,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? [])
                  if (files.length > 0) onFilesUpload(files)
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            {documents.length === 0 ? (
              <p className="text-xs text-muted-foreground">No files uploaded yet.</p>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-xl border bg-background px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-foreground">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">Status: {doc.extraction_status}</p>
                    {doc.extraction_status === "FAILED" && doc.extracted_metadata?.error ? (
                      <p className="mt-1 text-xs text-rose-600">Error: {doc.extracted_metadata.error}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide",
                        doc.extraction_status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-700"
                          : doc.extraction_status === "FAILED"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700"
                      )}
                    >
                      {doc.extraction_status}
                    </span>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                      {doc.extracted_metadata?.text_length ?? 0} chars
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {/* ── Links mode ── */}
      {mode === "links" ? (
        <div className="space-y-4">
          {/* Input row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              {urlInput && isYouTubeUrl(urlInput) ? (
                <Youtube size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500" />
              ) : urlInput ? (
                <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              ) : null}
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl() } }}
                placeholder="Paste a YouTube link or any website URL…"
                className={cn(
                  "transition-all",
                  urlInput && isYouTubeUrl(urlInput)
                    ? "border-red-400/60 pl-8 focus-visible:ring-red-400/40"
                    : urlInput ? "pl-8" : ""
                )}
              />
            </div>
            <Button type="button" onClick={addUrl} disabled={!urlInput.trim()} size="default">
              <Plus size={14} className="mr-1" />
              Add
            </Button>
          </div>

          {/* YouTube hint */}
          {urlInput && isYouTubeUrl(urlInput) && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400">
              <Youtube size={12} />
              YouTube video detected — we&apos;ll fetch captions automatically when you click Add.
            </div>
          )}

          {/* YouTube video cards */}
          {youtubePreviews.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">YouTube Videos</p>
              {youtubePreviews.map((url) => {
                const thumb = getYouTubeThumbnail(url)
                return (
                  <div key={url} className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2">
                    {thumb && (
                      <img src={thumb} alt="thumbnail" className="h-10 w-16 rounded-md object-cover flex-shrink-0" />
                    )}
                    <div className="flex flex-1 min-w-0 items-center gap-2">
                      <Youtube size={12} className="text-red-500 flex-shrink-0" />
                      <span className="flex-1 truncate text-xs text-foreground">{url}</span>
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] px-1.5 border-0 flex-shrink-0">
                        YouTube
                      </Badge>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => onUrlsChange(urls.filter((u) => u !== url))}
                    >
                      <X size={12} />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Regular URLs */}
          {regularUrls.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Websites</p>
              {regularUrls.map((url) => (
                <div key={url} className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2">
                  <Globe size={12} className="text-muted-foreground flex-shrink-0" />
                  <div className="flex flex-1 min-w-0 items-center gap-2">
                    <span className="flex-1 truncate text-xs text-foreground">{url}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{getDomain(url)}</span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onUrlsChange(urls.filter((u) => u !== url))}
                  >
                    <X size={12} />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {urls.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No links added yet. Add a YouTube video or any website to extract content.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
