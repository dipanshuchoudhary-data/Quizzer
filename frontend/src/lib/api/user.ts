import { api } from "@/lib/api/client"
import type { User } from "@/types/user"

type SessionResponse = { success: boolean; onboarding_completed: boolean }
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
    const { data } = await api.put<User>("/users/profile", payload)
    return data
  },

  async logout(): Promise<void> {
    await api.post("/auth/logout")
  },
}
