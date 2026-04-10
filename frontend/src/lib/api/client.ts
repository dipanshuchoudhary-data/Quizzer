import axios from "axios"
import { env } from "@/lib/env"
import { clearAuthSession, getAccessToken } from "@/lib/auth"

export const api = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  if (config.url) {
    config.url = config.url.replace(/([^:]\/)\/+/g, "$1")
  }
  const token = getAccessToken()
  if (token && !(config.headers as Record<string, string> | undefined)?.Authorization) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config as (typeof error.config & { __retryCount?: number }) | undefined
    const shouldRetry =
      !error?.response &&
      config?.method?.toLowerCase() === "get" &&
      (config.__retryCount ?? 0) < 1

    if (shouldRetry && config) {
      config.__retryCount = (config.__retryCount ?? 0) + 1
      await new Promise((resolve) => setTimeout(resolve, 800))
      return api.request(config)
    }

    if (error?.response?.status === 401) {
      if (typeof window !== "undefined") {
        clearAuthSession()
        const publicRoutes = new Set(["/login", "/signup", "/privacy", "/terms", "/auth/success", "/onboarding"])
        if (!publicRoutes.has(window.location.pathname)) {
          window.location.href = "/login"
        }
      }
    }

    return Promise.reject(error)
  }
)
