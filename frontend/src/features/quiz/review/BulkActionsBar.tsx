"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { questionBulkApi } from "@/lib/api/question-bulk"
import { questionApi } from "@/lib/api/question"
import { useSelectionStore } from "@/stores/useSelectionStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Section } from "@/types/section"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function BulkActionsBar({ sections, onDone }: { sections: Section[]; onDone: () => void }) {
  const { selectedIds, clear } = useSelectionStore()
  const [marks, setMarks] = useState(1)
  const [targetSection, setTargetSection] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState<string | null>(null)
  const [questionType, setQuestionType] = useState<string | null>(null)

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

  const removeMany = useMutation({
    mutationFn: async () => {
      await Promise.all(selectedIds.map((questionId) => questionApi.delete(questionId)))
    },
    onSuccess: () => {
      toast.success("Deleted selected questions")
      clear()
      onDone()
    },
    onError: () => toast.error("Bulk delete failed"),
  })

  const regenerateMany = useMutation({
    mutationFn: async () => {
      await Promise.all(selectedIds.map((questionId) => questionApi.regenerate(questionId)))
    },
    onSuccess: () => {
      toast.success("Regenerated selected questions")
      clear()
      onDone()
    },
    onError: () => toast.error("Bulk regenerate failed"),
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

  const updateDifficulty = useMutation({
    mutationFn: async () => {
      if (!difficulty) throw new Error("Difficulty required")
      await Promise.all(selectedIds.map((questionId) => questionApi.update(questionId, { difficulty })))
    },
    onSuccess: () => {
      toast.success("Difficulty updated")
      clear()
      onDone()
    },
    onError: () => toast.error("Bulk difficulty update failed"),
  })

  const updateQuestionType = useMutation({
    mutationFn: async () => {
      if (!questionType) throw new Error("Type required")
      await Promise.all(selectedIds.map((questionId) => questionApi.update(questionId, { question_type: questionType })))
    },
    onSuccess: () => {
      toast.success("Question type updated")
      clear()
      onDone()
    },
    onError: () => toast.error("Bulk question type update failed"),
  })

  if (selectedIds.length === 0) return null

  return (
    <div className="sticky top-0 z-20 mb-3 flex flex-col gap-3 rounded-xl border bg-background/95 p-3 backdrop-blur sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
      <span className="text-sm text-muted-foreground">{selectedIds.length} selected</span>
      <Button size="sm" onClick={() => approve.mutate()} disabled={approve.isPending} className="h-11 w-full sm:h-9 sm:w-auto">
        Approve selected
      </Button>
      <Button size="sm" variant="outline" onClick={() => regenerateMany.mutate()} disabled={regenerateMany.isPending} className="h-11 w-full sm:h-9 sm:w-auto">
        <RefreshCw className="mr-1.5 size-3.5" />
        Regenerate selected
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => {
          const confirmed = window.confirm("Delete selected questions? This action cannot be undone.")
          if (!confirmed) return
          removeMany.mutate()
        }}
        disabled={removeMany.isPending}
        className="h-11 w-full sm:h-9 sm:w-auto"
      >
        Delete selected
      </Button>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input className="h-11 w-full sm:h-9 sm:w-20" type="number" value={marks} onChange={(event) => setMarks(Math.max(1, Number(event.target.value || 1)))} />
        <Button size="sm" variant="outline" onClick={() => updateMarks.mutate()} className="h-11 w-full sm:h-9 sm:w-auto">
          Update marks
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={difficulty ?? undefined} onValueChange={setDifficulty}>
          <SelectTrigger className="h-11 w-full sm:h-9 sm:w-[150px]">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Easy">Easy</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Hard">Hard</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={!difficulty} onClick={() => updateDifficulty.mutate()} className="h-11 w-full sm:h-9 sm:w-auto">
          Update difficulty
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={questionType ?? undefined} onValueChange={setQuestionType}>
          <SelectTrigger className="h-11 w-full sm:h-9 sm:w-[170px]">
            <SelectValue placeholder="Question type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MCQ">MCQ</SelectItem>
            <SelectItem value="TRUE_FALSE">True / False</SelectItem>
            <SelectItem value="SHORT_ANSWER">Short Answer</SelectItem>
            <SelectItem value="LONG_ANSWER">Long Answer</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={!questionType} onClick={() => updateQuestionType.mutate()} className="h-11 w-full sm:h-9 sm:w-auto">
          Update type
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={targetSection ?? undefined} onValueChange={setTargetSection}>
          <SelectTrigger className="h-11 w-full sm:h-9 sm:w-[180px]">
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
        <Button size="sm" variant="outline" disabled={!targetSection} onClick={() => move.mutate()} className="h-11 w-full sm:h-9 sm:w-auto">
          Move
        </Button>
      </div>
      <Button size="sm" variant="ghost" onClick={clear} className="h-11 w-full sm:h-9 sm:w-auto">
        Clear
      </Button>
    </div>
  )
}
