import axios, { AxiosHeaders } from "axios"
import { env } from "@/lib/env"

export const api = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  if (config.url) {
    config.url = config.url.replace(/([^:]\/)\/+/g, "$1")
  }

  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("access_token") || window.sessionStorage.getItem("access_token")
    if (token && !config.headers?.Authorization) {
      const headers = AxiosHeaders.from(config.headers)
      headers.set("Authorization", `Bearer ${token}`)
      config.headers = headers
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
        const publicRoutes = new Set(["/login", "/signup"])
        if (!publicRoutes.has(window.location.pathname)) {
          window.location.href = "/login"
        }
      }
    }

    return Promise.reject(error)
  }
)
