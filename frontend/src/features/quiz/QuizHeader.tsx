"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Quiz } from "@/types/quiz"
import { Button } from "@/components/ui/button"
import { LifecycleBadge } from "@/components/common/LifecycleBadge"
import { aiApi } from "@/lib/api/ai"
import { quizApi } from "@/lib/api/quiz"
import { getApiErrorMessage } from "@/lib/api/error"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export function QuizHeader({ quiz }: { quiz: Quiz }) {
  const queryClient = useQueryClient()
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [jobMessage, setJobMessage] = useState<string>("")

  useEffect(() => {
    if (quiz.ai_generation_status !== "PROCESSING" || activeJobId) return
    let cancelled = false
    void aiApi
      .getLatestQuizJob(quiz.id)
      .then((job) => {
        if (!cancelled) setActiveJobId(job.id)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [activeJobId, quiz.ai_generation_status, quiz.id])

  useEffect(() => {
    if (!activeJobId) return
    const timer = window.setInterval(async () => {
      try {
        const job = await aiApi.getJobStatus(activeJobId)
        const stage = String(job.metadata?.stage || "generating_questions").replace(/_/g, " ")
        const progress = Number(job.metadata?.progress ?? 0)
        const estimated = Number(job.metadata?.estimated_seconds ?? 20)
        setJobMessage(`Generating questions... ${progress ? `${progress}%` : ""} Estimated time: ~${estimated}s. Stage: ${stage}.`)
        queryClient.invalidateQueries({ queryKey: ["quiz", quiz.id] })
        if (job.status === "COMPLETED") {
          queryClient.invalidateQueries({ queryKey: ["questions", quiz.id] })
          queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] })
          queryClient.invalidateQueries({ queryKey: ["quizzes"] })
          setActiveJobId(null)
          setJobMessage("")
          toast.success("AI generation completed")
        }
        if (job.status === "FAILED") {
          setActiveJobId(null)
          setJobMessage("")
          toast.error(String(job.metadata?.error || "AI generation failed"))
        }
      } catch {
        setActiveJobId(null)
      }
    }, 5000)

    return () => window.clearInterval(timer)
  }, [activeJobId, queryClient, quiz.id])

  const aiMutation = useMutation({
    mutationFn: () =>
      quizApi.generate(quiz.id, {
        extracted_text: "Teacher-triggered generation",
        blueprint: {
          mode: "manual-trigger",
          auto_detect_structure: true,
          sections: [
            {
              title: "Section 1",
              numberOfQuestions: 5,
              questionType: "MCQ",
              marksPerQuestion: 1,
            },
          ],
        },
      }),
    onSuccess: (response) => {
      if (response.job_id) setActiveJobId(response.job_id)
      setJobMessage("Generating questions... Estimated time: ~20 seconds.")
      toast.success("Generation triggered")
      queryClient.invalidateQueries({ queryKey: ["quiz", quiz.id] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] })
    },
    onError: () => toast.error("Generation failed"),
  })

  const publishMutation = useMutation({
    mutationFn: () => quizApi.publish(quiz.id),
    onSuccess: (data) => {
      toast.success("Quiz published")
      queryClient.invalidateQueries({ queryKey: ["quiz", quiz.id] })
      queryClient.invalidateQueries({ queryKey: ["quizzes"] })
      setPublishedUrl(data.public_url ?? null)
    },
    onError: (error: unknown) => {
      const message = getApiErrorMessage(error, "Publish blocked by backend validation")
      toast.error(message)
    },
  })

  const canPublish = quiz.ai_generation_status !== "PROCESSING" && !quiz.is_published
  const publishLabel = quiz.is_published ? "Published" : "Publish"

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{quiz.title}</h1>
        <LifecycleBadge lifecycle={quiz.ai_generation_status} />
        {quiz.ai_generation_status === "PROCESSING" ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            <p>{jobMessage || "Generating questions... Estimated time: ~20 seconds."}</p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => aiMutation.mutate()} disabled={aiMutation.isPending}>
          {aiMutation.isPending ? "Starting..." : "Generate with AI"}
        </Button>
        <Button onClick={() => publishMutation.mutate()} disabled={!canPublish || publishMutation.isPending}>
          {publishMutation.isPending ? "Publishing..." : publishLabel}
        </Button>
      </div>

      <Dialog open={Boolean(publishedUrl)} onOpenChange={(open) => !open && setPublishedUrl(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quiz Published</DialogTitle>
          </DialogHeader>
          <Input value={publishedUrl ?? ""} readOnly />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (!publishedUrl) return
                void navigator.clipboard.writeText(publishedUrl)
                toast.success("Public URL copied")
              }}
            >
              Copy link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
