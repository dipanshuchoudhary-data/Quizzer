import axios from "axios"
import { env } from "@/lib/env"
import { clearAccessToken, getAccessToken } from "@/lib/auth"

type ApiRequestConfig = {
  skipAuth?: boolean
  headers?: Record<string, string>
}

export const api = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const nextConfig = config as typeof config & ApiRequestConfig

  if (nextConfig.skipAuth) return config

  const token = getAccessToken()
  if (token) {
    const headers = nextConfig.headers as { set?: (key: string, value: string) => void; Authorization?: string } | undefined
    if (headers?.set) headers.set("Authorization", `Bearer ${token}`)
    else (nextConfig.headers as Record<string, string>) = { Authorization: `Bearer ${token}` }
  }

  return nextConfig
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearAccessToken()

      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login"
      }
    }

    return Promise.reject(error)
  }
)
