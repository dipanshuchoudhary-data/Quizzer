"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function VerifyEmailPage() {
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
