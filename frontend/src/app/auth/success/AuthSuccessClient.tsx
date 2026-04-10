"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getPostAuthRoute, storeAccessToken } from "@/lib/auth"
import { useAuthStore } from "@/stores/useAuthStore"

export function AuthSuccessClient({ token }: { token?: string }) {
  const router = useRouter()
  const refreshMe = useAuthStore((state) => state.refreshMe)
  const [message, setMessage] = useState("Completing your sign-in...")

  useEffect(() => {
    let cancelled = false

    const completeAuth = async () => {
      if (!token || !storeAccessToken(token)) {
        router.replace("/login")
        return
      }

      try {
        const user = await refreshMe()
        if (cancelled) return
        setMessage("Redirecting to your workspace...")
        router.replace(getPostAuthRoute(user))
      } catch {
        if (!cancelled) {
          router.replace("/login")
        }
      }
    }

    void completeAuth()
    return () => {
      cancelled = true
    }
  }, [refreshMe, router, token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/40 to-background px-6">
      <div className="text-center">
        <div className="mx-auto mb-4 h-11 w-11 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Signing you in</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}
