"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/useAuthStore"

const PUBLIC_ROUTES = new Set(["/login"])

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { bootstrap, isAuthenticated, isLoading } = useAuthStore((state) => state)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    if (isLoading) return

    const isPublic = PUBLIC_ROUTES.has(pathname)
    if (!isAuthenticated && !isPublic) {
      router.replace("/login")
      return
    }

    if (isAuthenticated && pathname === "/login") {
      router.replace("/dashboard")
    }
  }, [isAuthenticated, isLoading, pathname, router])

  if (isLoading && !PUBLIC_ROUTES.has(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading workspace...
      </div>
    )
  }

  return <>{children}</>
}

