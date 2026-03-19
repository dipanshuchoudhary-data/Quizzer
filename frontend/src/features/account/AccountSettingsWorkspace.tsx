"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import {
  AlertCircle,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  KeyRound,
  Paintbrush2,
  PlugZap,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react"
import { useAuthStore } from "@/stores/useAuthStore"
import { useAccountSettingsStore } from "@/stores/useAccountSettingsStore"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/page/page-system"
import { cn } from "@/lib/utils"
import { getDisplayName } from "@/lib/user"

const tabs = [
  { value: "profile", label: "Profile", icon: UserRound, description: "Identity and account details" },
  { value: "preferences", label: "Preferences", icon: Paintbrush2, description: "Appearance and experience" },
  { value: "workspace", label: "Workspace", icon: BriefcaseBusiness, description: "Publishing and review defaults" },
  { value: "security", label: "Security", icon: ShieldCheck, description: "Password and session control" },
  { value: "notifications", label: "Notifications", icon: Bell, description: "Alerts and delivery rules" },
  { value: "integrations", label: "Integrations", icon: PlugZap, description: "Connected tools and access" },
] as const

type SettingsTab = (typeof tabs)[number]["value"]
type ProfileErrors = Partial<Record<"name" | "email" | "institution" | "timezone", string>>

function isSettingsTab(value: string | null): value is SettingsTab {
  return Boolean(value) && tabs.some((tab) => tab.value === value)
}

function SectionIntro({ eyebrow, title, description }: { eyebrow?: string; title: string; description: string }) {
  return (
    <div className="space-y-1">
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{eyebrow}</p> : null}
      <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-[var(--text-primary)]">{title}</h2>
      <p className="text-sm leading-6 text-slate-600 dark:text-[var(--text-secondary)]">{description}</p>
    </div>
  )
}

function Field({ label, helper, error, children }: { label: string; helper: string; error?: string; children: ReactNode }) {
  return (
    <label className="space-y-2">
      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-[var(--text-primary)]">{label}</p>
        <p className={cn("mt-1 text-xs leading-5", error ? "text-rose-600" : "text-slate-500 dark:text-[var(--text-muted)]")}>{error ?? helper}</p>
      </div>
      {children}
    </label>
  )
}

function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)]">
      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-[var(--text-primary)]">{title}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-[var(--text-secondary)]">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function ChoicePill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150",
        active
          ? "border-emerald-500 bg-emerald-500 text-white shadow-[0_10px_30px_-16px_rgba(16,185,129,0.9)]"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)] dark:text-[var(--text-secondary)] dark:hover:border-[var(--brand-accent)] dark:hover:text-[var(--text-primary)]"
      )}
    >
      {label}
    </button>
  )
}

function getInitials(name: string, email: string) {
  const source = name.trim() || email.trim() || "Q"
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function validateProfile(profile: { name: string; email: string; institution: string; timezone: string }): ProfileErrors {
  const errors: ProfileErrors = {}
  if (!profile.name.trim()) errors.name = "Display name is required."
  if (!profile.email.trim()) errors.email = "Email is required."
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) errors.email = "Enter a valid email address."
  if (!profile.institution.trim()) errors.institution = "Institution or organization is required."
  if (!profile.timezone.trim()) errors.timezone = "Timezone is required."
  return errors
}

