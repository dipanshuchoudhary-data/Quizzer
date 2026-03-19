import axios from "axios"
import { env } from "@/lib/env"

export const api = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("access_token") || window.sessionStorage.getItem("access_token")
    if (token && !config.headers?.Authorization) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      }
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
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
