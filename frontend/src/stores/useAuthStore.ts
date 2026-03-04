import { create } from "zustand"
import { userApi } from "@/lib/api/user"
import { clearAccessToken, hasAccessToken } from "@/lib/auth"
import type { User } from "@/types/user"

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: User | null) => void
  bootstrap: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => {
    set({
      user,
      isAuthenticated: Boolean(user),
      isLoading: false,
    })
  },

  bootstrap: async () => {
    if (!hasAccessToken()) {
      set({ user: null, isAuthenticated: false, isLoading: false })
      return
    }

    try {
      const me = await userApi.me()
      set({ user: me, isAuthenticated: true, isLoading: false })
    } catch {
      clearAccessToken()
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },

  login: async (email, password) => {
    const response = await userApi.login(email, password)

    if (!response.access_token && !response.success) {
      throw new Error("Missing access token")
    }

    const me = await userApi.me()
    set({ user: me, isAuthenticated: true, isLoading: false })
  },

  logout: async () => {
    await userApi.logout()
    set({ user: null, isAuthenticated: false, isLoading: false })
  },
}))

