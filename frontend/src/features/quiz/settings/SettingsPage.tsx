"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { quizApi } from "@/lib/api/quiz"
import { getApiErrorMessage } from "@/lib/api/error"
import {
  createDefaultVerificationSchema,
  defaultQuizExamSettings,
  type QuizExamSettings,
  type QuizVerificationField,
  type QuizVerificationSchema,
} from "@/types/quiz"

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

function normalizeFieldKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64)
}

function cloneVerificationSchema(schema: QuizVerificationSchema): QuizVerificationSchema {
  return JSON.parse(JSON.stringify(schema)) as QuizVerificationSchema
}

function createEmptyField(nextIndex: number): QuizVerificationField {
  return {
    key: `custom_field_${nextIndex}`,
    label: `Custom Field ${nextIndex}`,
    type: "text",
    required: false,
    placeholder: "",
    help_text: "",
    options: [],
    min_length: null,
    max_length: 120,
    pattern: null,
    lowercase: false,
    uppercase: false,
  }
}

function VerificationFieldEditor({
  field,
  usedForIdentity,
  onChange,
  onToggleIdentity,
  onRemove,
}: {
  field: QuizVerificationField
  usedForIdentity: boolean
  onChange: (next: QuizVerificationField) => void
  onToggleIdentity: () => void
  onRemove: () => void
}) {
  const optionCsv = field.options.map((option) => `${option.value}:${option.label}`).join(", ")

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-background/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{field.label || "Untitled field"}</p>
          <p className="text-xs text-muted-foreground">Key: {field.key}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={`Remove ${field.label}`}>
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium text-foreground">Label</span>
          <Input value={field.label} onChange={(event) => onChange({ ...field, label: event.target.value })} />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-foreground">Key</span>
          <Input
            value={field.key}
            onChange={(event) => onChange({ ...field, key: normalizeFieldKey(event.target.value) })}
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-foreground">Field Type</span>
          <select
            value={field.type}
            onChange={(event) =>
              onChange({
                ...field,
                type: event.target.value as QuizVerificationField["type"],
                options: event.target.value === "select" ? field.options : [],
              })
            }
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="select">Select</option>
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-foreground">Placeholder</span>
          <Input
            value={field.placeholder ?? ""}
            onChange={(event) => onChange({ ...field, placeholder: event.target.value })}
          />
        </label>
        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-foreground">Help Text</span>
          <Input value={field.help_text ?? ""} onChange={(event) => onChange({ ...field, help_text: event.target.value })} />
        </label>
        {field.type === "select" ? (
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium text-foreground">Options</span>
            <Input
              value={optionCsv}
              onChange={(event) =>
                onChange({
                  ...field,
                  options: event.target.value
                    .split(",")
                    .map((token) => token.trim())
                    .filter(Boolean)
                    .map((token) => {
                      const [value, label] = token.includes(":") ? token.split(":", 2) : [token, token]
                      return { value: value.trim(), label: (label ?? value).trim() }
                    }),
                })
              }
              placeholder="value:Label, another:Another Label"
            />
          </label>
        ) : (
          <>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Min Length</span>
              <Input
                type="number"
                min={1}
                value={field.min_length ?? ""}
                onChange={(event) => onChange({ ...field, min_length: event.target.value ? Number(event.target.value) : null })}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Max Length</span>
              <Input
                type="number"
                min={1}
                value={field.max_length ?? ""}
                onChange={(event) => onChange({ ...field, max_length: event.target.value ? Number(event.target.value) : null })}
              />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-medium text-foreground">Pattern</span>
              <Input value={field.pattern ?? ""} onChange={(event) => onChange({ ...field, pattern: event.target.value || null })} />
            </label>
          </>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-center justify-between rounded-xl border border-border/70 p-3">
          <span className="text-sm text-foreground">Required</span>
          <Switch checked={field.required} onCheckedChange={(checked) => onChange({ ...field, required: checked })} />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border/70 p-3">
          <span className="text-sm text-foreground">Use For Identity</span>
          <Switch checked={usedForIdentity} onCheckedChange={onToggleIdentity} />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border/70 p-3">
          <span className="text-sm text-foreground">Uppercase</span>
          <Switch checked={Boolean(field.uppercase)} onCheckedChange={(checked) => onChange({ ...field, uppercase: checked, lowercase: checked ? false : field.lowercase })} />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border/70 p-3">
          <span className="text-sm text-foreground">Lowercase</span>
          <Switch checked={Boolean(field.lowercase)} onCheckedChange={(checked) => onChange({ ...field, lowercase: checked, uppercase: checked ? false : field.uppercase })} />
        </div>
      </div>
    </div>
  )
}

export function SettingsPage({ quizId }: { quizId: string }) {
  const queryClient = useQueryClient()
  const [settings, setSettings] = useState<QuizExamSettings>(defaultQuizExamSettings)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [verificationOpen, setVerificationOpen] = useState(true)
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

  const updateVerification = (updater: (current: QuizVerificationSchema) => QuizVerificationSchema) => {
    setSaveMessage("")
    setSettings((current) => ({ ...current, verification: updater(cloneVerificationSchema(current.verification)) }))
  }

  const handleVerificationContextChange = (context: QuizVerificationSchema["context"]) => {
    updateVerification(() => createDefaultVerificationSchema(context))
  }

  const handleFieldChange = (fieldIndex: number, nextField: QuizVerificationField) => {
    updateVerification((current) => ({
      ...current,
      fields: current.fields.map((field, index) => (index === fieldIndex ? nextField : field)),
      identity_fields: current.identity_fields.map((key) => (key === current.fields[fieldIndex]?.key ? nextField.key : key)),
    }))
  }

  const toggleIdentityField = (fieldKey: string) => {
    updateVerification((current) => {
      const exists = current.identity_fields.includes(fieldKey)
      const nextIdentityFields = exists
        ? current.identity_fields.filter((key) => key !== fieldKey)
        : [...current.identity_fields, fieldKey]

      return {
        ...current,
        identity_fields: nextIdentityFields.length > 0 ? nextIdentityFields : [fieldKey],
      }
    })
  }

  const handleRemoveField = (fieldKey: string) => {
    updateVerification((current) => {
      const nextFields = current.fields.filter((field) => field.key !== fieldKey)
      const nextIdentityFields = current.identity_fields.filter((key) => key !== fieldKey)
      return {
        ...current,
        fields: nextFields.length > 0 ? nextFields : [createEmptyField(1)],
        identity_fields: nextIdentityFields.length > 0 ? nextIdentityFields : [nextFields[0]?.key ?? "custom_field_1"],
      }
    })
  }

  const addField = () => {
    updateVerification((current) => ({
      ...current,
      fields: [...current.fields, createEmptyField(current.fields.length + 1)],
    }))
  }

  const handleSave = () => {
    saveMutation.mutate(settings)
  }

  const handleReset = () => {
    setSaveMessage("")
    saveMutation.mutate({
      ...defaultQuizExamSettings,
      verification: createDefaultVerificationSchema(settings.verification.context),
    })
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Exam Settings</CardTitle>
          <CardDescription>
            Basic settings stay visible. Advanced controls and a schema-driven verification model let each quiz collect only the student identity data it truly needs.
          </CardDescription>
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
            <CardTitle className="text-base">Verification Schema</CardTitle>
            <CardDescription>
              Define exactly which identity fields students see before entering this quiz. These rules power both frontend rendering and backend validation.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => setVerificationOpen((current) => !current)}>
            {verificationOpen ? "Hide" : "Show"}
            {verificationOpen ? <ChevronUp className="ml-2 size-4" /> : <ChevronDown className="ml-2 size-4" />}
          </Button>
        </CardHeader>
        {verificationOpen && (
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-foreground">Verification Context</span>
                <select
                  value={settings.verification.context}
                  onChange={(event) => handleVerificationContextChange(event.target.value as QuizVerificationSchema["context"])}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="college">College</option>
                  <option value="school">School</option>
                  <option value="coaching">Coaching</option>
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-foreground">Verification Title</span>
                <Input value={settings.verification.title} onChange={(event) => updateVerification((current) => ({ ...current, title: event.target.value }))} />
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium text-foreground">Verification Description</span>
                <Input
                  value={settings.verification.description ?? ""}
                  onChange={(event) => updateVerification((current) => ({ ...current, description: event.target.value }))}
                />
              </label>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Fields</p>
                <p className="text-sm text-muted-foreground">
                  Mark the fields that should participate in duplicate-attempt identity checks. You can edit labels, formats, and option lists per quiz.
                </p>
              </div>

              {settings.verification.fields.map((field, index) => (
                <VerificationFieldEditor
                  key={`${field.key}-${index}`}
                  field={field}
                  usedForIdentity={settings.verification.identity_fields.includes(field.key)}
                  onChange={(nextField) => handleFieldChange(index, nextField)}
                  onToggleIdentity={() => toggleIdentityField(field.key)}
                  onRemove={() => handleRemoveField(field.key)}
                />
              ))}

              <Button type="button" variant="outline" onClick={addField}>
                <Plus className="mr-2 size-4" />
                Add Verification Field
              </Button>
            </div>
          </CardContent>
        )}
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
                <p className="text-sm text-muted-foreground">Per-quiz attempt limits and recovery rules for this teacher-owned exam.</p>
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
                description="Blocks repeated attempts from the same configured student identity for this quiz."
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
