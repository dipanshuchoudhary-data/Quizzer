"use client"

import { useState, useCallback } from "react"
import { useMutation } from "@tanstack/react-query"
import { Clock, Film, PlayCircle, AlertCircle, CheckCircle2, Loader2, Youtube } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { aiApi, type YouTubeChoiceRequired, type YouTubeConfirmPayload } from "@/lib/api/ai"

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds) return "Unknown duration"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function parseTimeInput(value: string): number {
  // Accept: "1:30:00", "90:00", "5400", "5400s"
  const trimmed = value.replace(/s$/, "").trim()
  const parts = trimmed.split(":").map(Number)
  if (parts.some(Number.isNaN)) return 0
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] ?? 0
}

function secondsToHms(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`
}

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface YouTubeChoiceDialogProps {
  open: boolean
  quizId: string
  choiceData: YouTubeChoiceRequired
  onSuccess: () => void
  onClose: () => void
}

type Mode = "time_range" | "full_video" | null

const POLITE_RETRY_MESSAGE =
  "We truly appreciate your trust in Quizzer — and we're sorry we can't process that entire range right now. " +
  "Our current system has processing limits that prevent us from handling very large transcripts in one go. " +
  "We're actively working to lift these limits. In the meantime, please try a shorter time range and we'll take it from there. 🙏"

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export function YouTubeChoiceDialog({
  open,
  quizId,
  choiceData,
  onSuccess,
  onClose,
}: YouTubeChoiceDialogProps) {
  const [mode, setMode] = useState<Mode>(null)
  const [startInput, setStartInput] = useState("")
  const [endInput, setEndInput] = useState("")
  const [rangeErrorCount, setRangeErrorCount] = useState(0)
  const [politeMessage, setPoliteMessage] = useState<string | null>(null)

  const totalSeconds = choiceData.duration

  const confirmMutation = useMutation({
    mutationFn: (payload: YouTubeConfirmPayload) => aiApi.confirmYouTubeSource(payload),
    onSuccess: () => {
      toast.success("YouTube source added successfully!")
      onSuccess()
      onClose()
    },
    onError: (error: unknown) => {
      const msg =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? ""

      if (msg.toLowerCase().includes("limit") || msg.toLowerCase().includes("large") || msg.toLowerCase().includes("exceeds")) {
        const count = rangeErrorCount + 1
        setRangeErrorCount(count)
        if (count >= 2) {
          setPoliteMessage(POLITE_RETRY_MESSAGE)
        } else {
          toast.error("That range is still too large. Please choose a shorter time window.")
        }
      } else {
        toast.error(msg || "Something went wrong. Please try again.")
      }
    },
  })

  const handleConfirm = useCallback(() => {
    setPoliteMessage(null)

    if (mode === "time_range") {
      const start = parseTimeInput(startInput)
      const end = parseTimeInput(endInput)
      if (end <= start) {
        toast.error("End time must be after start time.")
        return
      }
      confirmMutation.mutate({
        quiz_id: quizId,
        video_id: choiceData.video_id,
        mode: "time_range",
        start_seconds: start,
        end_seconds: end,
      })
    } else if (mode === "full_video") {
      confirmMutation.mutate({
        quiz_id: quizId,
        video_id: choiceData.video_id,
        mode: "full_video",
      })
    }
  }, [mode, startInput, endInput, quizId, choiceData.video_id, confirmMutation])

  const thumbnailUrl = `https://img.youtube.com/vi/${choiceData.video_id}/mqdefault.jpg`
  const isHuge = choiceData.transcript_size === "HUGE"

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !confirmMutation.isPending) onClose() }}>
      <DialogContent className="!max-w-xl w-full p-0 overflow-hidden rounded-2xl gap-0 border-0 shadow-2xl">
        {/* ── Header gradient ── */}
        <div className="relative bg-gradient-to-br from-red-600 via-red-500 to-orange-500 p-6 pb-16">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Youtube className="text-white" size={20} />
              <span className="text-red-100 text-xs font-medium uppercase tracking-widest">YouTube</span>
            </div>
            <DialogTitle className="text-white text-xl font-bold leading-tight">
              This video is too long to process directly
            </DialogTitle>
            <p className="text-red-100 text-sm mt-1">
              Choose how you&apos;d like to extract content from this video.
            </p>
          </DialogHeader>
        </div>

        {/* ── Video card ── */}
        <div className="mx-5 -mt-10 rounded-xl overflow-hidden border shadow-lg bg-card flex items-center gap-3 p-3">
          <img
            src={thumbnailUrl}
            alt="Video thumbnail"
            className="w-24 h-16 object-cover rounded-lg flex-shrink-0"
          />
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-snug line-clamp-2">{choiceData.title}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                <Clock size={10} className="mr-1" />
                {formatDuration(totalSeconds)}
              </Badge>
              <Badge
                className={`text-xs px-2 py-0.5 ${
                  isHuge
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                }`}
              >
                {isHuge ? "Very long video" : "Long video"}
              </Badge>
            </div>
          </div>
        </div>

        {/* ── Choice cards ── */}
        <div className="p-5 space-y-3 mt-2">
          {/* Time-range (recommended) */}
          <button
            type="button"
            onClick={() => { setMode("time_range"); setPoliteMessage(null) }}
            className={`w-full text-left rounded-xl border-2 p-4 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              mode === "time_range"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/40 hover:bg-muted/40"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 rounded-lg p-1.5 ${mode === "time_range" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                <PlayCircle size={16} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">Select a time range</span>
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs px-2 py-0 border-0">
                    Recommended
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose a specific portion of the video (e.g. a lecture segment). Fast and precise.
                </p>
              </div>
              {mode === "time_range" && <CheckCircle2 size={16} className="text-primary mt-0.5 flex-shrink-0" />}
            </div>

            {/* Time inputs */}
            {mode === "time_range" && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Start time
                  </label>
                  <Input
                    placeholder={totalSeconds > 3600 ? "0:10:00" : "10:00"}
                    value={startInput}
                    onChange={(e) => setStartInput(e.target.value)}
                    className="h-9 text-sm"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    End time
                  </label>
                  <Input
                    placeholder={totalSeconds > 3600 ? "0:45:00" : "45:00"}
                    value={endInput}
                    onChange={(e) => setEndInput(e.target.value)}
                    className="h-9 text-sm"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                {startInput && endInput && (
                  <p className="col-span-2 text-xs text-muted-foreground">
                    Range:{" "}
                    <span className="text-foreground font-medium">
                      {secondsToHms(parseTimeInput(startInput))} → {secondsToHms(parseTimeInput(endInput))}
                    </span>
                    {" "}({Math.round((parseTimeInput(endInput) - parseTimeInput(startInput)) / 60)} min)
                  </p>
                )}
              </div>
            )}
          </button>

          {/* Full video (slow) */}
          <button
            type="button"
            onClick={() => { setMode("full_video"); setPoliteMessage(null) }}
            className={`w-full text-left rounded-xl border-2 p-4 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              mode === "full_video"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/40 hover:bg-muted/40"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 rounded-lg p-1.5 ${mode === "full_video" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                <Film size={16} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">Process the full video</span>
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs px-2 py-0 border-0">
                    Slower
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The system will summarise the entire video in chunks and build a study guide. Takes a few minutes.
                </p>
              </div>
              {mode === "full_video" && <CheckCircle2 size={16} className="text-primary mt-0.5 flex-shrink-0" />}
            </div>
          </button>

          {/* Polite capacity message */}
          {politeMessage && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 flex gap-3">
              <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                {politeMessage}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={confirmMutation.isPending}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={!mode || confirmMutation.isPending}
              className="min-w-32"
            >
              {confirmMutation.isPending ? (
                <>
                  <Loader2 size={14} className="mr-2 animate-spin" />
                  {mode === "full_video" ? "Building study guide…" : "Processing…"}
                </>
              ) : (
                "Confirm"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
