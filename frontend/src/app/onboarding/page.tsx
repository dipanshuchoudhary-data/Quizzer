"use client"

import { useEffect, useState, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Check, ChevronDown, Clock3, Globe2, Plus, University, X } from "lucide-react"
import { toast } from "sonner"
import { userApi } from "@/lib/api/user"
import { getApiErrorMessage } from "@/lib/api/error"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/useAuthStore"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const EXPERIENCE_OPTIONS = ["0-1 years", "1-3 years", "3-5 years", "5-10 years", "10+ years"] as const

const COUNTRIES = [
  "India",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Netherlands",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "Switzerland",
  "Ireland",
  "Singapore",
  "United Arab Emirates",
  "Saudi Arabia",
  "Qatar",
  "Oman",
  "Kuwait",
  "South Africa",
  "Nigeria",
  "Kenya",
  "Egypt",
  "Japan",
  "South Korea",
  "China",
  "Hong Kong",
  "Taiwan",
  "Thailand",
  "Vietnam",
  "Malaysia",
  "Indonesia",
  "Philippines",
  "Nepal",
  "Bangladesh",
  "Sri Lanka",
  "Pakistan",
  "Brazil",
  "Mexico",
  "Argentina",
  "Chile",
  "Colombia",
  "New Zealand",
]

const onboardingSchema = z.object({
  subject_area: z.string().trim().min(1, "Please enter your department"),
  institution: z.string().trim().min(1, "Please enter your university"),
  teaching_experience: z.string().min(1, "Please select your teaching experience"),
  country: z.string().min(1, "Please select your country"),
  timezone: z.string().trim().min(1, "Please enter your timezone"),
  courses: z
    .array(z.string().min(1))
    .min(1, "Please add at least one course you teach")
    .max(15, "You can add up to 15 courses"),
})

type OnboardingValues = z.infer<typeof onboardingSchema>

function parseCourses(rawValue?: string | null) {
  if (!rawValue) return []
  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 15)
}

function detectCountry(timezone: string, fallback?: string | null) {
  if (fallback?.trim()) return fallback.trim()
  if (typeof window === "undefined") return "India"

  const locale = window.navigator.language
  if (locale.toLowerCase().endsWith("-in")) return "India"
  if (timezone === "Asia/Kolkata" || timezone === "Asia/Calcutta") return "India"
  return "India"
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs font-medium text-destructive">{message}</p>
}

type SearchableSelectProps = {
  value: string
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  options: string[]
  error?: string
  onSelect: (value: string) => void
}

