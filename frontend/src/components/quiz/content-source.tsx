"use client"

import { useState } from "react"
import { FileText, Link2, Pencil } from "lucide-react"
import { ContentEditor } from "./content-input/editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Document } from "@/types/document"

type SourceMode = "paste" | "files" | "links"

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
      title: "Add Website Links",
      description: "Extract content from online sources.",
      icon: Link2,
    },
  ]

  return (
    <div className="space-y-6">
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

      {mode === "paste" ? (
        <ContentEditor
          value={textValue}
          onChange={onTextChange}
          onFilesDropped={onFilesUpload}
          placeholder="Paste text, markdown, lecture notes, or extracted OCR."
        />
      ) : null}

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

      {mode === "links" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              placeholder="Paste a URL and press Add"
              className="flex-1"
            />
            <Button
              type="button"
              onClick={() => {
                if (!urlInput.trim()) return
                const next = Array.from(new Set([...urls, urlInput.trim()]))
                onUrlsChange(next)
                setUrlInput("")
              }}
            >
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {urls.length === 0 ? (
              <p className="text-xs text-muted-foreground">No links added yet.</p>
            ) : (
              urls.map((url) => (
                <div key={url} className="flex items-center justify-between rounded-xl border bg-background px-4 py-2 text-sm">
                  <span className="truncate">{url}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onUrlsChange(urls.filter((item) => item !== url))}
                  >
                    Remove
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
