"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SortableSectionCard, type DraftSection } from "@/features/quiz/creation/SortableSectionCard"

interface Props {
  sections: DraftSection[]
  onChange: (sections: DraftSection[]) => void
}

const createDefaultSection = (index: number): DraftSection => ({
  id: crypto.randomUUID(),
  title: `Section ${index + 1}`,
  numberOfQuestions: 5,
  questionType: "MCQ",
  marksPerQuestion: 2,
  difficulty: "Medium",
  bloomLevel: "",
})

export function SectionBuilder({ sections, onChange }: Props) {
  const addSection = () => onChange([...sections, createDefaultSection(sections.length)])

  const updateSection = (next: DraftSection) => {
    onChange(sections.map((section) => (section.id === next.id ? next : section)))
  }

  const removeSection = (id: string) => {
    onChange(sections.filter((section) => section.id !== id))
  }

  const moveSection = (from: number, to: number) => {
    if (from === to || to < 0 || to >= sections.length) return
    const cloned = [...sections]
    const [picked] = cloned.splice(from, 1)
    cloned.splice(to, 0, picked)
    onChange(cloned)
  }

  const totalMarks = sections.reduce((sum, section) => sum + section.numberOfQuestions * section.marksPerQuestion, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Configure section blueprint for AI generation.</p>
        <Button variant="outline" onClick={addSection}>
          <Plus className="mr-2 size-4" />
          Add section
        </Button>
      </div>

      <div className="space-y-3">
        {sections.map((section, index) => (
          <SortableSectionCard
            key={section.id}
            section={section}
            index={index}
            total={sections.length}
            onUpdate={updateSection}
            onMove={moveSection}
            onDelete={removeSection}
          />
        ))}
      </div>

      <div className="rounded-md border bg-muted/30 px-3 py-2 text-right text-sm font-medium">Total marks: {totalMarks}</div>
    </div>
  )
}

