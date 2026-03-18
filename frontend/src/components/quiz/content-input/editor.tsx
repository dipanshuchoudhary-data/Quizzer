"use client"

import { useRef } from "react"
import { UploadCloud } from "lucide-react"
import { cn } from "@/lib/utils"

export function ContentEditor({
  value,
  onChange,
  onFilesDropped,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  onFilesDropped?: (files: File[]) => void
  placeholder?: string
}) {
  const dropRef = useRef<HTMLDivElement | null>(null)

  return (
    <div className="space-y-3">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? "Paste lecture notes, book excerpts, or markdown..."}
        className="min-h-[220px] w-full resize-none rounded-2xl border bg-background p-4 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
      />
      <div
        ref={dropRef}
        onDragOver={(event) => {
          event.preventDefault()
        }}
        onDrop={(event) => {
          event.preventDefault()
          const files = Array.from(event.dataTransfer.files)
          if (files.length > 0) onFilesDropped?.(files)
        }}
        className={cn(
          "flex items-center gap-3 rounded-2xl border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground transition-all",
          "hover:border-primary/40 hover:bg-muted/60"
        )}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background">
          <UploadCloud className="size-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">Drag & drop images for OCR</p>
          <p className="text-xs text-muted-foreground">PNG, JPG, or scanned pages will be extracted automatically.</p>
        </div>
      </div>
    </div>
  )
}
