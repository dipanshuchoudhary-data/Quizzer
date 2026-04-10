"use client"

import { useEffect, useMemo, useState } from "react"
import axios from "axios"
import { toast } from "sonner"
import { feedbackApi } from "@/lib/api/feedback"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

const MAX_WORDS = 500
const SUCCESS_MESSAGE =
  "Thank you for giving feedback. We respect your time and will focus on improving your experience."

function countWords(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

export function FeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const wordCount = useMemo(() => countWords(message), [message])

  const resetForm = () => {
    setMessage("")
    setError("")
  }

  const validate = () => {
    const trimmed = message.trim()
    if (!trimmed) {
      setError("Feedback is required.")
      return false
    }
    if (wordCount > MAX_WORDS) {
      setError("Feedback must be 500 words or fewer.")
      return false
    }
    setError("")
    return true
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setIsSubmitting(true)
    try {
      await feedbackApi.submit({ message: message.trim() })
      toast.success(SUCCESS_MESSAGE)
      resetForm()
      setOpen(false)
    } catch (submissionError: unknown) {
      const detail = axios.isAxiosError(submissionError)
        ? ((submissionError.response?.data as { detail?: string } | undefined)?.detail ??
          "We could not send your feedback right now. Please try again.")
        : "We could not send your feedback right now. Please try again."
      setError(detail)
      toast.error(detail)
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    const openFromAccountMenu = () => {
      setOpen(true)
    }

    window.addEventListener("quizzer:feedback-open", openFromAccountMenu)
    return () => {
      window.removeEventListener("quizzer:feedback-open", openFromAccountMenu)
    }
  }, [])

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Feedback</DialogTitle>
            <DialogDescription>
              Share your experience with Quizzer. Your feedback helps us improve faster.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="feedback-message" className="block text-sm font-semibold text-foreground">
              Write your feedback
            </label>
            <Textarea
              id="feedback-message"
              value={message}
              onChange={(event) => {
                setMessage(event.target.value)
                if (error) {
                  setError("")
                }
              }}
              rows={7}
              placeholder="Tell us what worked well, what felt confusing, or what we should improve."
              aria-invalid={Boolean(error)}
            />
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className={error ? "text-destructive" : "text-muted-foreground"}>
                {error || "Required. Maximum 500 words."}
              </span>
              <span className={wordCount > MAX_WORDS ? "font-medium text-destructive" : "text-muted-foreground"}>
                {wordCount}/{MAX_WORDS} words
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