function SearchableSelect({
  value,
  placeholder,
  searchPlaceholder,
  emptyText,
  options,
  error,
  onSelect,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-12 w-full justify-between rounded-xl border bg-background px-4 text-left font-normal shadow-sm",
            !value && "text-muted-foreground",
            error && "border-destructive text-destructive"
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] rounded-xl border p-0 shadow-xl" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {options.map((option) => (
              <CommandItem
                key={option}
                value={option}
                onSelect={() => {
                  onSelect(option)
                  setOpen(false)
                }}
                className="flex items-center justify-between px-3 py-2.5"
              >
                <span>{option}</span>
                {value === option ? <Check className="size-4 text-primary" /> : null}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

type CourseTagInputProps = {
  value: string[]
  error?: string
  onChange: (value: string[]) => void
}

function CourseTagInput({ value, error, onChange }: CourseTagInputProps) {
  const [inputValue, setInputValue] = useState("")

  const addCourse = () => {
    const nextCourse = inputValue.trim()
    if (!nextCourse) return
    if (value.some((course) => course.toLowerCase() === nextCourse.toLowerCase())) return
    if (value.length >= 15) return

    onChange([...value, nextCourse])
    setInputValue("")
  }

  const removeCourse = (courseToRemove: string) => {
    onChange(value.filter((course) => course !== courseToRemove))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      addCourse()
      return
    }

    if (event.key === "Backspace" && !inputValue && value.length > 0) {
      event.preventDefault()
      onChange(value.slice(0, -1))
    }
  }

  const atLimit = value.length >= 15

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-2xl border bg-background p-3 shadow-sm transition",
          error ? "border-destructive" : "border-border"
        )}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {value.length > 0 ? (
            value.map((course) => (
              <Badge
                key={course}
                className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground"
              >
                {course}
                <button
                  type="button"
                  className="ml-2 rounded-full text-muted-foreground transition hover:text-foreground"
                  onClick={() => removeCourse(course)}
                  aria-label={`Remove ${course}`}
                >
                  <X className="size-3.5" />
                </button>
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Add the courses you actively teach.</p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={atLimit ? "Course limit reached" : "Type a course and press Enter"}
            className="h-11 rounded-xl border-0 bg-muted/60 shadow-none"
            disabled={atLimit}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl px-4"
            onClick={addCourse}
            disabled={!inputValue.trim() || atLimit}
          >
            <Plus className="size-4" />
            Add course
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Press Enter to add each course.</span>
        <span>{value.length}/15 added</span>
      </div>
      <FieldError message={error} />
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const setUser = useAuthStore((state) => state.setUser)
  const user = useAuthStore((state) => state.user)
  const [detectedTimezone, setDetectedTimezone] = useState("Asia/Calcutta")

  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Calcutta"
    setDetectedTimezone(timezone)
  }, [])

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    mode: "onChange",
    defaultValues: {
      subject_area: user?.subject_area || "",
      institution: user?.institution || "",
      teaching_experience: user?.teaching_experience || "",
      country: detectCountry(detectedTimezone, user?.country),
      timezone: user?.timezone || detectedTimezone,
      courses: parseCourses(user?.courses_taught),
    },
  })

  const experience = watch("teaching_experience")
  const country = watch("country")
  const timezone = watch("timezone")
  const courses = watch("courses")

  useEffect(() => {
    reset({
      subject_area: user?.subject_area || "",
      institution: user?.institution || "",
      teaching_experience: user?.teaching_experience || "",
      country: detectCountry(detectedTimezone, user?.country),
      timezone: user?.timezone || detectedTimezone,
      courses: parseCourses(user?.courses_taught),
    })
  }, [detectedTimezone, reset, user])

  const onSubmit = async (values: OnboardingValues) => {
    try {
      const updated = await userApi.updateProfile({
        subject_area: values.subject_area,
        institution: values.institution.trim(),
        teaching_experience: values.teaching_experience,
        country: values.country,
        timezone: values.timezone.trim(),
        courses_taught: values.courses.join(", "),
        onboarding_completed: true,
      })
      setUser(updated)
      toast.success("Your workspace is ready")
      router.replace("/dashboard")
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save onboarding"))
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_32%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted))/0.65)] px-6 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_0%,rgba(148,163,184,0.08)_50%,transparent_100%)] opacity-60" />

      <Card className="relative w-full max-w-3xl rounded-[28px] border-border/70 bg-background/90 shadow-2xl backdrop-blur">
        <CardHeader className="space-y-2 border-b border-border/70 pb-8">
          <div className="space-y-2">
            <CardTitle className="text-3xl font-semibold tracking-tight">Welcome to Quizzer</CardTitle>
            <CardDescription className="max-w-2xl text-base text-muted-foreground">
              Set up your teaching profile to personalize your workspace.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="px-6 py-8 sm:px-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <FieldLabel label="Department" hint="Enter your department name." />
                <Input
                  placeholder="Enter your department"
                  className="h-12 rounded-xl"
                  {...register("subject_area")}
                />
                <FieldError message={errors.subject_area?.message} />
              </div>

              <div className="space-y-3">
                <FieldLabel label="University" hint="Enter your institution name." />
                <Input
                  placeholder="Enter your university"
                  className="h-12 rounded-xl"
                  {...register("institution")}
                />
                <FieldError message={errors.institution?.message} />
              </div>

              <div className="space-y-3">
                <FieldLabel label="Years of teaching" hint="Pick the range that best matches your experience." />
                <Select
                  value={experience}
                  onValueChange={(value) =>
                    setValue("teaching_experience", value, { shouldDirty: true, shouldValidate: true })
                  }
                >
                  <SelectTrigger
                    className={cn(
                      "h-12 w-full rounded-xl",
                      errors.teaching_experience?.message && "border-destructive text-destructive"
                    )}
                  >
                    <SelectValue placeholder="Select experience" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl">
                    {EXPERIENCE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={errors.teaching_experience?.message} />
              </div>

              <div className="space-y-3">
                <FieldLabel label="Country" hint="Pre-filled from your browser when possible." />
                <SearchableSelect
                  value={country}
                  placeholder="Select country"
                  searchPlaceholder="Search countries..."
                  emptyText="No country found."
                  options={COUNTRIES}
                  error={errors.country?.message}
                  onSelect={(value) => setValue("country", value, { shouldDirty: true, shouldValidate: true })}
                />
                <FieldError message={errors.country?.message} />
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="space-y-3">
                <FieldLabel label="Timezone" hint="Auto-detected from your browser, but still editable." />
                <div className="relative">
                  <Clock3 className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-12 rounded-xl pl-11"
                    placeholder="Asia/Calcutta"
                    {...register("timezone")}
                  />
                </div>
                <FieldError message={errors.timezone?.message} />
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-background p-2 shadow-sm">
                    <Globe2 className="size-4 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Detected settings</p>
                    <p className="text-sm text-muted-foreground">{country || "India"}</p>
                    <p className="text-sm text-muted-foreground">{timezone || "Asia/Calcutta"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <FieldLabel label="Courses taught" hint="Add each course as a separate tag. At least one is required." />
              <CourseTagInput
                value={courses}
                error={errors.courses?.message}
                onChange={(nextCourses) => setValue("courses", nextCourses, { shouldDirty: true, shouldValidate: true })}
              />
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-background p-2 shadow-sm">
                  <University className="size-4 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Your workspace will be tailored to your teaching profile.</p>
                  <p className="text-sm text-muted-foreground">
                    We use this to personalize quiz generation, templates, and exam workflows.
                  </p>
                </div>
              </div>

              <Button
                className="h-12 min-w-44 rounded-xl px-6 text-sm font-semibold shadow-lg shadow-primary/20"
                type="submit"
                disabled={!isValid || isSubmitting}
              >
                {isSubmitting ? "Saving profile..." : "Complete Setup"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
