"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react"
import Image from "next/image"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import {
  AlertCircle,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Paintbrush2,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Upload,
  UserRound,
  Sparkles,
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
import { getApiErrorMessage } from "@/lib/api/error"
import { userApi, type AuthSession } from "@/lib/api/user"
import { compressAvatar } from "@/lib/images/avatar"

const tabs = [
  { value: "profile", label: "Profile", icon: UserRound, description: "Identity and account details" },
  { value: "preferences", label: "Preferences", icon: Paintbrush2, description: "Appearance and experience" },
  { value: "workspace", label: "Workspace", icon: BriefcaseBusiness, description: "Publishing and review defaults" },
  { value: "security", label: "Security", icon: ShieldCheck, description: "Password and session control" },
  { value: "notifications", label: "Notifications", icon: Bell, description: "Alerts and delivery rules" },
  { value: "integrations", label: "Integrations", icon: PlugZap, description: "Connected tools and access" },
] as const

type SettingsTab = (typeof tabs)[number]["value"]
type ProfileErrors = Partial<Record<"name" | "email" | "institution" | "country" | "timezone", string>>

function isSettingsTab(value: string | null): value is SettingsTab {
  return Boolean(value) && tabs.some((tab) => tab.value === value)
}

function SectionIntro({ eyebrow, title, description }: { eyebrow?: string; title: string; description: string }) {
  return (
    <div className="space-y-1">
      {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-accent)]">{eyebrow}</p> : null}
      <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">{title}</h2>
      <p className="text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
    </div>
  )
}

function Field({ label, helper, error, children }: { label: string; helper: string; error?: string; children: ReactNode }) {
  return (
    <label className="space-y-2">
      <div>
        <p className="text-sm font-bold text-[var(--text-primary)]">{label}</p>
        <p className={cn("mt-1 text-xs leading-5", error ? "text-rose-500 font-medium" : "text-[var(--text-muted)]")}>{error ?? helper}</p>
      </div>
      {children}
    </label>
  )
}

function ToggleRow({ title, description, checked, onCheckedChange, disabled = false }: { title: string; description: string; checked: boolean; onCheckedChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-bold text-[var(--text-primary)]">{title}</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )
}

function ChoicePill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-bold transition-all duration-200",
        active
          ? "border-[var(--brand-accent)] bg-[var(--brand-accent)] text-[var(--bg-primary)] shadow-lg shadow-[var(--brand-accent)]/10"
          : "border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:border-[var(--brand-accent)]/30 hover:text-[var(--text-primary)]"
      )}
    >
      {label}
    </button>
  )
}

function PasswordField({ label, helper, value, onChange, error, visible, onToggle }: { label: string; helper: string; value: string; onChange: (value: string) => void; error?: string; visible: boolean; onToggle: () => void }) {
  return (
    <Field label={label} helper={helper} error={error}>
      <div className="relative">
        <Input type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} className={cn("bg-[var(--bg-tertiary)] pr-10 border-[var(--border-color)] text-[var(--text-primary)] focus-visible:ring-[var(--brand-accent)]/30", error ? "border-rose-500/50" : "")} />
        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-label={visible ? "Hide password" : "Show password"} onClick={onToggle}>
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </Field>
  )
}

function getInitials(name: string, email: string) {
  const source = name.trim() || email.trim() || "Q"
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("")
}

function validateProfile(profile: { name: string; email: string; institution: string; country: string; timezone: string }): ProfileErrors {
  const errors: ProfileErrors = {}
  if (!profile.name.trim()) errors.name = "Display name is required."
  if (!profile.email.trim()) errors.email = "Email is required."
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) errors.email = "Enter a valid email address."
  if (!profile.institution.trim()) errors.institution = "Institution or organization is required."
  if (!profile.country.trim()) errors.country = "Country is required."
  if (!profile.timezone.trim()) errors.timezone = "Timezone is required."
  return errors
}

function formatSessionTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

