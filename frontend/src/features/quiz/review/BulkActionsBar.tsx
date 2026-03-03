"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { questionBulkApi } from "@/lib/api/question-bulk"
import { useSelectionStore } from "@/stores/useSelectionStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Section } from "@/types/section"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function BulkActionsBar({ sections, onDone }: { sections: Section[]; onDone: () => void }) {
  const { selectedIds, clear } = useSelectionStore()
  const [marks, setMarks] = useState(1)
  const [targetSection, setTargetSection] = useState<string | null>(null)

  const approve = useMutation({
    mutationFn: () => questionBulkApi.approveMany(selectedIds),
    onSuccess: () => {
      toast.success("Approved selected questions")
      clear()
      onDone()
    },
    onError: () => toast.error("Bulk approve failed"),
  })

  const move = useMutation({
    mutationFn: () => questionBulkApi.moveMany(selectedIds, targetSection as string),
    onSuccess: () => {
      toast.success("Moved selected questions")
      clear()
      onDone()
    },
    onError: () => toast.error("Bulk move failed"),
  })

  const updateMarks = useMutation({
    mutationFn: () => questionBulkApi.marksMany(selectedIds, marks),
    onSuccess: () => {
      toast.success("Marks updated")
      clear()
      onDone()
    },
    onError: () => toast.error("Bulk marks failed"),
  })

  if (selectedIds.length === 0) return null

  return (
    <div className="sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-2 rounded-md border bg-background p-3">
      <span className="text-sm text-muted-foreground">{selectedIds.length} selected</span>
      <Button size="sm" onClick={() => approve.mutate()} disabled={approve.isPending}>
        Approve selected
      </Button>
      <div className="flex items-center gap-2">
        <Input className="w-20" type="number" value={marks} onChange={(event) => setMarks(Number(event.target.value || 0))} />
        <Button size="sm" variant="outline" onClick={() => updateMarks.mutate()}>
          Update marks
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Select value={targetSection ?? undefined} onValueChange={setTargetSection}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Move to section" />
          </SelectTrigger>
          <SelectContent>
            {sections.map((section) => (
              <SelectItem key={section.id} value={section.id}>
                {section.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={!targetSection} onClick={() => move.mutate()}>
          Move
        </Button>
      </div>
      <Button size="sm" variant="ghost" onClick={clear}>
        Clear
      </Button>
    </div>
  )
}
