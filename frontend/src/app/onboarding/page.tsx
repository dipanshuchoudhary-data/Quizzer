"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BookOpen, GraduationCap, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { getApiErrorMessage } from "@/lib/api/error"
import { getPostAuthRoute, storeAccessToken } from "@/lib/auth"
import { userApi } from "@/lib/api/user"
import { useAuthStore } from "@/stores/useAuthStore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type RoleOption = "student" | "teacher"

type TeacherProfileForm = {
  subject_area: string
  institution: string
  teaching_experience: string
  country: string
  timezone: string
  courses_taught: string
}

const INITIAL_FORM: TeacherProfileForm = {
  subject_area: "",
  institution: "",
  teaching_experience: "",
  country: "",
  timezone: "",
  courses_taught: "",
}

const ROLE_COPY: Record<RoleOption, { title: string; description: string; icon: typeof GraduationCap }> = {
  student: {
    title: "Student",
    description: "Join assessments, track your activity, and enter the learner workspace.",
    icon: BookOpen,
  },
  teacher: {
    title: "Teacher",
    description: "Create quizzes, manage exams, and unlock the full teaching workspace.",
    icon: GraduationCap,
  },
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingLoadingState />}>
      <OnboardingContent />
    </Suspense>
  )
}

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  // Use individual selectors to avoid re-renders on unrelated store changes (zustand v5)
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const refreshMe = useAuthStore((state) => state.refreshMe)

  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isSavingRole, setIsSavingRole] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [selectedRole, setSelectedRole] = useState<RoleOption | null>(null)
  const [form, setForm] = useState<TeacherProfileForm>(INITIAL_FORM)
  const bootstrapRan = useRef(false)

  useEffect(() => {
    // Ensure bootstrap only runs once, not on every user object change
    if (bootstrapRan.current) return
    bootstrapRan.current = true

    let cancelled = false

    const bootstrap = async () => {
      if (token) {
        storeAccessToken(token)
      }

      try {
        // Always fetch fresh user data on mount
        const me = await refreshMe()
        if (cancelled) return

        if (me.onboarding_completed && me.role) {
          router.replace(getPostAuthRoute(me))
          return
        }

        const nextRole = me.role === "student" || me.role === "teacher" ? me.role : null
        setSelectedRole(nextRole)
        setForm({
          subject_area: me.subject_area ?? "",
          institution: me.institution ?? "",
          teaching_experience: me.teaching_experience ?? "",
          country: me.country ?? "",
          timezone: me.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
          courses_taught: me.courses_taught ?? "",
        })
      } catch {
        if (!cancelled) {
          router.replace("/login")
          return
        }
      }

      if (!cancelled) {
        setIsBootstrapping(false)
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const teacherFormValid = useMemo(() => {
    return (
      form.subject_area.trim() &&
      form.institution.trim() &&
      form.teaching_experience.trim() &&
      form.country.trim() &&
      form.timezone.trim() &&
      form.courses_taught.trim()
    )
  }, [form])

  const updateField = (field: keyof TeacherProfileForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleRoleSelection = async (role: RoleOption) => {
    setSelectedRole(role)
    setIsSavingRole(true)

    try {
      const updatedUser = await userApi.setRole({ role })
      setUser(updatedUser)

      if (role === "student") {
        toast.success("Student workspace ready.")
        router.replace(getPostAuthRoute(updatedUser))
        return
      }

      toast.success("Teacher role selected. Finish a few setup details to continue.")
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to save your role")
      toast.error(message)
      if (!user?.role) {
        setSelectedRole(null)
      }
    } finally {
      setIsSavingRole(false)
    }
  }

  const completeTeacherOnboarding = async () => {
    setIsSavingProfile(true)
    try {
      const updatedUser = await userApi.updateProfile({
        subject_area: form.subject_area.trim(),
        institution: form.institution.trim(),
        teaching_experience: form.teaching_experience.trim(),
        country: form.country.trim(),
        timezone: form.timezone.trim(),
        courses_taught: form.courses_taught.trim(),
        onboarding_completed: true,
      })
      setUser(updatedUser)
      toast.success("Teacher workspace ready.")
      router.replace(getPostAuthRoute(updatedUser))
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to complete onboarding"))
    } finally {
      setIsSavingProfile(false)
    }
  }

  if (isBootstrapping) {
    return <OnboardingLoadingState />
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.10),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-6 py-10 dark:bg-[radial-gradient(circle_at_top,_rgba(74,222,128,0.10),transparent_32%),linear-gradient(180deg,#081018_0%,#0f172a_100%)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Card className="overflow-hidden rounded-[28px] border-slate-200/80 bg-white/95 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] dark:border-[var(--border-color)] dark:bg-[var(--card-bg)]">
          <CardHeader className="border-b border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.12),transparent_32%),linear-gradient(135deg,_rgba(255,255,255,1)_0%,_rgba(248,250,252,1)_100%)] dark:border-[var(--border-color)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(74,222,128,0.10),transparent_32%),linear-gradient(135deg,_#0f172a_0%,_#111827_100%)]">
            <div className="flex items-center gap-3 text-emerald-700 dark:text-[var(--brand-accent)]">
              <Sparkles className="size-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.28em]">Welcome to Quizzer</span>
            </div>
            <CardTitle className="mt-4 text-3xl tracking-tight">Continue as:</CardTitle>
            <CardDescription className="max-w-2xl text-sm leading-6">
              Choose the workspace that matches how you&apos;ll use Quizzer. You can finish this flow without leaving the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 md:grid-cols-2">
            {(Object.keys(ROLE_COPY) as RoleOption[]).map((role) => {
              const item = ROLE_COPY[role]
              const Icon = item.icon
              const isActive = selectedRole === role
              return (
                <button
                  key={role}
                  type="button"
                  className={cn(
                    "rounded-3xl border px-6 py-6 text-left transition-all duration-200",
                    isActive
                      ? "border-emerald-400 bg-emerald-50 shadow-sm dark:border-emerald-500/60 dark:bg-emerald-500/10"
                      : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)] dark:hover:bg-[var(--card-hover)]"
                  )}
                  onClick={() => void handleRoleSelection(role)}
                  disabled={isSavingRole || isSavingProfile}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-900 dark:bg-[var(--bg-primary)] dark:text-[var(--text-primary)]">
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <p className="text-lg font-semibold text-slate-950 dark:text-[var(--text-primary)]">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-[var(--text-secondary)]">{item.description}</p>
                    </div>
                  </div>
                  <div className="mt-5">
                    <Button type="button" className="w-full" disabled={isSavingRole || isSavingProfile}>
                      {isSavingRole && isActive ? "Saving..." : `Continue as ${item.title}`}
                    </Button>
                  </div>
                </button>
              )
            })}
          </CardContent>
        </Card>

        {selectedRole === "teacher" ? (
          <Card className="rounded-[28px] border-slate-200/80 bg-white/95 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] dark:border-[var(--border-color)] dark:bg-[var(--card-bg)]">
            <CardHeader>
              <CardTitle className="text-2xl tracking-tight">Complete your teacher setup</CardTitle>
              <CardDescription>
                These details personalize quiz generation and unlock the teacher workspace after Google sign-in.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Input
                value={form.subject_area}
                onChange={(event) => updateField("subject_area", event.target.value)}
                placeholder="Subject area"
                disabled={isSavingProfile}
              />
              <Input
                value={form.institution}
                onChange={(event) => updateField("institution", event.target.value)}
                placeholder="Institution"
                disabled={isSavingProfile}
              />
              <Input
                value={form.teaching_experience}
                onChange={(event) => updateField("teaching_experience", event.target.value)}
                placeholder="Teaching experience"
                disabled={isSavingProfile}
              />
              <Input
                value={form.country}
                onChange={(event) => updateField("country", event.target.value)}
                placeholder="Country"
                disabled={isSavingProfile}
              />
              <Input
                value={form.timezone}
                onChange={(event) => updateField("timezone", event.target.value)}
                placeholder="Timezone"
                disabled={isSavingProfile}
              />
              <Input
                value={form.courses_taught}
                onChange={(event) => updateField("courses_taught", event.target.value)}
                placeholder="Courses taught, comma separated"
                disabled={isSavingProfile}
              />
              <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedRole(null)}
                  disabled={isSavingProfile}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => void completeTeacherOnboarding()}
                  disabled={!teacherFormValid || isSavingProfile}
                >
                  {isSavingProfile ? "Finishing setup..." : "Enter teacher dashboard"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

function OnboardingLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/40 to-background px-6">
      <div className="text-center">
        <Loader2 className="mx-auto mb-4 size-10 animate-spin text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">Preparing your workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">We&apos;re checking your account and setting up the next step.</p>
      </div>
    </div>
  )
}
