import { create } from "zustand"
import type { User } from "@/types/user"

type ThemeMode = "light" | "dark" | "system"
type DensityMode = "comfortable" | "compact"
type FontScale = "small" | "normal" | "large"
type SaveState = "idle" | "saving" | "saved"

type ProfileState = {
  name: string
  email: string
  avatar_url: string
  institution: string
  timezone: string
}

type PreferenceState = {
  theme: ThemeMode
  density: DensityMode
  font_scale: FontScale
}

type NotificationState = {
  attempts_email: boolean
  integrity_alerts: boolean
  generation_complete: boolean
  export_complete: boolean
}

type WorkspaceState = {
  strict_publish_checks: boolean
  ai_safety_mode: boolean
  autosave_review: boolean
  default_marks: number
  default_quiz_duration_minutes: number
  default_warning_threshold_minutes: number
}

type SecurityState = {
  two_factor_enabled: boolean
}

interface AccountSettingsState {
  hydrated: boolean
  saveState: SaveState
  profile: ProfileState
  preferences: PreferenceState
  notifications: NotificationState
  workspace: WorkspaceState
  security: SecurityState

  hydrate: (user?: User | string | null) => void
  setSaveState: (saveState: SaveState) => void

  patchProfile: (patch: Partial<ProfileState>) => void
  patchPreferences: (patch: Partial<PreferenceState>) => void
  patchNotifications: (patch: Partial<NotificationState>) => void
  patchWorkspace: (patch: Partial<WorkspaceState>) => void
  patchSecurity: (patch: Partial<SecurityState>) => void
}

const STORAGE_KEY = "quizzer_account_settings"

const defaults = {
  hydrated: false,
  saveState: "idle" as SaveState,

  profile: {
    name: "Professor",
    email: "",
    avatar_url: "",
    institution: "",
    timezone: "Asia/Kolkata",
  },

  preferences: {
    theme: "system" as ThemeMode,
    density: "comfortable" as DensityMode,
    font_scale: "normal" as FontScale,
  },

  notifications: {
    attempts_email: true,
    integrity_alerts: true,
    generation_complete: true,
    export_complete: true,
  },

  workspace: {
    strict_publish_checks: true,
    ai_safety_mode: true,
    autosave_review: true,
    default_marks: 2,
    default_quiz_duration_minutes: 60,
    default_warning_threshold_minutes: 5,
  },

  security: {
    two_factor_enabled: false,
  },
}

function safeParse(raw: string | null) {
  if (!raw) return null
  try {
    return JSON.parse(raw) as Partial<AccountSettingsState>
  } catch {
    return null
  }
}

function saveSnapshot(getState: () => AccountSettingsState) {
  if (typeof window === "undefined") return

  const state = getState()

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      profile: state.profile,
      preferences: state.preferences,
      notifications: state.notifications,
      workspace: state.workspace,
      security: state.security,
    })
  )
}

export const useAccountSettingsStore = create<AccountSettingsState>((set, get) => ({
  ...defaults,

  hydrate: (user) => {
    if (typeof window === "undefined") {
      set({ hydrated: true })
      return
    }

    const parsed = safeParse(window.localStorage.getItem(STORAGE_KEY))

    const email = typeof user === "string" ? user : user?.email ?? ""
    const derivedName = user && typeof user !== "string"
      ? user.full_name?.trim() || user.username?.trim() || defaults.profile.name
      : defaults.profile.name

    set({
      hydrated: true,

      profile: {
        ...defaults.profile,
        name: derivedName,
        email,
        ...(parsed?.profile ?? {}),
      },

      preferences: {
        ...defaults.preferences,
        ...(parsed?.preferences ?? {}),
      },

      notifications: {
        ...defaults.notifications,
        ...(parsed?.notifications ?? {}),
      },

      workspace: {
        ...defaults.workspace,
        ...(parsed?.workspace ?? {}),
      },

      security: {
        ...defaults.security,
        ...(parsed?.security ?? {}),
      },
    })
  },

  setSaveState: (saveState) => set({ saveState }),

  patchProfile: (patch) => {
    set((state) => ({
      profile: { ...state.profile, ...patch },
    }))
    saveSnapshot(get)
  },

  patchPreferences: (patch) => {
    set((state) => ({
      preferences: { ...state.preferences, ...patch },
    }))
    saveSnapshot(get)
  },

  patchNotifications: (patch) => {
    set((state) => ({
      notifications: { ...state.notifications, ...patch },
    }))
    saveSnapshot(get)
  },

  patchWorkspace: (patch) => {
    set((state) => ({
      workspace: { ...state.workspace, ...patch },
    }))
    saveSnapshot(get)
  },

  patchSecurity: (patch) => {
    set((state) => ({
      security: { ...state.security, ...patch },
    }))
    saveSnapshot(get)
  },
}))
