"use client"

import { useEffect, useState } from "react"
import { aiApi } from "@/lib/api/ai"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface Props {
  quizId: string
}

export function AIGenerationPanel({ quizId }: Props) {
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const startGeneration = async () => {
    setLoading(true)
    const res = await aiApi.triggerGeneration(quizId, {
      extracted_text: "Manual trigger",
      blueprint: { mode: "manual" },
    })
    setStatus(res.message)
    setLoading(false)
  }

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (status === "processing") {
      interval = setInterval(async () => {
        const job = await aiApi.getJobStatus(quizId)
        setStatus(job.status)
      }, 3000)
    }

    return () => clearInterval(interval)
  }, [status, quizId])

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          AI Generation
        </h2>

        <p>Status: {status || "Not started"}</p>

        <Button onClick={startGeneration} disabled={loading}>
          {loading ? "Processing..." : "Start AI Generation"}
        </Button>
      </CardContent>
    </Card>
  )
}
