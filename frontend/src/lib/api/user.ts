import { api } from "@/lib/api/client"
import type { User } from "@/types/user"

type SessionResponse = { success: boolean; onboarding_completed: boolean }
type PasswordChangePayload = { current_password: string; new_password: string }
export type AuthSession = {
  id: string
  device: string
  ip_address: string
  user_agent?: string | null
  status: "active" | "expired"
  created_at: string
  last_seen_at: string
  expires_at: string
  is_current: boolean
}
type RegisterPayload = {
  full_name: string
  email: string
  password: string
  institution?: string
  country?: string
  timezone?: string
}

type RegisterResponse = {
  message: string
}

type UpdateProfilePayload = Partial<{
  full_name: string
  email: string
  phone_number: string
  institution: string
  country: string
  timezone: string
  subject_area: string
  courses_taught: string
  teaching_experience: string
  avatar_url: string
  onboarding_completed: boolean
}>

type SessionListResponse = {
  sessions: AuthSession[]
}

export const userApi = {
  async register(payload: RegisterPayload): Promise<RegisterResponse> {
    const { data } = await api.post<RegisterResponse>(
      "/auth/register",
      payload,
      { skipAuth: true } as never
    )
    return data
  },

  async login(email: string, password: string): Promise<SessionResponse> {
    const { data } = await api.post<SessionResponse>(
      "/auth/login",
      { email, password },
      { skipAuth: true } as never
    )
    return data
  },

  async me(): Promise<User> {
    const { data } = await api.get<User>("/auth/me")
    return data
  },

  async updateProfile(payload: UpdateProfilePayload): Promise<User> {
    const { data } = await api.patch<User>("/users/profile", payload)
    return data
  },

  async uploadAvatar(file: File): Promise<User> {
    const form = new FormData()
    form.append("file", file)
    const { data } = await api.post<User>("/users/profile/avatar", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
    })
    return data
  },

  async changePassword(payload: PasswordChangePayload): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>("/auth/change-password", payload)
    return data
  },

  async getSessions(): Promise<AuthSession[]> {
    const { data } = await api.get<SessionListResponse>("/auth/sessions")
    return data.sessions
  },

  async logoutAllSessions(): Promise<void> {
    await api.post("/auth/logout-all")
  },

  async logout(): Promise<void> {
    await api.post("/auth/logout")
  },
}
