"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { getPostAuthRoute } from "@/lib/auth"
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
  const bootstrap = useAuthStore((state) => state.bootstrap)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoading = useAuthStore((state) => state.isLoading)
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    if (isLoading) return

    const isPublic =
      AUTH_ROUTES.has(pathname) ||
      PUBLIC_ROUTES.has(pathname) ||
      PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
      isPublicQuizRoute(pathname)
    if (!isAuthenticated && !isPublic) {
      if (pathname !== "/login") router.replace("/login")
      return
    }

    if (!isAuthenticated) return

    const destination = getPostAuthRoute(user)

    if (destination === "/onboarding" && pathname !== "/onboarding") {
      router.replace("/onboarding")
      return
    }

    if (destination !== "/onboarding" && (pathname === "/onboarding" || pathname === "/auth/success")) {
      if (pathname !== destination) router.replace(destination)
      return
    }

    if (pathname === "/login" || pathname === "/signup") {
      if (pathname !== destination) router.replace(destination)
      return
    }

    if (user?.role === "student" && !STUDENT_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      if (pathname !== "/student/dashboard") router.replace("/student/dashboard")
      return
    }

    if ((user?.role === "teacher" || user?.role === "ADMIN" || user?.role === "STAFF") && pathname.startsWith("/student/")) {
      if (pathname !== "/teacher/dashboard") router.replace("/teacher/dashboard")
    }
  }, [isAuthenticated, isLoading, pathname, router, user])

  if (isLoading && !AUTH_ROUTES.has(pathname) && !PUBLIC_ROUTES.has(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading workspace...
      </div>
    )
  }

  return <>{children}</>
}
