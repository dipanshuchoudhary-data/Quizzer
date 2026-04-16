"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { getPostAuthRoute, normalizeAppRole } from "@/lib/auth"
import { useAuthStore } from "@/stores/useAuthStore"

const AUTH_ROUTES = new Set(["/login", "/signup"])
const PUBLIC_ROUTES = new Set(["/privacy", "/terms", "/auth/success", "/onboarding"])
const PUBLIC_PREFIXES = ["/exam", "/verify-email"]
const STUDENT_ALLOWED_PREFIXES = ["/student", "/account", "/help", "/exam"]
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isPublicQuizRoute = (pathname: string) => {
  if (!pathname.startsWith("/quiz/")) return false
  const slug = pathname.replace("/quiz/", "").split("/")[0]
  return Boolean(slug) && !UUID_REGEX.test(slug)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const redirectTargetRef = useRef<string | null>(null)
  const bootstrapRan = useRef(false)
  const bootstrap = useAuthStore((state) => state.bootstrap)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoading = useAuthStore((state) => state.isLoading)
  const user = useAuthStore((state) => state.user)
  // Track user identity by id to avoid re-running effects on object reference changes
  const userId = user?.id
  const userRole = user?.role
  const userOnboardingCompleted = user?.onboarding_completed

  useEffect(() => {
    if (bootstrapRan.current) return
    bootstrapRan.current = true
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    redirectTargetRef.current = null
  }, [pathname])

  useEffect(() => {
    if (isLoading) return

    const replaceOnce = (target: string) => {
      if (pathname === target) return
      if (redirectTargetRef.current === target) return
      redirectTargetRef.current = target
      router.replace(target)
    }

    const isPublic =
      AUTH_ROUTES.has(pathname) ||
      PUBLIC_ROUTES.has(pathname) ||
      PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
      isPublicQuizRoute(pathname)
    if (!isAuthenticated && !isPublic) {
      replaceOnce("/login")
      return
    }

    if (!isAuthenticated) return

    const normalizedRole = normalizeAppRole(userRole)
    const destination = getPostAuthRoute(user)

    if (destination === "/onboarding" && pathname !== "/onboarding") {
      replaceOnce("/onboarding")
      return
    }

    if (destination !== "/onboarding" && (pathname === "/onboarding" || pathname === "/auth/success")) {
      replaceOnce(destination)
      return
    }

    if (pathname === "/login" || pathname === "/signup") {
      replaceOnce(destination)
      return
    }

    if (normalizedRole === "student" && !STUDENT_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      replaceOnce("/student/dashboard")
      return
    }

    if ((normalizedRole === "teacher" || normalizedRole === "admin" || normalizedRole === "staff") && pathname.startsWith("/student/")) {
      replaceOnce("/teacher/dashboard")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading, pathname, router, userId, userRole, userOnboardingCompleted])

  if (isLoading && !AUTH_ROUTES.has(pathname) && !PUBLIC_ROUTES.has(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading workspace...
      </div>
    )
  }

  return <>{children}</>
}
