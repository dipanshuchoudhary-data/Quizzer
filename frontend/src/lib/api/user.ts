import { api } from "@/lib/api/client"
import type { User } from "@/types/user"
import { clearAccessToken, setAccessToken } from "@/lib/auth"

type LoginResponse = {
  access_token?: string
  token_type?: string
  success?: boolean
}

export const userApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>(
      "/auth/login",
      { email, password },
      { skipAuth: true } as never
    )

    if (data.access_token) {
      setAccessToken(data.access_token)
    } else if (data.success) {
      setAccessToken("cookie-session")
    }

    return data
  },

  async me(): Promise<User> {
    const { data } = await api.get<User>("/auth/me")
    return data
  },

  async logout(): Promise<void> {
    try {
      await api.post("/auth/logout")
    } finally {
      clearAccessToken()
    }
  },
}