export function AccountSettingsWorkspace() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { setTheme } = useTheme()
  const { user, logout } = useAuthStore()
  const { hydrated, saveState, profile, preferences, notifications, workspace, security, hydrate, setSaveState, patchProfile, patchPreferences, patchNotifications, patchWorkspace, patchSecurity } =
    useAccountSettingsStore()

  const saveTimer = useRef<number | null>(null)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const routeTab = searchParams.get("tab")
  const initialTab: SettingsTab = isSettingsTab(routeTab) ? routeTab : "profile"
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({})
  const [passwordDraft, setPasswordDraft] = useState({ current: "", next: "", confirm: "" })
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordState, setPasswordState] = useState<"idle" | "saving" | "saved">("idle")

  useEffect(() => {
    hydrate(user)
  }, [hydrate, user])

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    setProfileErrors(validateProfile(profile))
  }, [profile])

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [])

  const displayName = getDisplayName(user)

  const saveLabel = useMemo(() => {
    if (Object.keys(profileErrors).length > 0) return "Needs attention"
    if (saveState === "saving") return "Syncing..."
    if (saveState === "saved") return "Saved"
    return "All changes saved locally"
  }, [profileErrors, saveState])

  const saveTone = useMemo(() => {
    if (Object.keys(profileErrors).length > 0) return "border-rose-200 bg-rose-50 text-rose-700"
    if (saveState === "saving") return "border-amber-200 bg-amber-50 text-amber-700"
    if (saveState === "saved") return "border-emerald-200 bg-emerald-50 text-emerald-700"
    return "border-slate-200 bg-white text-slate-600 dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)] dark:text-[var(--text-secondary)]"
  }, [profileErrors, saveState])

  const updateTab = (tab: SettingsTab) => {
    const next = new URLSearchParams(searchParams.toString())
    next.set("tab", tab)
    router.replace(`${pathname}?${next.toString()}`)
    setActiveTab(tab)
  }

  const commit = (action: () => void, successMessage?: string) => {
    action()
    setSaveState("saving")
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      setSaveState("saved")
      if (successMessage) toast.success(successMessage)
      saveTimer.current = window.setTimeout(() => setSaveState("idle"), 1400)
    }, 420)
  }

  const handleProfileField = (field: keyof typeof profile, value: string, successMessage?: string) => {
    commit(() => patchProfile({ [field]: value } as Partial<typeof profile>), successMessage)
  }

  const handleAvatarUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => handleProfileField("avatar_url", String(reader.result ?? ""), "Avatar updated")
    reader.readAsDataURL(file)
  }

  const handlePasswordSave = () => {
    if (!passwordDraft.current || !passwordDraft.next || !passwordDraft.confirm) return setPasswordError("Complete all password fields.")
    if (passwordDraft.next.length < 8) return setPasswordError("New password must be at least 8 characters.")
    if (passwordDraft.next !== passwordDraft.confirm) return setPasswordError("Passwords do not match.")
    setPasswordError(null)
    setPasswordState("saving")
    window.setTimeout(() => {
      setPasswordState("saved")
      toast.success("Password update queued")
      window.setTimeout(() => setPasswordState("idle"), 1200)
    }, 600)
  }

  const sessionCards = [
    { label: "Current session", detail: "Chrome on Windows • Kolkata", status: "Active now" },
    { label: "Previous login", detail: "Safari on iPhone • Yesterday", status: "Trusted" },
  ]

  return (
    <div className="space-y-8 pb-8">
      <PageHeader
        eyebrow="Settings"
        title="High-trust control center"
        subtitle="Update identity, workspace defaults, and security posture with clear feedback and structured controls."
        actions={<div className={cn("rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm transition xl:ml-auto", saveTone)}>{saveLabel}</div>}
      >
        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full gap-2 rounded-[24px] border border-slate-200/80 bg-white/70 p-2 shadow-inner dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)]">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.value
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => updateTab(tab.value)}
                  className={cn(
                    "min-w-[170px] flex-1 rounded-[18px] border px-4 py-3 text-left transition-all duration-150",
                    active
                      ? "border-emerald-300 bg-white shadow-[0_18px_40px_-28px_rgba(16,185,129,0.8)] dark:border-[var(--brand-accent)] dark:bg-[var(--card-hover)] dark:text-[var(--text-primary)] dark:shadow-[0_0_20px_rgba(74,222,128,0.15)]"
                      : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white/80 hover:text-slate-900 dark:text-[var(--text-secondary)] dark:hover:border-[var(--border-color)] dark:hover:bg-[var(--card-hover)] dark:hover:text-[var(--text-primary)]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("rounded-full p-2", active ? "bg-emerald-50 text-emerald-700 dark:bg-[var(--brand-accent-soft)] dark:text-[var(--brand-accent)]" : "bg-slate-100 text-slate-500 dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-secondary)]")}>
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold dark:text-[var(--text-primary)]">{tab.label}</p>
                      <p className="text-xs text-slate-500 dark:text-[var(--text-muted)]">{tab.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </PageHeader>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="space-y-8">
          {activeTab === "profile" ? (
            <>
              <Card className="border-slate-200/80 bg-white/95 shadow-[0_18px_60px_-46px_rgba(15,23,42,0.6)] transition-all duration-200 hover:scale-[1.01] hover:shadow-md dark:border-[var(--border-color)] dark:bg-[var(--card-bg)] dark:hover:bg-[var(--card-hover)]">
                <CardHeader><SectionIntro eyebrow="Profile" title="Profile information" description="These details shape how your identity appears across quizzes, reports, and shared workspaces." /></CardHeader>
                <CardContent className="space-y-6">
                  {!hydrated ? <p className="text-sm text-slate-500 dark:text-[var(--text-muted)]">Loading profile...</p> : null}
                  <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5 text-center shadow-inner dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)]">
                      {profile.avatar_url ? <img src={profile.avatar_url} alt="Profile avatar" className="mx-auto size-24 rounded-full border border-slate-200 object-cover shadow-sm dark:border-[var(--border-color)]" /> : <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-slate-900 text-xl font-semibold text-white dark:bg-[var(--bg-tertiary)] dark:text-[var(--text-primary)]">{getInitials(profile.name, profile.email)}</div>}
                      <p className="mt-4 text-sm font-medium text-slate-900 dark:text-[var(--text-primary)]">{profile.name || displayName}</p>
                      <p className="text-xs text-slate-500 dark:text-[var(--text-secondary)]">{profile.email || "No email set"}</p>
                      <Button variant="outline" className="mt-4 w-full" onClick={() => avatarInputRef.current?.click()}><Upload className="size-4" />Upload avatar</Button>
                      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-[var(--text-muted)]">PNG or JPG up to 5MB. Upload is local-preview for now.</p>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <Field label="Display name" helper="Used for display across quizzes." error={profileErrors.name}><Input value={profile.name} onChange={(e) => handleProfileField("name", e.target.value)} className={cn("bg-white dark:bg-[var(--bg-secondary)]", profileErrors.name ? "border-rose-300" : "focus-visible:ring-emerald-100 dark:focus-visible:ring-[color:var(--brand-accent)]/35")} /></Field>
                      <Field label="Email address" helper="Primary contact and login identity." error={profileErrors.email}><Input value={profile.email} onChange={(e) => handleProfileField("email", e.target.value)} className={cn("bg-white dark:bg-[var(--bg-secondary)]", profileErrors.email ? "border-rose-300" : "focus-visible:ring-emerald-100 dark:focus-visible:ring-[color:var(--brand-accent)]/35")} /></Field>
                      <Field label="Institution" helper="Displayed on exports and shared exam assets." error={profileErrors.institution}><Input value={profile.institution} onChange={(e) => handleProfileField("institution", e.target.value)} className={cn("bg-white dark:bg-[var(--bg-secondary)]", profileErrors.institution ? "border-rose-300" : "focus-visible:ring-emerald-100 dark:focus-visible:ring-[color:var(--brand-accent)]/35")} /></Field>
                      <Field label="Timezone" helper="Used for scheduling and time-based alerts." error={profileErrors.timezone}><Input value={profile.timezone} onChange={(e) => handleProfileField("timezone", e.target.value)} className={cn("bg-white dark:bg-[var(--bg-secondary)]", profileErrors.timezone ? "border-rose-300" : "focus-visible:ring-emerald-100 dark:focus-visible:ring-[color:var(--brand-accent)]/35")} /></Field>
                      <div className="md:col-span-2"><Field label="Avatar URL" helper="Optional direct image URL if you prefer linking to a hosted avatar."><Input value={profile.avatar_url} onChange={(e) => handleProfileField("avatar_url", e.target.value)} className="bg-white focus-visible:ring-emerald-100 dark:bg-[var(--bg-secondary)] dark:focus-visible:ring-[color:var(--brand-accent)]/35" /></Field></div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)]">
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-[var(--text-secondary)]">{Object.keys(profileErrors).length > 0 ? <AlertCircle className="size-4 text-rose-500" /> : <CheckCircle2 className="size-4 text-emerald-600 dark:text-[var(--brand-accent)]" />}<span>{Object.keys(profileErrors).length > 0 ? "Resolve the highlighted fields to keep your profile trustworthy." : "Profile details are valid and syncing locally."}</span></div>
                    <Button onClick={() => handleProfileField("name", displayName, "Profile refreshed")}>Use account display name</Button>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-200/80 bg-white/95 shadow-[0_18px_60px_-46px_rgba(15,23,42,0.6)] dark:border-[var(--border-color)] dark:bg-[var(--card-bg)]">
                <CardHeader><SectionIntro title="Account details" description="Keep your most important identity signals visible and easy to verify." /></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  {[
                    { label: "Account role", value: user?.role ?? "Educator" },
                    { label: "Account status", value: user?.is_active === false ? "Restricted" : "Active" },
                    { label: "Team visibility", value: "Private workspace" },
                  ].map((item) => <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)]"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-[var(--text-muted)]">{item.label}</p><p className="mt-2 text-lg font-semibold text-slate-900 dark:text-[var(--text-primary)]">{item.value}</p></div>)}
                </CardContent>
              </Card>
            </>
          ) : null}

          {activeTab === "preferences" ? (
            <Card className="border-slate-200/80 bg-white/95 shadow-[0_18px_60px_-46px_rgba(15,23,42,0.6)] dark:border-[var(--border-color)] dark:bg-[var(--card-bg)]">
              <CardHeader><SectionIntro eyebrow="Preferences" title="Appearance and comfort" description="Tune the interface with clear toggle-style controls instead of generic dropdowns." /></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3"><p className="text-sm font-medium text-slate-900 dark:text-[var(--text-primary)]">Theme</p><div className="flex flex-wrap gap-2">{["light", "dark", "system"].map((value) => <ChoicePill key={value} active={preferences.theme === value} label={value[0].toUpperCase() + value.slice(1)} onClick={() => commit(() => { patchPreferences({ theme: value as "light" | "dark" | "system" }); setTheme(value) }, "Theme preference updated")} />)}</div><p className="text-xs text-slate-500 dark:text-[var(--text-muted)]">Choose how the interface responds to light and dark environments.</p></div>
                <Separator />
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3"><p className="text-sm font-medium text-slate-900 dark:text-[var(--text-primary)]">Density</p><div className="flex flex-wrap gap-2">{[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }].map((option) => <ChoicePill key={option.value} active={preferences.density === option.value} label={option.label} onClick={() => commit(() => patchPreferences({ density: option.value as "comfortable" | "compact" }), "Density updated")} />)}</div></div>
                  <div className="space-y-3"><p className="text-sm font-medium text-slate-900 dark:text-[var(--text-primary)]">Font scale</p><div className="flex flex-wrap gap-2">{[{ value: "small", label: "Small" }, { value: "normal", label: "Normal" }, { value: "large", label: "Large" }].map((option) => <ChoicePill key={option.value} active={preferences.font_scale === option.value} label={option.label} onClick={() => commit(() => patchPreferences({ font_scale: option.value as "small" | "normal" | "large" }), "Font scale updated")} />)}</div></div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeTab === "workspace" ? (
            <div className="space-y-8">
              <Card className="border-slate-200/80 bg-white/95 shadow-[0_18px_60px_-46px_rgba(15,23,42,0.6)] dark:border-[var(--border-color)] dark:bg-[var(--card-bg)]">
                <CardHeader><SectionIntro eyebrow="Workspace" title="Publishing and review controls" description="Define safe defaults for quiz creation, warnings, and review behavior." /></CardHeader>
                <CardContent className="space-y-4">
                  <ToggleRow title="Strict publishing checks" description="Require complete validation before any quiz can be published." checked={workspace.strict_publish_checks} onCheckedChange={(checked) => commit(() => patchWorkspace({ strict_publish_checks: checked }), "Publishing rules updated")} />
                  <ToggleRow title="AI generation safety mode" description="Keep stricter schema enforcement and guardrails active while generating quizzes." checked={workspace.ai_safety_mode} onCheckedChange={(checked) => commit(() => patchWorkspace({ ai_safety_mode: checked }), "AI safety mode updated")} />
                  <ToggleRow title="Auto-save review edits" description="Persist question edits automatically while reviewing content." checked={workspace.autosave_review} onCheckedChange={(checked) => commit(() => patchWorkspace({ autosave_review: checked }), "Review auto-save updated")} />
                </CardContent>
              </Card>
              <Card className="border-slate-200/80 bg-white/95 shadow-[0_18px_60px_-46px_rgba(15,23,42,0.6)] dark:border-[var(--border-color)] dark:bg-[var(--card-bg)]">
                <CardHeader><SectionIntro title="Default values" description="Use sensible defaults to reduce repetitive setup during quiz creation." /></CardHeader>
                <CardContent className="grid gap-5 md:grid-cols-3">
                  <Field label="Default marks" helper="Applied as the starting mark value for new questions."><Input type="number" min={1} value={workspace.default_marks} onChange={(e) => commit(() => patchWorkspace({ default_marks: Math.max(1, Number(e.target.value || 1)) }))} className="bg-white dark:bg-[var(--bg-secondary)]" /></Field>
                  <Field label="Default quiz duration" helper="Minutes used when starting a new quiz flow."><Input type="number" min={5} value={workspace.default_quiz_duration_minutes} onChange={(e) => commit(() => patchWorkspace({ default_quiz_duration_minutes: Math.max(5, Number(e.target.value || 60)) }))} className="bg-white dark:bg-[var(--bg-secondary)]" /></Field>
                  <Field label="Warning threshold" helper="Minutes remaining before warning alerts should trigger."><Input type="number" min={1} value={workspace.default_warning_threshold_minutes} onChange={(e) => commit(() => patchWorkspace({ default_warning_threshold_minutes: Math.max(1, Number(e.target.value || 5)) }))} className="bg-white dark:bg-[var(--bg-secondary)]" /></Field>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {activeTab === "security" ? (
            <div className="space-y-8">
              <Card className="border-slate-200/80 bg-white/95 shadow-[0_18px_60px_-46px_rgba(15,23,42,0.6)] dark:border-[var(--border-color)] dark:bg-[var(--card-bg)]">
                <CardHeader><SectionIntro eyebrow="Security" title="Password and account protection" description="Reinforce access controls and make authentication changes with immediate feedback." /></CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-5 md:grid-cols-3">
                    <Field label="Current password" helper="Required before replacing your password."><Input type="password" value={passwordDraft.current} onChange={(e) => setPasswordDraft((current) => ({ ...current, current: e.target.value }))} className="bg-white dark:bg-[var(--bg-secondary)]" /></Field>
                    <Field label="New password" helper="Use at least 8 characters for stronger protection."><Input type="password" value={passwordDraft.next} onChange={(e) => setPasswordDraft((current) => ({ ...current, next: e.target.value }))} className="bg-white dark:bg-[var(--bg-secondary)]" /></Field>
                    <Field label="Confirm password" helper={passwordError ?? "Repeat the new password exactly."} error={passwordError ?? undefined}><Input type="password" value={passwordDraft.confirm} onChange={(e) => setPasswordDraft((current) => ({ ...current, confirm: e.target.value }))} className={cn("bg-white dark:bg-[var(--bg-secondary)]", passwordError ? "border-rose-300" : "")} /></Field>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={handlePasswordSave} disabled={passwordState === "saving"}><KeyRound className="size-4" />{passwordState === "saving" ? "Updating..." : passwordState === "saved" ? "Updated" : "Change password"}</Button>
                    <p className="text-sm text-slate-500 dark:text-[var(--text-muted)]">Password changes are prepared here and ready for backend wiring.</p>
                  </div>
                  <ToggleRow title="Two-factor authentication" description="Future-ready MFA control to add a second verification step during sign-in." checked={security.two_factor_enabled} onCheckedChange={(checked) => commit(() => patchSecurity({ two_factor_enabled: checked }), "Two-factor preference updated")} />
                </CardContent>
              </Card>
              <Card className="border-slate-200/80 bg-white/95 shadow-[0_18px_60px_-46px_rgba(15,23,42,0.6)] dark:border-[var(--border-color)] dark:bg-[var(--card-bg)]">
                <CardHeader><SectionIntro title="Login sessions" description="Review where your account is active and clear access when needed." /></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">{sessionCards.map((session) => <div key={session.label} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)]"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-slate-900 dark:text-[var(--text-primary)]">{session.label}</p><p className="mt-1 text-sm text-slate-500 dark:text-[var(--text-secondary)]">{session.detail}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-[var(--brand-accent-soft)] dark:text-[var(--brand-accent)]">{session.status}</span></div></div>)}</div>
                  <div className="flex flex-wrap gap-3"><Button variant="outline">View active sessions</Button><Button variant="outline" onClick={() => void logout().then(() => router.replace("/login"))}>Logout from all sessions</Button></div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {activeTab === "notifications" ? (
            <Card className="border-slate-200/80 bg-white/95 shadow-[0_18px_60px_-46px_rgba(15,23,42,0.6)] dark:border-[var(--border-color)] dark:bg-[var(--card-bg)]">
              <CardHeader><SectionIntro eyebrow="Notifications" title="Alert routing" description="Decide which product events deserve attention and keep the signal-to-noise ratio under control." /></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "attempts_email", title: "New attempt notifications", description: "Receive email alerts when students start a new attempt." },
                  { key: "integrity_alerts", title: "Integrity alerts", description: "Get notified when violations or suspicious activity increase." },
                  { key: "generation_complete", title: "Generation complete", description: "Be alerted when AI quiz generation finishes." },
                  { key: "export_complete", title: "Export completion", description: "Receive updates when result exports are ready to download." },
                ].map((item) => <ToggleRow key={item.key} title={item.title} description={item.description} checked={Boolean(notifications[item.key as keyof typeof notifications])} onCheckedChange={(checked) => commit(() => patchNotifications({ [item.key]: checked } as Partial<typeof notifications>), "Notification preference updated")} />)}
              </CardContent>
            </Card>
          ) : null}

          {activeTab === "integrations" ? (
            <div className="grid gap-5 md:grid-cols-2">
              {[
                { title: "Google Classroom", description: "Sync rosters and assignment context once the classroom bridge is enabled.", badge: "Planned" },
                { title: "Slack notifications", description: "Route quiz alerts and publishing updates directly into your teaching channels.", badge: "Beta-ready" },
                { title: "Webhook integrations", description: "Push attempt and result events into your own systems with signed payloads.", badge: "Coming soon" },
                { title: "API keys", description: "Manage future programmatic access for exports, automation, and reporting pipelines.", badge: "Future-ready" },
              ].map((item) => <Card key={item.title} className="border-slate-200/80 bg-white/95 shadow-[0_18px_60px_-46px_rgba(15,23,42,0.6)] dark:border-[var(--border-color)] dark:bg-[var(--card-bg)]"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg text-slate-950 dark:text-[var(--text-primary)]">{item.title}</CardTitle><CardDescription className="mt-2 leading-6 dark:text-[var(--text-secondary)]">{item.description}</CardDescription></div><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)] dark:text-[var(--text-secondary)]">{item.badge}</span></div></CardHeader><CardContent><Button variant="outline" className="w-full">Request access</Button></CardContent></Card>)}
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
