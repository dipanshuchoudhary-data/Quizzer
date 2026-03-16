"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/useAuthStore"

const AUTH_ROUTES = new Set(["/login", "/signup"])
const PUBLIC_PREFIXES = ["/exam", "/verify-email"]
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isPublicQuizRoute = (pathname: string) => {
  if (!pathname.startsWith("/quiz/")) return false
  const slug = pathname.replace("/quiz/", "").split("/")[0]
  return Boolean(slug) && !UUID_REGEX.test(slug)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { bootstrap, isAuthenticated, isLoading, user } = useAuthStore((state) => state)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    if (isLoading) return

    const isPublic =
      AUTH_ROUTES.has(pathname) ||
      PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
      isPublicQuizRoute(pathname)
    if (!isAuthenticated && !isPublic) {
      router.replace("/login")
      return
    }

    if (!isAuthenticated) return

    if (!user?.onboarding_completed && pathname !== "/onboarding") {
      router.replace("/onboarding")
      return
    }

    if (user?.onboarding_completed && pathname === "/onboarding") {
      router.replace("/dashboard")
      return
    }

    if (pathname === "/login" || pathname === "/signup") {
      router.replace(user?.onboarding_completed ? "/dashboard" : "/onboarding")
    }
  }, [isAuthenticated, isLoading, pathname, router, user?.onboarding_completed])

  if (isLoading && !AUTH_ROUTES.has(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading workspace...
      </div>
    )
  }

  return <>{children}</>
}
