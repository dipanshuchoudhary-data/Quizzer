"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Copy, ExternalLink, Link2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { documentApi } from "@/lib/api/document"
import { quizApi, type SourceReference } from "@/lib/api/quiz"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function LinksPage({ quizId }: { quizId: string }) {
  const queryClient = useQueryClient()
  const [previewRef, setPreviewRef] = useState<SourceReference | null>(null)

  const { data: quiz } = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: () => quizApi.getById(quizId),
  })

  const { data: docs = [] } = useQuery({
    queryKey: ["documents", quizId],
    queryFn: () => documentApi.list(quizId),
  })

  const { data: sourceRefs = [] } = useQuery({
    queryKey: ["source-references", quizId],
    queryFn: () => quizApi.getSourceReferences(quizId),
  })

  const publishedUrl = quiz?.is_published ? quiz.public_url ?? null : null

  const revoke = useMutation({
    mutationFn: documentApi.remove,
    onSuccess: () => {
      toast.success("Link revoked")
      queryClient.invalidateQueries({ queryKey: ["documents", quizId] })
    },
    onError: () => toast.error("Failed to revoke link"),
  })

  const unpublish = useMutation({
    mutationFn: () => quizApi.unpublish(quizId),
    onSuccess: () => {
      toast.success("Public link revoked")
      queryClient.invalidateQueries({ queryKey: ["quiz", quizId] })
      queryClient.invalidateQueries({ queryKey: ["quizzes"] })
    },
    onError: () => toast.error("Failed to revoke public link"),
  })

  const openSource = (source: SourceReference) => {
    if (source.url) {
      window.open(source.url, "_blank", "noopener,noreferrer")
      return
    }
    if (source.content && source.content.trim().length > 0) {
      setPreviewRef(source)
      return
    }
    toast.error("No preview URL/content available for this source.")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 size={16} />
          Links and Sources
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {publishedUrl ? (
          <div className="grid grid-cols-6 items-center gap-3 rounded-md border p-3 text-sm">
            <div className="col-span-2 font-medium">Published quiz link</div>
            <StatusBadge status={quiz?.is_published ? "PUBLISHED" : "DRAFT"} />
            <button
              type="button"
              className="col-span-2 truncate text-left text-primary underline-offset-4 hover:underline"
              onClick={() => window.open(publishedUrl, "_blank", "noopener,noreferrer")}
            >
              {publishedUrl}
            </button>
            <div className="flex items-center justify-end gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(publishedUrl)
                  toast.success("Public link copied")
                }}
              >
                <Copy size={14} />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => unpublish.mutate()} disabled={unpublish.isPending}>
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Publish this quiz to generate a public link.
          </div>
        )}

        {docs.map((doc) => (
          <div key={doc.id} className="grid grid-cols-6 items-center gap-3 rounded-md border p-3 text-sm">
            <button
              type="button"
              className="col-span-2 truncate text-left text-primary underline-offset-4 hover:underline"
              onClick={() => window.open(documentApi.getDetailUrl(doc.id), "_blank", "noopener,noreferrer")}
              title={doc.file_name}
            >
              {doc.file_name}
            </button>
            <StatusBadge status={doc.extraction_status} />
            <div className="truncate text-muted-foreground">{doc.file_type?.toUpperCase()}</div>
            <div className="truncate text-muted-foreground">{doc.updated_at ? new Date(doc.updated_at).toLocaleString() : "-"}</div>
            <div className="flex items-center justify-end gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(documentApi.getDetailUrl(doc.id))
                  toast.success("Document link copied")
                }}
              >
                <Copy size={14} />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => revoke.mutate(doc.id)}>
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        ))}

        {sourceRefs.map((source, index) => (
          <div key={`source-ref-${index}`} className="grid grid-cols-6 items-center gap-3 rounded-md border p-3 text-sm">
            <button
              type="button"
              className="col-span-2 truncate text-left text-primary underline-offset-4 hover:underline"
              onClick={() => openSource(source)}
              title={source.label}
            >
              {source.label}
            </button>
            <StatusBadge status={(source.type || "SOURCE").toUpperCase()} />
            <div className="truncate text-muted-foreground">{source.note || "-"}</div>
            <div className="truncate text-muted-foreground">{source.url ? "URL" : source.content ? "Text preview" : "No preview"}</div>
            <div className="flex items-center justify-end gap-2">
              {source.url && (
                <Button size="icon" variant="ghost" onClick={() => window.open(source.url, "_blank", "noopener,noreferrer")}>
                  <ExternalLink size={14} />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  const copyValue = source.url || source.content || source.label
                  void navigator.clipboard.writeText(copyValue)
                  toast.success("Source copied")
                }}
              >
                <Copy size={14} />
              </Button>
            </div>
          </div>
        ))}
        {docs.length === 0 && <p className="text-sm text-muted-foreground">No source files uploaded yet.</p>}
      </CardContent>

      <Dialog open={Boolean(previewRef)} onOpenChange={(open) => !open && setPreviewRef(null)}>
        <DialogContent className="!h-[86vh] !max-h-[86vh] !w-[92vw] !max-w-[92vw] sm:!max-w-5xl">
          <DialogHeader>
            <DialogTitle>{previewRef?.label ?? "Source Preview"}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/20 p-4">
            <pre className="whitespace-pre-wrap break-words text-sm leading-6">{previewRef?.content ?? ""}</pre>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
