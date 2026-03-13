"use client"

import { useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle } from "lucide-react"
import { QuizWorkspaceClient } from "@/features/quiz/QuizWorkspaceClient"
import { useAuthStore } from "@/stores/useAuthStore"
import { Card, CardContent } from "@/components/ui/card"

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function QuizRouteEntry({ routeId }: { routeId: string }) {
  const router = useRouter()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const authLoading = useAuthStore((state) => state.isLoading)

  const attemptedAutoStart = useRef(false)
  const adminRoute = useMemo(() => isUuidLike(routeId), [routeId])

  useEffect(() => {
    if (adminRoute || authLoading || attemptedAutoStart.current) return
    attemptedAutoStart.current = true
    router.replace(`/exam/${routeId}/start`)
  }, [adminRoute, authLoading, routeId, router])

  if (adminRoute && isAuthenticated) {
    return <QuizWorkspaceClient quizId={routeId} />
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4">
      <Card className="w-full max-w-lg border-border/70 shadow-lg">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background shadow-sm">
            <LoaderCircle className="size-6 animate-spin text-foreground/70" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold text-foreground">Preparing your exam environment...</h1>
            <p className="text-sm text-muted-foreground">
              Initializing your secure attempt, loading the question snapshot, and syncing the exam timer.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
