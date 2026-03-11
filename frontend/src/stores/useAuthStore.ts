import { create } from "zustand"
import { userApi } from "@/lib/api/user"
import type { User } from "@/types/user"

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: User | null) => void
  bootstrap: () => Promise<void>
  login: (email: string, password: string) => Promise<User>
  refreshMe: () => Promise<User>
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
    try {
      const me = await userApi.me()
      set({ user: me, isAuthenticated: true, isLoading: false })
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },

  login: async (email, password) => {
    await userApi.login(email, password)
    const me = await userApi.me()
    set({ user: me, isAuthenticated: true, isLoading: false })
    return me
  },

  refreshMe: async () => {
    const me = await userApi.me()
    set({ user: me, isAuthenticated: true, isLoading: false })
    return me
  },

  logout: async () => {
    await userApi.logout()
    set({ user: null, isAuthenticated: false, isLoading: false })
  },
}))
