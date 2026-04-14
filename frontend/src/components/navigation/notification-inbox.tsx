"use client"

import { useEffect, useMemo, useState } from "react"
import axios from "axios"
import { Bell } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { notificationsApi, type InboxNotification, type NotificationCategory } from "@/lib/api/notifications"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/useAuthStore"

const CATEGORY_STYLES: Record<NotificationCategory, string> = {
  update: "bg-emerald-50 text-emerald-700 border-emerald-200",
  announcement: "bg-amber-50 text-amber-800 border-amber-200",
  alert: "bg-rose-50 text-rose-700 border-rose-200",
}

function formatRelativeDay(value: string) {
  const date = new Date(value)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000)

  if (diffDays <= 0) return "Today"
  if (diffDays === 1) return "Yesterday"

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)
}

function extractErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { detail?: string } | undefined)?.detail ??
      "We could not load updates right now."
    )
  }
  return "We could not load updates right now."
}

export function NotificationInbox() {
  const { user } = useAuthStore()
  const canBroadcast = user?.role === "ADMIN" || user?.role === "STAFF"
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<InboxNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [composer, setComposer] = useState({
    title: "",
    description: "",
    category: "announcement" as NotificationCategory,
  })
  const [composerError, setComposerError] = useState("")

  const hasItems = items.length > 0

  const badgeLabel = useMemo(() => {
    if (unreadCount <= 0) return null
    return unreadCount > 9 ? "9+" : String(unreadCount)
  }, [unreadCount])

  const loadUnreadCount = async () => {
    try {
      const data = await notificationsApi.unreadCount()
      setUnreadCount(data.unread_count)
    } catch {
      // Keep the bell usable even if the count call fails.
    }
  }

  const loadNotifications = async () => {
    setIsLoading(true)
    try {
      const data = await notificationsApi.list()
      setItems(data.items)
      setUnreadCount(data.unread_count)
    } catch (error) {
      toast.error(extractErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadUnreadCount()

    const intervalId = window.setInterval(() => {
      void loadUnreadCount()
    }, 60000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!open) return

    void loadNotifications()
    void notificationsApi.markAllRead().then(() => setUnreadCount(0)).catch(() => undefined)
  }, [open])

  const handleBroadcast = async () => {
    if (!composer.title.trim() || !composer.description.trim()) {
      setComposerError("Title and description are required.")
      return
    }

    setComposerError("")
    setIsSubmitting(true)
    try {
      await notificationsApi.broadcast({
        title: composer.title.trim(),
        description: composer.description.trim(),
        category: composer.category,
      })
      setComposer({ title: "", description: "", category: "announcement" })
      await loadNotifications()
      await notificationsApi.markAllRead()
      setUnreadCount(0)
      toast.success("Broadcast sent to all users.")
    } catch (error) {
      const detail = extractErrorMessage(error)
      setComposerError(detail)
      toast.error(detail)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border bg-background transition-all duration-150 hover:bg-muted hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 active:scale-[0.96]"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          {badgeLabel ? (
            <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {badgeLabel}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={10} className="w-[min(92vw,26rem)] p-0">
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Updates</p>
              <p className="text-xs text-muted-foreground">Announcements, improvements, and important alerts.</p>
            </div>
            {unreadCount > 0 ? (
              <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                {unreadCount} unread
              </span>
            ) : null}
          </div>
        </div>

        {canBroadcast ? (
          <div className="space-y-3 border-b bg-muted/40 px-4 py-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Broadcast to all users</p>
              <p className="text-xs text-muted-foreground">Share platform-wide updates from the inbox.</p>
            </div>
            <Input
              value={composer.title}
              onChange={(event) => setComposer((current) => ({ ...current, title: event.target.value }))}
              placeholder="Title"
            />
            <Textarea
              value={composer.description}
              onChange={(event) => setComposer((current) => ({ ...current, description: event.target.value }))}
              rows={3}
              placeholder="Short description"
            />
            <div className="flex flex-wrap items-center gap-2">
              {(["update", "announcement", "alert"] as NotificationCategory[]).map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setComposer((current) => ({ ...current, category }))}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                    composer.category === category
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-destructive">{composerError}</span>
              <Button type="button" size="sm" onClick={handleBroadcast} disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Send update"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="max-h-[28rem] overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">Loading updates...</div>
          ) : !hasItems ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">No updates yet</div>
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <div key={item.id} className={cn("space-y-2 px-4 py-4", !item.read && "bg-muted/30")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{item.title}</span>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize", CATEGORY_STYLES[item.category])}>
                          {item.category}
                        </span>
                      </div>
                      <p className="text-sm leading-5 text-muted-foreground">{item.description}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeDay(item.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
