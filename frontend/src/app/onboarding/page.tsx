"use client"

import { useEffect, useState, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Check, ChevronDown, Clock3, Globe2, Plus, University, X, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react"
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
    <div className="space-y-2">
      <label className="text-sm font-semibold text-foreground block">{label}</label>
      {hint ? (
        <p className="text-xs text-muted-foreground font-normal">{hint}</p>
      ) : null}
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-2.5">
      <div className="mt-0.5 size-4 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
        <span className="size-1.5 rounded-full bg-destructive" />
      </div>
      <p className="text-xs font-medium text-destructive">{message}</p>
    </div>
  )
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
            "h-13 w-full justify-between rounded-xl border-2 bg-background px-4 text-left font-normal transition-all",
            !value && "text-muted-foreground",
            error && "border-destructive/50 bg-destructive/5 text-destructive",
            !error && "border-border/40 hover:border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/10"
          )}
        >
          <span className="truncate font-medium">{value || placeholder}</span>
          <ChevronDown className={cn("size-5 opacity-60 transition-transform", open && "rotate-180")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] animate-in fade-in-0 zoom-in-95 rounded-xl border-border/40 p-0 shadow-2xl" align="start">
        <Command>
          <CommandInput 
            placeholder={searchPlaceholder}
            className="border-b border-border/30 bg-muted/40"
          />
          <CommandList className="max-h-64">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">{emptyText}</CommandEmpty>
            {options.map((option, index) => (
              <CommandItem
                key={option}
                value={option}
                onSelect={() => {
                  onSelect(option)
                  setOpen(false)
                }}
                className={cn(
                  "flex cursor-pointer items-center justify-between px-4 py-2.5 transition-all hover:bg-muted/60",
                  value === option && "bg-primary/10"
                )}
                style={{
                  animation: `slideIn 0.2s ease-out ${index * 20}ms forwards`,
                  opacity: 0,
                }}
              >
                <span className={cn("text-sm", value === option && "font-semibold text-primary")}>{option}</span>
                {value === option && <Check className="size-4 text-primary" />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes slideIn {
                from {
                  opacity: 0;
                  transform: translateX(-4px);
                }
                to {
                  opacity: 1;
                  transform: translateX(0);
                }
              }
            `,
          }}
        />
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
    if (value.some((course) => course.toLowerCase() === nextCourse.toLowerCase())) {
      toast.info("This course is already added")
      return
    }
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
    <div className="space-y-4">
      <div
        className={cn(
          "rounded-2xl border-2 bg-background p-4 transition-all duration-200",
          error ? "border-destructive/50 bg-destructive/5" : "border-border/40 hover:border-border/60"
        )}
      >
        {/* Tags display */}
        {value.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {value.map((course, index) => (
              <Badge
                key={course}
                className={cn(
                  "animate-in fade-in-50 zoom-in-75 rounded-full border px-3 py-2 text-xs font-medium",
                  "border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 text-primary hover:from-primary/15 hover:to-primary/10",
                  "transition-all"
                )}
                style={{
                  animation: `fadeInUp 0.3s ease-out ${index * 50}ms forwards`,
                  opacity: 0,
                }}
              >
                <style
                  dangerouslySetInnerHTML={{
                    __html: `
                      @keyframes fadeInUp {
                        from {
                          opacity: 0;
                          transform: translateY(4px) scale(0.95);
                        }
                        to {
                          opacity: 1;
                          transform: translateY(0) scale(1);
                        }
                      }
                    `,
                  }}
                />
                {course}
                <button
                  type="button"
                  className={cn(
                    "ml-2 inline-flex rounded-full transition-transform hover:scale-110",
                    "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => removeCourse(course)}
                  aria-label={`Remove ${course}`}
                >
                  <X className="size-3.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={atLimit ? "Course limit reached" : "Type course name and press Enter"}
            className={cn(
              "h-11 flex-1 rounded-xl border-0 bg-muted/60 transition-all focus:bg-muted/80 focus:ring-2 focus:ring-primary/30",
              "placeholder:text-muted-foreground"
            )}
            disabled={atLimit}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl border-primary/20 bg-primary/5 px-4 font-medium transition-all hover:bg-primary/10 hover:border-primary/30"
            onClick={addCourse}
            disabled={!inputValue.trim() || atLimit}
          >
            <Plus className="mr-2 size-4" />
            Add
          </Button>
        </div>

        {/* Empty state message */}
        {value.length === 0 && (
          <div className="mt-2 text-sm text-muted-foreground">
            No courses added yet. Add the courses you teach or mentor.
          </div>
        )}
      </div>

      {/* Counter and helper */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Press Enter or click Add to add courses</span>
        <span className={cn(
          "font-medium transition-colors",
          atLimit ? "text-destructive" : "text-muted-foreground"
        )}>
          {value.length}/15
        </span>
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
  const [currentStep, setCurrentStep] = useState(1)
  const [isCompletionAnimating, setIsCompletionAnimating] = useState(false)

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
  const subject_area = watch("subject_area")
  const institution = watch("institution")

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

  // Validation helpers for individual steps
  const isStep1Valid = subject_area.trim() && institution.trim() && experience
  const isStep2Valid = country && timezone.trim()
  const isStep3Valid = courses.length > 0

  const canAdvanceStep = currentStep === 1 ? isStep1Valid : currentStep === 2 ? isStep2Valid : true

  const onSubmit = async (values: OnboardingValues) => {
    try {
      setIsCompletionAnimating(true)
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
      toast.success("Welcome to Quizzer! Your workspace is ready.")
      
      // Delay redirect for animation effect
      setTimeout(() => {
        router.replace("/dashboard")
      }, 600)
    } catch (error) {
      setIsCompletionAnimating(false)
      toast.error(getApiErrorMessage(error, "Unable to save onboarding"))
    }
  }

  const handleNextStep = () => {
    if (canAdvanceStep && currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleFinalSubmit = () => {
    if (isStep3Valid) {
      handleSubmit(onSubmit)()
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-muted/40 px-4 py-10 sm:px-6">
      {/* Animated background elements */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Main card container */}
      <div className={cn(
        "relative w-full max-w-2xl transition-all duration-300",
        isCompletionAnimating && "scale-95 opacity-0"
      )}>
        <Card className="overflow-hidden rounded-2xl border-border/50 bg-background/95 shadow-2xl backdrop-blur-xl supports-[backdrop-filter]:bg-background/85">
          {/* Header with progress */}
          <div className="border-b border-border/40 bg-gradient-to-r from-background to-muted/30 px-6 py-8 sm:px-8">
            {/* Progress bar */}
            <div className="mb-6 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Step {currentStep} of 3</p>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                    {currentStep === 1 && "Welcome to Quizzer"}
                    {currentStep === 2 && "Where are you located?"}
                    {currentStep === 3 && "Final touches"}
                  </h1>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-xs font-bold text-primary">{currentStep}/3</span>
                </div>
              </div>

              {/* Visual progress bar */}
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 ease-out"
                  style={{ width: `${(currentStep / 3) * 100}%` }}
                />
              </div>
            </div>

            {/* Step description */}
            <p className="text-sm text-muted-foreground">
              {currentStep === 1 && "Tell us about your teaching background and institution."}
              {currentStep === 2 && "Configure your location and timezone preferences."}
              {currentStep === 3 && "Add the courses you teach and complete your setup."}
            </p>
          </div>

          {/* Content */}
          <CardContent className="px-6 py-8 sm:px-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              {/* Step 1: Basic Info */}
              {currentStep === 1 && (
                <div
                  className="animate-in fade-in-50 slide-in-from-bottom-4 duration-300"
                  style={{
                    animation: "fadeInUp 0.5s ease-out forwards",
                  }}
                >
                  <style
                    dangerouslySetInnerHTML={{
                      __html: `
                        @keyframes fadeInUp {
                          from {
                            opacity: 0;
                            transform: translateY(12px);
                          }
                          to {
                            opacity: 1;
                            transform: translateY(0);
                          }
                        }
                      `,
                    }}
                  />
                  <div className="space-y-6">
                    {/* Department Field */}
                    <div className="space-y-3">
                      <FieldLabel label="Department or Subject Area" hint="e.g., Computer Science, Mathematics" />
                      <div className="relative">
                        <Input
                          placeholder="Enter your department"
                          className={cn(
                            "h-13 rounded-xl border-2 transition-all focus:border-primary focus:ring-2 focus:ring-primary/10",
                            errors.subject_area?.message ? "border-destructive" : "border-border/40 hover:border-border/60"
                          )}
                          {...register("subject_area")}
                        />
                      </div>
                      <FieldError message={errors.subject_area?.message} />
                    </div>

                    {/* University Field */}
                    <div className="space-y-3">
                      <FieldLabel label="Institution" hint="Your university or college name" />
                      <Input
                        placeholder="Enter your institution"
                        className={cn(
                          "h-13 rounded-xl border-2 transition-all focus:border-primary focus:ring-2 focus:ring-primary/10",
                          errors.institution?.message ? "border-destructive" : "border-border/40 hover:border-border/60"
                        )}
                        {...register("institution")}
                      />
                      <FieldError message={errors.institution?.message} />
                    </div>

                    {/* Experience Field */}
                    <div className="space-y-3">
                      <FieldLabel label="Teaching Experience" hint="Select the range that matches you" />
                      <Select
                        value={experience}
                        onValueChange={(value) =>
                          setValue("teaching_experience", value, { shouldDirty: true, shouldValidate: true })
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            "h-13 w-full rounded-xl border-2 transition-all focus:border-primary focus:ring-2 focus:ring-primary/10",
                            errors.teaching_experience?.message ? "border-destructive" : "border-border/40 hover:border-border/60"
                          )}
                        >
                          <SelectValue placeholder="Select your experience" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl">
                          {EXPERIENCE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option} className="cursor-pointer">
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError message={errors.teaching_experience?.message} />
                    </div>

                    {/* Info Card */}
                    <div className="mt-8 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <Sparkles className="size-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Pro Tip</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            We'll use this information to personalize your quiz generation and teaching templates.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Location Settings */}
              {currentStep === 2 && (
                <div
                  style={{
                    animation: "fadeInUp 0.5s ease-out forwards",
                  }}
                >
                  <div className="space-y-6">
                    {/* Country Field */}
                    <div className="space-y-3">
                      <FieldLabel label="Country" hint="Auto-detected when possible" />
                      <SearchableSelect
                        value={country}
                        placeholder="Select your country"
                        searchPlaceholder="Search countries..."
                        emptyText="No country found."
                        options={COUNTRIES}
                        error={errors.country?.message}
                        onSelect={(value) => setValue("country", value, { shouldDirty: true, shouldValidate: true })}
                      />
                      <FieldError message={errors.country?.message} />
                    </div>

                    {/* Timezone Field */}
                    <div className="space-y-3">
                      <FieldLabel label="Timezone" hint="Auto-detected from your browser" />
                      <div className="relative">
                        <Clock3 className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className="h-13 rounded-xl border-2 border-border/40 pl-12 transition-all hover:border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/10"
                          placeholder="Auto-detected"
                          {...register("timezone")}
                        />
                      </div>
                      <FieldError message={errors.timezone?.message} />
                    </div>

                    {/* Detected Info Card */}
                    <div className="mt-8 rounded-2xl border border-border/40 bg-muted/40 p-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-background p-2">
                          <Globe2 className="size-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">Auto-detected Settings</p>
                          <div className="mt-2 space-y-1">
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium text-foreground">{country || "India"}</span>
                            </p>
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium text-foreground">{timezone || "Asia/Calcutta"}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Courses */}
              {currentStep === 3 && (
                <div
                  style={{
                    animation: "fadeInUp 0.5s ease-out forwards",
                  }}
                >
                  <div className="space-y-6">
                    {/* Courses Input */}
                    <div className="space-y-3">
                      <FieldLabel label="Courses You Teach" hint="Add at least one course. Press Enter to add each course." />
                      <CourseTagInput
                        value={courses}
                        error={errors.courses?.message}
                        onChange={(nextCourses) =>
                          setValue("courses", nextCourses, { shouldDirty: true, shouldValidate: true })
                        }
                      />
                    </div>

                    {/* Summary Card */}
                    <div className="mt-8 rounded-2xl border border-border/40 bg-muted/40 p-6">
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 rounded-lg bg-background p-2">
                            <CheckCircle2 className="size-5 text-green-600/60" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-foreground">Your Profile Summary</p>
                            <div className="mt-3 space-y-2 text-sm">
                              <p className="text-muted-foreground">
                                <span className="font-medium text-foreground">{subject_area}</span> Department
                              </p>
                              <p className="text-muted-foreground">
                                <span className="font-medium text-foreground">{institution}</span> Institution
                              </p>
                              <p className="text-muted-foreground">
                                <span className="font-medium text-foreground">{experience}</span> of teaching experience
                              </p>
                              <p className="text-muted-foreground">
                                Located in <span className="font-medium text-foreground">{country}</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevStep}
                  disabled={currentStep === 1 || isSubmitting}
                  className={cn(
                    "h-12 rounded-xl px-6 font-medium transition-all",
                    currentStep === 1 && "opacity-50 cursor-not-allowed"
                  )}
                >
                  Back
                </Button>

                <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                  {currentStep < 3 ? (
                    <Button
                      type="button"
                      onClick={handleNextStep}
                      disabled={!canAdvanceStep}
                      className={cn(
                        "h-12 flex-1 rounded-xl px-6 font-medium transition-all",
                        "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-lg hover:shadow-primary/30",
                        !canAdvanceStep && "opacity-60 cursor-not-allowed"
                      )}
                    >
                      <span>Next</span>
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleFinalSubmit}
                      disabled={!isStep3Valid || isSubmitting}
                      className={cn(
                        "h-12 flex-1 rounded-xl px-6 font-medium transition-all",
                        "bg-gradient-to-r from-green-600 to-green-600/90 text-white shadow-lg shadow-green-600/20 hover:shadow-lg hover:shadow-green-600/30",
                        !isStep3Valid && "opacity-60 cursor-not-allowed"
                      )}
                    >
                      <span>{isSubmitting ? "Setting up workspace..." : "Complete Setup"}</span>
                      {!isSubmitting && <CheckCircle2 className="ml-2 size-4" />}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Success state (shown after completion) */}
      {isCompletionAnimating && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            animation: "fadeIn 0.3s ease-out 0.3s forwards",
            opacity: 0,
          }}
        >
          <style
            dangerouslySetInnerHTML={{
              __html: `
                @keyframes fadeIn {
                  to {
                    opacity: 1;
                  }
                }
              `,
            }}
          />
          <div className="text-center">
            <div
              className="mx-auto mb-4 size-16 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white"
              style={{
                animation: "scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              }}
            >
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                    @keyframes scaleIn {
                      from {
                        transform: scale(0);
                      }
                      to {
                        transform: scale(1);
                      }
                    }
                  `,
                }}
              />
              <CheckCircle2 className="size-8" />
            </div>
            <p className="text-xl font-bold tracking-tight">All set!</p>
            <p className="mt-1 text-muted-foreground">Your workspace is ready. Redirecting...</p>
          </div>
        </div>
      )}
    </div>
  )
}
