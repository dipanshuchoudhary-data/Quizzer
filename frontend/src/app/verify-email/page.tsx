"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useAuthStore } from "@/stores/useAuthStore"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const refreshMe = useAuthStore((state) => state.refreshMe)

  useEffect(() => {
    const handleGoogleCallback = async () => {
      const token = searchParams.get("token")
      if (token) {
        try {
          const user = await refreshMe()
          router.replace(user?.onboarding_completed ? "/dashboard" : "/onboarding")
        } catch {
          router.replace("/login")
        }
      }
    }

    void handleGoogleCallback()
  }, [searchParams, refreshMe, router])

  const token = searchParams.get("token")
  if (token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/40 to-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Signing you in...</h1>
          <p className="text-muted-foreground mt-2">Please wait while we complete your authentication.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email Verification Disabled</CardTitle>
          <CardDescription>Accounts currently sign in directly with email and password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This page is kept only as a placeholder while email and mobile OTP verification are turned off.
          </p>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="underline-offset-4 hover:underline">
              Back to login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