export function AccountSettingsWorkspace() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { setTheme } = useTheme()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const setUser = useAuthStore((s) => s.setUser)
  const { hydrated, saveState, profile, preferences, notifications, workspace, hydrate, setSaveState, patchProfile, patchPreferences, patchNotifications, patchWorkspace } = useAccountSettingsStore()

  const saveTimer = useRef<number | null>(null)
  const profileSaveTimer = useRef<number | null>(null)
  const profileRequestId = useRef(0)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const hydratedUserId = useRef<string | null>(null)
  const routeTab = searchParams.get("tab")
  const initialTab: SettingsTab = isSettingsTab(routeTab) ? routeTab : "profile"
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({})
  const [passwordDraft, setPasswordDraft] = useState({ current: "", next: "", confirm: "" })
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordState, setPasswordState] = useState<"idle" | "saving" | "saved">("idle")
  const [showPasswords, setShowPasswords] = useState({ current: false, next: false, confirm: false })
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [sessions, setSessions] = useState<AuthSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [showSessionDetails, setShowSessionDetails] = useState(false)

  useEffect(() => {
    const id = user?.id ?? null
    if (id === hydratedUserId.current) return
    hydratedUserId.current = id
    hydrate(user)
  }, [hydrate, user])
  useEffect(() => { setActiveTab(initialTab) }, [initialTab])
  useEffect(() => { setProfileErrors(validateProfile(profile)) }, [profile])
  useEffect(() => () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    if (profileSaveTimer.current) window.clearTimeout(profileSaveTimer.current)
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
  }, [avatarPreviewUrl])

  const displayName = getDisplayName(user)
  const saveLabel = useMemo(() => Object.keys(profileErrors).length > 0 ? "Needs attention" : saveState === "saving" ? "Syncing..." : saveState === "saved" ? "Saved" : "All changes saved", [profileErrors, saveState])
  const saveTone = useMemo(() => Object.keys(profileErrors).length > 0 ? "border-rose-500/30 bg-rose-500/10 text-rose-500" : saveState === "saving" ? "border-amber-500/30 bg-amber-500/10 text-amber-500" : saveState === "saved" ? "border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]" : "border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]", [profileErrors, saveState])

  const updateTab = (tab: SettingsTab) => {
    const next = new URLSearchParams(searchParams.toString())
    next.set("tab", tab)
    router.replace(`${pathname}?${next.toString()}`)
    setActiveTab(tab)
  }

  const syncUserState = (updatedUser: typeof user) => {
    setUser(updatedUser)
    hydrate(updatedUser)
  }

  const persistProfile = async (nextProfile: typeof profile, successMessage = "Profile updated") => {
    const requestId = ++profileRequestId.current
    setSaveState("saving")

    const payload = {
      full_name: nextProfile.name.trim(),
      email: nextProfile.email.trim(),
      institution: nextProfile.institution.trim(),
      country: nextProfile.country.trim(),
      timezone: nextProfile.timezone.trim(),
      avatar_url: nextProfile.avatar_url.trim(),
    }

    try {
      const updatedUser = await userApi.updateProfile(payload)
      if (requestId !== profileRequestId.current) return
      syncUserState(updatedUser)
      setSaveState("saved")
      toast.success(successMessage)
      window.setTimeout(() => setSaveState("idle"), 1400)
    } catch (error) {
      if (requestId !== profileRequestId.current) return
      if (user) hydrate(user)
      setSaveState("idle")
      toast.error(getApiErrorMessage(error, "Failed to update profile"))
    }
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
    const nextProfile = { ...profile, [field]: value }
    patchProfile({ [field]: value } as Partial<typeof profile>)

    if (profileSaveTimer.current) window.clearTimeout(profileSaveTimer.current)
    if (Object.keys(validateProfile(nextProfile)).length > 0) {
      setSaveState("idle")
      return
    }
    setSaveState("saving")
    profileSaveTimer.current = window.setTimeout(() => {
      void persistProfile(nextProfile, successMessage ?? "Profile updated")
    }, 500)
  }

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const previewUrl = URL.createObjectURL(file)
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    setAvatarPreviewUrl(previewUrl)
    setAvatarUploading(true)
    setSaveState("saving")

    try {
      const compressedFile = await compressAvatar(file)
      const updatedUser = await userApi.uploadAvatar(compressedFile)
      setAvatarPreviewUrl(null)
      syncUserState(updatedUser)
      setSaveState("saved")
      toast.success("Avatar updated")
      window.setTimeout(() => setSaveState("idle"), 1400)
    } catch (error) {
      setAvatarPreviewUrl(null)
      if (user) hydrate(user)
      setSaveState("idle")
      toast.error(getApiErrorMessage(error, "Failed to upload avatar"))
    } finally {
      setAvatarUploading(false)
      event.target.value = ""
    }
  }

  const loadSessions = async () => {
    setSessionsLoading(true)
    try {
      const nextSessions = await userApi.getSessions()
      setSessions(nextSessions)
      setSessionsLoaded(true)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load sessions"))
    } finally {
      setSessionsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab !== "security" || !user || sessionsLoaded || sessionsLoading) return
    void loadSessions()
  }, [activeTab, sessionsLoaded, sessionsLoading, user])

  const handlePasswordSave = async () => {
    if (!passwordDraft.current || !passwordDraft.next || !passwordDraft.confirm) return setPasswordError("Complete all password fields.")
    if (passwordDraft.next.length < 8) return setPasswordError("New password must be at least 8 characters.")
    if (passwordDraft.next !== passwordDraft.confirm) return setPasswordError("Passwords do not match.")

    setPasswordError(null)
    setPasswordState("saving")

    try {
      await userApi.changePassword({ current_password: passwordDraft.current, new_password: passwordDraft.next })
      setPasswordState("saved")
      setPasswordDraft({ current: "", next: "", confirm: "" })
      setUser(null)
      toast.success("Password updated. Please sign in again.")
      router.replace("/login")
    } catch (error) {
      setPasswordState("idle")
      setPasswordError(getApiErrorMessage(error, "Failed to update password"))
    }
  }

  const handleLogoutAllSessions = async () => {
    try {
      await userApi.logoutAllSessions()
      setUser(null)
      toast.success("All sessions ended")
      router.replace("/login")
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to end sessions"))
    }
  }

  const avatarSrc = avatarPreviewUrl || profile.avatar_thumbnail_url || profile.avatar_url
  const currentSession = useMemo(() => sessions.find((session) => session.is_current) ?? null, [sessions])
  const otherActiveSessions = useMemo(() => sessions.filter((session) => !session.is_current && session.status === "active"), [sessions])

  const handleLogoutOtherSessions = async () => {
    try {
      await userApi.logoutOtherSessions()
      toast.success("Logged out from other devices")
      await loadSessions()
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to end other sessions"))
    }
  }

  return (
    <div className="space-y-8 pb-8">
      <PageHeader
        eyebrow="Settings"
        title="High-trust control center"
        subtitle="Update identity, workspace defaults, and security posture with clear feedback and structured controls."
        actions={<div className={cn("rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm transition xl:ml-auto", saveTone)}>{saveLabel}</div>}
      >
        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 p-2 shadow-inner">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.value
              return (
                <button 
                  key={tab.value} 
                  type="button" 
                  onClick={() => updateTab(tab.value)} 
                  className={cn(
                    "min-w-[170px] flex-1 rounded-xl border px-4 py-3 text-left transition-all duration-200", 
                    active 
                      ? "border-[var(--brand-accent)] bg-[var(--bg-secondary)] shadow-lg shadow-[var(--brand-accent)]/10 text-[var(--text-primary)]" 
                      : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("rounded-full p-2", active ? "bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]" : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]")}>
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{tab.label}</p>
                      <p className="text-xs text-[var(--text-muted)]">{tab.description}</p>
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
              <Card className="border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl transition-all duration-200 hover:scale-[1.01] hover:shadow-2xl">
                <CardHeader><SectionIntro eyebrow="Profile" title="Profile information" description="These details shape how your identity appears across quizzes, reports, and shared workspaces." /></CardHeader>
                <CardContent className="space-y-6">
                  {!hydrated ? <p className="text-sm text-[var(--text-muted)]">Loading profile...</p> : null}
                  <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-5 text-center shadow-inner">
                      {avatarSrc ? <Image src={avatarSrc} alt="Profile avatar" width={96} height={96} className="mx-auto size-24 rounded-full border border-[var(--border-color)] object-cover shadow-sm" unoptimized /> : <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-[var(--bg-tertiary)] text-xl font-bold text-[var(--text-primary)] border border-[var(--border-color)]">{getInitials(profile.name, profile.email)}</div>}
                      <p className="mt-4 text-sm font-bold text-[var(--text-primary)]">{profile.name || displayName}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{profile.email || "No email set"}</p>
                      <Button variant="outline" className="mt-4 w-full border-[var(--border-color)] bg-[var(--bg-secondary)]" onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}>{avatarUploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}{avatarUploading ? "Uploading..." : "Upload avatar"}</Button>
                      <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarUpload} />
                      <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">PNG, JPG, or WebP. Images are compressed before upload, resized to 512px max, and stored in Cloudinary.</p>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <Field label="Display name" helper="Used for display across quizzes." error={profileErrors.name}><Input value={profile.name} onChange={(e) => handleProfileField("name", e.target.value)} className={cn("bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)]", profileErrors.name ? "border-rose-500/50" : "focus-visible:ring-[var(--brand-accent)]/30")} /></Field>
                      <Field label="Email address" helper="Primary contact and login identity." error={profileErrors.email}><Input value={profile.email} onChange={(e) => handleProfileField("email", e.target.value)} className={cn("bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)]", profileErrors.email ? "border-rose-500/50" : "focus-visible:ring-[var(--brand-accent)]/30")} /></Field>
                      <Field label="Institution" helper="Displayed on exports and shared exam assets." error={profileErrors.institution}><Input value={profile.institution} onChange={(e) => handleProfileField("institution", e.target.value)} className={cn("bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)]", profileErrors.institution ? "border-rose-500/50" : "focus-visible:ring-[var(--brand-accent)]/30")} /></Field>
                      <Field label="Country" helper="Defaults to India; update it here if your workspace changes." error={profileErrors.country}><Input value={profile.country} onChange={(e) => handleProfileField("country", e.target.value)} className={cn("bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)]", profileErrors.country ? "border-rose-500/50" : "focus-visible:ring-[var(--brand-accent)]/30")} /></Field>
                      <Field label="Timezone" helper="Used for scheduling and time-based alerts." error={profileErrors.timezone}><Input value={profile.timezone} onChange={(e) => handleProfileField("timezone", e.target.value)} className={cn("bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)]", profileErrors.timezone ? "border-rose-500/50" : "focus-visible:ring-[var(--brand-accent)]/30")} /></Field>
                      <div className="md:col-span-2"><Field label="Avatar URL" helper="Optional direct image URL if you prefer linking to a hosted avatar."><Input value={profile.avatar_url} onChange={(e) => handleProfileField("avatar_url", e.target.value)} className="bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)] focus-visible:ring-[var(--brand-accent)]/30" /></Field></div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      {Object.keys(profileErrors).length > 0 ? <AlertCircle className="size-4 text-rose-500" /> : <CheckCircle2 className="size-4 text-[var(--brand-accent)]" />}
                      <span>{Object.keys(profileErrors).length > 0 ? "Resolve the highlighted fields to keep your profile trustworthy." : "Profile details are valid and syncing to your account."}</span>
                    </div>
                    <Button onClick={() => handleProfileField("name", displayName, "Profile refreshed")} variant="outline" className="border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]">Use account display name</Button>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
                <CardHeader><SectionIntro title="Account details" description="Keep your most important identity signals visible and easy to verify." /></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  {[{ label: "Account role", value: user?.role ?? "Educator" }, { label: "Account status", value: user?.is_active === false ? "Restricted" : "Active" }, { label: "Team visibility", value: "Private workspace" }].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-4 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">{item.label}</p>
                      <p className="mt-2 text-lg font-bold text-[var(--text-primary)]">{item.value}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          ) : null}

          {activeTab === "preferences" ? (
            <Card className="border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
              <CardHeader><SectionIntro eyebrow="Preferences" title="Appearance and comfort" description="Tune the interface with clear toggle-style controls instead of generic dropdowns." /></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <p className="text-sm font-bold text-[var(--text-primary)]">Theme</p>
                  <div className="flex flex-wrap gap-2">
                    {["light", "dark", "system"].map((value) => (
                      <ChoicePill 
                        key={value} 
                        active={preferences.theme === value} 
                        label={value[0].toUpperCase() + value.slice(1)} 
                        onClick={() => commit(() => { patchPreferences({ theme: value as "light" | "dark" | "system" }); setTheme(value) }, "Theme preference updated")} 
                      />
                    ))}
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">Choose how the interface responds to light and dark environments.</p>
                </div>
                <Separator className="bg-[var(--border-color)]/50" />
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-sm font-bold text-[var(--text-primary)]">Density</p>
                    <div className="flex flex-wrap gap-2">
                      {[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }].map((option) => (
                        <ChoicePill 
                          key={option.value} 
                          active={preferences.density === option.value} 
                          label={option.label} 
                          onClick={() => commit(() => patchPreferences({ density: option.value as "comfortable" | "compact" }), "Density updated")} 
                        />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-bold text-[var(--text-primary)]">Font scale</p>
                    <div className="flex flex-wrap gap-2">
                      {[{ value: "small", label: "Small" }, { value: "normal", label: "Normal" }, { value: "large", label: "Large" }].map((option) => (
                        <ChoicePill 
                          key={option.value} 
                          active={preferences.font_scale === option.value} 
                          label={option.label} 
                          onClick={() => commit(() => patchPreferences({ font_scale: option.value as "small" | "normal" | "large" }), "Font scale updated")} 
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeTab === "workspace" ? (
            <div className="space-y-8">
              <Card className="border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
                <CardHeader><SectionIntro eyebrow="Workspace" title="Publishing and review controls" description="Define safe defaults for quiz creation, warnings, and review behavior." /></CardHeader>
                <CardContent className="space-y-4">
                  <ToggleRow title="Strict publishing checks" description="Require complete validation before any quiz can be published." checked={workspace.strict_publish_checks} onCheckedChange={(checked) => commit(() => patchWorkspace({ strict_publish_checks: checked }), "Publishing rules updated")} />
                  <ToggleRow title="AI generation safety mode" description="Keep stricter schema enforcement and guardrails active while generating quizzes." checked={workspace.ai_safety_mode} onCheckedChange={(checked) => commit(() => patchWorkspace({ ai_safety_mode: checked }), "AI safety mode updated")} />
                  <ToggleRow title="Auto-save review edits" description="Persist question edits automatically while reviewing content." checked={workspace.autosave_review} onCheckedChange={(checked) => commit(() => patchWorkspace({ autosave_review: checked }), "Review auto-save updated")} />
                </CardContent>
              </Card>
              <Card className="border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
                <CardHeader><SectionIntro title="Default values" description="Use sensible defaults to reduce repetitive setup during quiz creation." /></CardHeader>
                <CardContent className="grid gap-5 md:grid-cols-3">
                  <Field label="Default marks" helper="Applied as the starting mark value for new questions."><Input type="number" min={1} value={workspace.default_marks} onChange={(e) => commit(() => patchWorkspace({ default_marks: Math.max(1, Number(e.target.value || 1)) }))} className="bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)]" /></Field>
                  <Field label="Default quiz duration" helper="Minutes used when starting a new quiz flow."><Input type="number" min={5} value={workspace.default_quiz_duration_minutes} onChange={(e) => commit(() => patchWorkspace({ default_quiz_duration_minutes: Math.max(5, Number(e.target.value || 60)) }))} className="bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)]" /></Field>
                  <Field label="Warning threshold" helper="Minutes remaining before warning alerts should trigger."><Input type="number" min={1} value={workspace.default_warning_threshold_minutes} onChange={(e) => commit(() => patchWorkspace({ default_warning_threshold_minutes: Math.max(1, Number(e.target.value || 5)) }))} className="bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)]" /></Field>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {activeTab === "security" ? (
            <div className="space-y-8">
              <Card className="border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
                <CardHeader><SectionIntro eyebrow="Security" title="Password and account protection" description="Reinforce access controls and make authentication changes with immediate feedback." /></CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-5 md:grid-cols-3">
                    <PasswordField label="Current password" helper="Required before replacing your password." value={passwordDraft.current} onChange={(value) => setPasswordDraft((current) => ({ ...current, current: value }))} visible={showPasswords.current} onToggle={() => setShowPasswords((current) => ({ ...current, current: !current.current }))} />
                    <PasswordField label="New password" helper="Use at least 8 characters for stronger protection." value={passwordDraft.next} onChange={(value) => setPasswordDraft((current) => ({ ...current, next: value }))} visible={showPasswords.next} onToggle={() => setShowPasswords((current) => ({ ...current, next: !current.next }))} />
                    <PasswordField label="Confirm password" helper={passwordError ?? "Repeat the new password exactly."} error={passwordError ?? undefined} value={passwordDraft.confirm} onChange={(value) => setPasswordDraft((current) => ({ ...current, confirm: value }))} visible={showPasswords.confirm} onToggle={() => setShowPasswords((current) => ({ ...current, confirm: !current.confirm }))} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={() => void handlePasswordSave()} disabled={passwordState === "saving"} className="bg-[var(--brand-accent)] text-[var(--bg-primary)] hover:bg-[var(--brand-accent-strong)]">
                      {passwordState === "saving" ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                      {passwordState === "saving" ? "Updating..." : passwordState === "saved" ? "Updated" : "Change password"}
                    </Button>
                    <p className="text-sm text-[var(--text-muted)]">A successful password change invalidates every active session and requires a new login.</p>
                  </div>
                  <ToggleRow title="Two-factor authentication" description="Enrollment is not active in the backend yet, so this control is intentionally read-only." checked={false} onCheckedChange={() => undefined} disabled />
                </CardContent>
              </Card>
              <Card className="border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
                <CardHeader><SectionIntro title="Login sessions" description="Keep session security simple by default and open details only when you need them." /></CardHeader>
                <CardContent className="space-y-4">
                  {sessionsLoading ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-4 text-sm text-[var(--text-secondary)]">
                      <LoaderCircle className="size-4 animate-spin" />
                      Checking active devices...
                    </div>
                  ) : null}
                  {!sessionsLoading ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-4 shadow-sm">
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">This device</p>
                        <p className="mt-2 text-lg font-bold text-[var(--text-primary)]">{currentSession ? "You are logged in on this device" : "Current device status unavailable"}</p>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">{currentSession ? `${currentSession.device} active as of ${formatSessionTime(currentSession.last_seen_at)}` : "Refresh session details to verify the current device."}</p>
                      </div>
                      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-4 shadow-sm">
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">Other devices</p>
                        <p className="mt-2 text-lg font-bold text-[var(--text-primary)]">{otherActiveSessions.length === 0 ? "No other active devices" : `${otherActiveSessions.length} other device${otherActiveSessions.length === 1 ? "" : "s"} active`}</p>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">{otherActiveSessions.length === 0 ? "Your account appears to be active only on this device." : "End those sessions if you no longer trust them."}</p>
                      </div>
                    </div>
                  ) : null}
                  {!sessionsLoading && sessions.length === 0 ? <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-4 text-sm text-[var(--text-secondary)]">Session details are not available yet for this account.</div> : null}
                  {showSessionDetails && sessions.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {sessions.map((session) => (
                        <div key={session.id} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-4 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-[var(--text-primary)]">{session.is_current ? "Current session" : session.device}</p>
                              <p className="mt-1 text-sm text-[var(--text-secondary)]">{session.device} • {session.ip_address}</p>
                              <p className="mt-1 text-xs text-[var(--text-muted)]">Started {formatSessionTime(session.created_at)} • Last seen {formatSessionTime(session.last_seen_at)}</p>
                            </div>
                            <span className={cn(
                              "rounded-full px-2.5 py-1 text-xs font-bold", 
                              session.status === "active" 
                                ? "bg-[var(--brand-accent)]/10 text-[var(--brand-accent)] border border-[var(--brand-accent)]/20" 
                                : "bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-color)]"
                            )}>
                              {session.status === "active" ? (session.is_current ? "Active now" : "Active") : "Expired"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button variant="outline" onClick={() => void loadSessions()} disabled={sessionsLoading} className="border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]"><RefreshCw className={cn("size-4", sessionsLoading ? "animate-spin" : "")} />Refresh sessions</Button>
                    <Button variant="outline" onClick={() => void handleLogoutOtherSessions()} disabled={sessionsLoading || otherActiveSessions.length === 0} className="border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]">Log out from all other devices</Button>
                    <Button variant="outline" onClick={() => setShowSessionDetails((current) => !current)} disabled={sessionsLoading || sessions.length === 0} className="border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]">{showSessionDetails ? "Hide details" : "View details"}</Button>
                    <Button variant="outline" onClick={() => void handleLogoutAllSessions()} className="border-rose-500/30 bg-rose-500/5 text-rose-500 hover:bg-rose-500/10">Logout from all sessions</Button>
                    <Button variant="outline" onClick={() => void logout().then(() => router.replace("/login"))} className="border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]">Logout from this session</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {activeTab === "notifications" ? (
            <Card className="border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
              <CardHeader><SectionIntro eyebrow="Notifications" title="Alert routing" description="Decide which product events deserve attention and keep the signal-to-noise ratio under control." /></CardHeader>
              <CardContent className="space-y-4">
                {[{ key: "attempts_email", title: "New attempt notifications", description: "Receive email alerts when students start a new attempt." }, { key: "integrity_alerts", title: "Integrity alerts", description: "Get notified when violations or suspicious activity increase." }, { key: "generation_complete", title: "Generation complete", description: "Be alerted when AI quiz generation finishes." }, { key: "export_complete", title: "Export completion", description: "Receive updates when result exports are ready to download." }].map((item) => (
                  <ToggleRow key={item.key} title={item.title} description={item.description} checked={Boolean(notifications[item.key as keyof typeof notifications])} onCheckedChange={(checked) => commit(() => patchNotifications({ [item.key]: checked } as Partial<typeof notifications>), "Notification preference updated")} />
                ))}
              </CardContent>
            </Card>
          ) : null}

          {activeTab === "integrations" ? (
            <div className="grid gap-5 md:grid-cols-2">
              {[{ title: "Google Classroom", description: "Sync rosters and assignment context once the classroom bridge is enabled.", badge: "Planned" }, { title: "Slack notifications", description: "Route quiz alerts and publishing updates directly into your teaching channels.", badge: "Beta-ready" }, { title: "Webhook integrations", description: "Push attempt and result events into your own systems with signed payloads.", badge: "Coming soon" }, { title: "API keys", description: "Manage future programmatic access for exports, automation, and reporting pipelines.", badge: "Planned" }].map((item) => (
                <Card key={item.title} className="border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl hover:scale-[1.01] transition-transform">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg font-bold text-[var(--text-primary)]">{item.title}</CardTitle>
                        <CardDescription className="mt-2 leading-6 text-[var(--text-secondary)]">{item.description}</CardDescription>
                      </div>
                      <span className="rounded-full border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2.5 py-1 text-xs font-bold text-[var(--text-secondary)] whitespace-nowrap">{item.badge}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]">Request access</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
