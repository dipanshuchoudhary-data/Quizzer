"use client"

import { GripVertical, MoveDown, MoveUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type QuestionType = "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER" | "LONG_ANSWER"
export type Difficulty = "Easy" | "Medium" | "Hard"

export interface DraftSection {
  id: string
  title: string
  numberOfQuestions: number
  questionType: QuestionType
  marksPerQuestion: number
  difficulty: Difficulty
  bloomLevel?: string
}

interface Props {
  section: DraftSection
  index: number
  total: number
  onUpdate: (section: DraftSection) => void
  onMove: (from: number, to: number) => void
  onDelete: (sectionId: string) => void
}

export function SortableSectionCard({ section, index, total, onUpdate, onMove, onDelete }: Props) {
  const totalMarks = section.numberOfQuestions * section.marksPerQuestion

  return (
    <Card
      draggable
      onDragStart={(event) => event.dataTransfer.setData("section-index", String(index))}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        const from = Number(event.dataTransfer.getData("section-index"))
        onMove(from, index)
      }}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Section {index + 1}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" disabled={index === 0} onClick={() => onMove(index, index - 1)}>
              <MoveUp size={14} />
            </Button>
            <Button size="icon" variant="ghost" disabled={index === total - 1} onClick={() => onMove(index, index + 1)}>
              <MoveDown size={14} />
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDelete(section.id)}>
              Delete
            </Button>
          </div>
        </div>

        <Input value={section.title} placeholder="Section name" onChange={(event) => onUpdate({ ...section, title: event.target.value })} />

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Number of questions</label>
            <Input
              type="number"
              min={1}
              value={section.numberOfQuestions}
              onChange={(event) => onUpdate({ ...section, numberOfQuestions: Number(event.target.value || 1) })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Marks per question</label>
            <Input
              type="number"
              min={1}
              value={section.marksPerQuestion}
              onChange={(event) => onUpdate({ ...section, marksPerQuestion: Number(event.target.value || 1) })}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Question type</label>
            <Select value={section.questionType} onValueChange={(value: QuestionType) => onUpdate({ ...section, questionType: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MCQ">MCQ</SelectItem>
                <SelectItem value="TRUE_FALSE">True/False</SelectItem>
                <SelectItem value="SHORT_ANSWER">Short Answer</SelectItem>
                <SelectItem value="LONG_ANSWER">Long Answer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Difficulty</label>
            <Select value={section.difficulty} onValueChange={(value: Difficulty) => onUpdate({ ...section, difficulty: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Easy">Easy</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Bloom level (optional)</label>
          <Input
            placeholder="Remember / Understand / Apply / Analyze / Evaluate / Create"
            value={section.bloomLevel ?? ""}
            onChange={(event) => onUpdate({ ...section, bloomLevel: event.target.value })}
          />
        </div>

        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs font-medium">Section marks: {totalMarks}</div>
      </CardContent>
    </Card>
  )
}

