import type { User } from "@/types/user"
import { clearAccessToken, getAccessToken, setAccessToken } from "./token"

export type DecodedAccessToken = {
  sub?: string
  sid?: string
  email?: string
  role?: string | null
  name?: string
  onboarding_completed?: boolean
  exp?: number
}

export function decodeJwt<T>(token: string): T | null {
  try {
    const [, payload] = token.split(".")
    if (!payload) return null
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=")
    const decoded = window.atob(padded)
    return JSON.parse(decoded) as T
  } catch {
    return null
  }
}

export function storeAccessToken(token: string | null | undefined): boolean {
  const trimmed = token?.trim()
  if (!trimmed) return false
  setAccessToken(trimmed)
  return true
}

export function clearAuthSession(): void {
  clearAccessToken()
}

export function getDecodedAccessToken(): DecodedAccessToken | null {
  const token = getAccessToken()
  if (!token) return null
  return decodeJwt<DecodedAccessToken>(token)
}

export function normalizeAppRole(role: string | null | undefined): "student" | "teacher" | "admin" | "staff" | null {
  const value = role?.trim().toLowerCase()
  if (!value) return null
  if (value === "student" || value === "teacher" || value === "admin" || value === "staff") return value
  return null
}

export function getPostAuthRoute(user: Pick<User, "role" | "onboarding_completed"> | null | undefined): string {
  const normalizedRole = normalizeAppRole(user?.role)
  if (!normalizedRole || !user?.onboarding_completed) return "/onboarding"
  if (normalizedRole === "student") return "/student/dashboard"
  return "/teacher/dashboard"
}
