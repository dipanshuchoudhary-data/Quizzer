"use client"

import type { KeyboardEvent, MouseEvent, ReactNode } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Clock3 } from "lucide-react"
import { LifecycleBadge } from "@/components/common/LifecycleBadge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface QuizCardProps {
  quizId: string
  quizTitle: string
  questionCount?: number
  duration?: number
  status: string
  lastUpdated?: string
  action?: ReactNode
  children?: ReactNode
  className?: string
}

function formatRelativeTime(dateString?: string) {
  if (!dateString) return "Unknown"
  const value = new Date(dateString).getTime()
  if (!value || Number.isNaN(value)) return "Unknown"
  const diff = Date.now() - value
  const minute = 60_000
  const hour = minute * 60
  const day = hour * 24
  if (diff < hour) return `${Math.max(1, Math.round(diff / minute))}m ago`
  if (diff < day) return `${Math.round(diff / hour)}h ago`
  if (diff < day * 7) return `${Math.round(diff / day)}d ago`
  return new Date(dateString).toLocaleDateString()
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest("a, button, [role='button'], [data-quiz-card-action='true']"))
}

export function QuizCard({
  quizId,
  quizTitle,
  questionCount,
  duration,
  status,
  lastUpdated,
  action,
  children,
  className,
}: QuizCardProps) {
  const router = useRouter()

  const navigate = () => {
    router.push(`/quiz/${quizId}`)
  }

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (isInteractiveTarget(event.target)) return
    navigate()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter") return
    if (isInteractiveTarget(event.target)) return
    event.preventDefault()
    navigate()
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <Card
        role="link"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "cursor-pointer border-border/70 bg-card/70 transition-[transform,box-shadow,border-color,background-color] duration-180 ease-out hover:border-foreground/20 hover:bg-muted/20 hover:shadow-xl hover:shadow-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="font-semibold">{quizTitle}</p>
              <LifecycleBadge lifecycle={status} />
            </div>
            {action ? <div data-quiz-card-action="true">{action}</div> : null}
          </div>

          {(questionCount != null || duration != null) && (
            <p className="mt-2 text-sm text-muted-foreground">
              {questionCount != null ? `${questionCount} questions` : null}
              {questionCount != null && duration != null ? " • " : null}
              {duration != null ? `${duration} min` : null}
            </p>
          )}

          {children ? <div className="mt-4">{children}</div> : null}

          {lastUpdated ? (
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" />
              <span>Updated {formatRelativeTime(lastUpdated)}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  )
}
