import axios from "axios"
import { env } from "@/lib/env"

export const api = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
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
