"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { quizApi } from "@/lib/api/quiz"
import { getApiErrorMessage } from "@/lib/api/error"
import { defaultQuizExamSettings, type QuizExamSettings } from "@/types/quiz"

function SettingRow({
  title,
  description,
  control,
}: {
  title: string
  description: string
  control: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/70 p-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="w-full md:w-[220px]">{control}</div>
    </div>
  )
}

function NumberInput({
  value,
  min = 0,
  step = 1,
  onChange,
}: {
  value: number
  min?: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <Input
      type="number"
      min={min}
      step={step}
      value={value}
      onChange={(event) => onChange(Math.max(min, Number(event.target.value || min)))}
      className="bg-background"
    />
  )
}

export function SettingsPage({ quizId }: { quizId: string }) {
  const queryClient = useQueryClient()
  const [settings, setSettings] = useState<QuizExamSettings>(defaultQuizExamSettings)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["quiz-settings", quizId],
    queryFn: () => quizApi.getSettings(quizId),
  })

  useEffect(() => {
    if (!data) return
    setSettings(data)
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (payload: QuizExamSettings) => quizApi.updateSettings(quizId, payload),
    onMutate: () => {
      setSaveMessage("Saving settings...")
    },
    onSuccess: ({ settings: updated, message }) => {
      setSettings(updated)
      setSaveMessage(message)
      toast.success(message)
      queryClient.setQueryData(["quiz-settings", quizId], updated)
      queryClient.invalidateQueries({ queryKey: ["quiz", quizId] })
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error, "Failed to save settings")
      console.error("[Quiz Settings] Save failed", { quizId, error, payload: settings })
      setSaveMessage(message)
      toast.error(message)
    },
  })

  const handleChange = <K extends keyof QuizExamSettings>(key: K, value: QuizExamSettings[K]) => {
    setSaveMessage("")
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const handleSave = () => {
    saveMutation.mutate(settings)
  }

  const handleReset = () => {
    setSaveMessage("")
    saveMutation.mutate(defaultQuizExamSettings)
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Exam Settings</CardTitle>
          <CardDescription>Basic settings stay visible. Advanced controls are available only when you need tighter exam control.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic Settings</CardTitle>
          <CardDescription>These are the most commonly adjusted controls for a teacher-owned quiz.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingRow
            title="Exam Duration"
            description="Defines the exam length in minutes for this quiz only."
            control={<NumberInput value={settings.duration} min={5} step={5} onChange={(value) => handleChange("duration", value)} />}
          />
          <SettingRow
            title="Default Marks per Question"
            description="Sets the default marks value teachers use while structuring and grading this quiz."
            control={<NumberInput value={settings.default_marks} min={1} onChange={(value) => handleChange("default_marks", value)} />}
          />
          <SettingRow
            title="Shuffle Questions"
            description="Randomizes the order of questions for attempts on this quiz."
            control={<Switch checked={settings.shuffle_questions} onCheckedChange={(checked) => handleChange("shuffle_questions", checked)} />}
          />
          <SettingRow
            title="Shuffle Options"
            description="Randomizes answer option order for objective questions."
            control={<Switch checked={settings.shuffle_options} onCheckedChange={(checked) => handleChange("shuffle_options", checked)} />}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Advanced Settings</CardTitle>
            <CardDescription>Collapsed by default to keep the page easier to scan.</CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => setAdvancedOpen((current) => !current)}>
            {advancedOpen ? "Hide" : "Show"}
            {advancedOpen ? <ChevronUp className="ml-2 size-4" /> : <ChevronDown className="ml-2 size-4" />}
          </Button>
        </CardHeader>
        {advancedOpen && (
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Integrity &amp; Security</p>
                <p className="text-sm text-muted-foreground">Controls that affect exam monitoring and violation handling.</p>
              </div>
              <SettingRow
                title="Require Fullscreen"
                description="Keeps fullscreen enforcement tied to this quiz configuration."
                control={<Switch checked={settings.require_fullscreen} onCheckedChange={(checked) => handleChange("require_fullscreen", checked)} />}
              />
              <SettingRow
                title="Block Tab Switching"
                description="Treats tab switching as an integrity-relevant action for this quiz."
                control={<Switch checked={settings.block_tab_switch} onCheckedChange={(checked) => handleChange("block_tab_switch", checked)} />}
              />
              <SettingRow
                title="Block Copy/Paste"
                description="Prevents copy and paste actions where the exam flow supports enforcement."
                control={<Switch checked={settings.block_copy_paste} onCheckedChange={(checked) => handleChange("block_copy_paste", checked)} />}
              />
              <SettingRow
                title="Violation Limit"
                description="Maximum allowed integrity violations before escalation on this quiz."
                control={<NumberInput value={settings.violation_limit} min={1} onChange={(value) => handleChange("violation_limit", value)} />}
              />
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Scoring Rules</p>
                <p className="text-sm text-muted-foreground">Advanced scoring adjustments for wrong answers and integrity penalties.</p>
              </div>
              <SettingRow
                title="Enable Negative Marking"
                description="Turns on deduction rules for incorrect answers."
                control={<Switch checked={settings.negative_marking} onCheckedChange={(checked) => handleChange("negative_marking", checked)} />}
              />
              <SettingRow
                title="Penalty per Wrong Answer"
                description="Marks deducted for each incorrect answer when negative marking is enabled."
                control={<NumberInput value={settings.penalty_wrong} min={0} onChange={(value) => handleChange("penalty_wrong", value)} />}
              />
              <SettingRow
                title="Violation Penalty"
                description="Marks deducted during grading for integrity violations on this quiz."
                control={<NumberInput value={settings.violation_penalty} min={0} onChange={(value) => handleChange("violation_penalty", value)} />}
              />
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Attempt Policies</p>
                <p className="text-sm text-muted-foreground">Per-quiz attempt limits and recovery rules for this teacher’s exam.</p>
              </div>
              <SettingRow
                title="Attempts Allowed"
                description="Number of attempts a student can create for this quiz."
                control={<NumberInput value={settings.attempts_allowed} min={1} onChange={(value) => handleChange("attempts_allowed", value)} />}
              />
              <SettingRow
                title="Allow Resume Attempt"
                description="Allows students to continue an interrupted attempt for this quiz."
                control={<Switch checked={settings.allow_resume} onCheckedChange={(checked) => handleChange("allow_resume", checked)} />}
              />
              <SettingRow
                title="Prevent Duplicate Student Attempts"
                description="Blocks repeated attempts from the same student identity for this quiz."
                control={<Switch checked={settings.prevent_duplicate} onCheckedChange={(checked) => handleChange("prevent_duplicate", checked)} />}
              />
            </div>
          </CardContent>
        )}
      </Card>


      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/95 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {isLoading ? "Loading current settings..." : saveMessage || "Changes apply only to this teacher-owned quiz."}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleReset} disabled={saveMutation.isPending}>
            Reset to Default Settings
          </Button>
          <Button type="button" onClick={handleSave} disabled={saveMutation.isPending || isLoading}>
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  )
}
