"use client"

import { useEffect, useMemo, useState } from "react"
import axios from "axios"
import { Bell, CheckCheck, Megaphone, AlertTriangle, Info, BellRing, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { notificationsApi, type InboxNotification, type NotificationCategory } from "@/lib/api/notifications"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/useAuthStore"

const CATEGORY_ICONS: Record<NotificationCategory, React.ElementType> = {
  update: Info,
  announcement: Megaphone,
  alert: AlertTriangle,
}

const CATEGORY_STYLES: Record<NotificationCategory, string> = {
  update: "bg-blue-50/80 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-900/50",
  announcement: "bg-emerald-50/80 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-900/50",
  alert: "bg-rose-50/80 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-900/50",
}

function formatRelativeDay(value: string) {
  const date = new Date(value)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000)

  if (diffDays <= 0) {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "numeric" }).format(date)
  }
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
  const user = useAuthStore((s) => s.user)
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
  const [activeTab, setActiveTab] = useState("inbox")

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
      // Keep silent
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
    const intervalId = window.setInterval(() => void loadUnreadCount(), 60000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!open) return
    if (activeTab === "inbox") {
      void loadNotifications()
      if (unreadCount > 0) {
        void notificationsApi.markAllRead().then(() => setUnreadCount(0)).catch(() => undefined)
      }
    }
  }, [open, activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

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
      toast.success("Broadcast sent to all users.")
      setActiveTab("inbox")
      await loadNotifications()
    } catch (error) {
      setComposerError(extractErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const InboxContent = (
    <div className="flex flex-col h-[400px]">
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-foreground">Notifications</p>
          <p className="text-xs text-muted-foreground">Catch up on your latest updates.</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground" onClick={() => loadNotifications()}>
            <CheckCheck className="mr-1.5 size-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !hasItems ? (
          <div className="flex h-full flex-col items-center justify-center space-y-3 px-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted/50 border border-border">
              <BellRing className="size-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">You're all caught up</p>
              <p className="text-xs text-muted-foreground">No new notifications right now.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => {
              const Icon = CATEGORY_ICONS[item.category] || Info
              return (
                <div key={item.id} className={cn("group flex gap-3.5 px-4 py-4 transition-colors hover:bg-muted/40", !item.read && "bg-blue-50/20 dark:bg-blue-900/10")}>
                  <div className="shrink-0 pt-0.5">
                    <div className={cn("flex size-8 items-center justify-center rounded-full border shadow-sm", CATEGORY_STYLES[item.category])}>
                      <Icon className="size-3.5" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-1 overflow-hidden">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold leading-tight text-foreground">{item.title}</p>
                      <span className="shrink-0 text-[10px] uppercase font-medium tracking-wider text-muted-foreground mt-0.5">{formatRelativeDay(item.created_at)}</span>
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground line-clamp-2">{item.description}</p>
                    {!item.read && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">New</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  const BroadcastContent = (
    <div className="flex flex-col h-[400px]">
      <div className="border-b px-4 py-3 shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <p className="text-sm font-semibold text-foreground">Broadcast to all users</p>
        <p className="text-xs text-muted-foreground">Send an alert or announcement to everyone.</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subject</label>
          <Input
            value={composer.title}
            onChange={(e) => setComposer((c) => ({ ...c, title: e.target.value }))}
            placeholder="E.g., Scheduled Maintenance"
            className="text-sm focus-visible:ring-emerald-500"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Message</label>
          <Textarea
            value={composer.description}
            onChange={(e) => setComposer((c) => ({ ...c, description: e.target.value }))}
            rows={4}
            placeholder="Type your announcement details here..."
            className="resize-none text-sm focus-visible:ring-emerald-500"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</label>
          <div className="grid grid-cols-3 gap-2">
            {(["update", "announcement", "alert"] as NotificationCategory[]).map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setComposer((current) => ({ ...current, category }))}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium capitalize transition-all",
                  composer.category === category
                    ? "border-slate-900 bg-slate-900 text-white shadow-sm dark:border-white dark:bg-white dark:text-slate-950"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t bg-muted/20 px-4 py-3 shrink-0 flex items-center justify-between">
        <span className="text-xs font-medium text-destructive">{composerError}</span>
        <Button onClick={handleBroadcast} disabled={isSubmitting} size="sm" className={cn("w-[130px] font-semibold transition-all", isSubmitting ? "" : "hover:bg-slate-800 dark:hover:bg-slate-200")}>
          {isSubmitting ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <Megaphone className="mr-2 size-3.5" />}
          Broadcast
        </Button>
      </div>
    </div>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-all hover:bg-muted hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 active:scale-[0.96]"
          aria-label="Notifications"
        >
          <Bell className="size-4 text-foreground transition-transform group-hover:scale-105" strokeWidth={2} />
          {badgeLabel ? (
            <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full border-[2.5px] border-background bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm transition-transform group-hover:scale-110">
              {badgeLabel}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[min(95vw,380px)] overflow-hidden rounded-xl p-0 shadow-2xl shadow-black/10 border-border/80">
        {!canBroadcast ? (
          InboxContent
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="bg-slate-50 border-b border-border/50 p-1.5 dark:bg-slate-900/50">
              <TabsList className="flex w-full items-center justify-between space-x-1 rounded-lg bg-background border p-1 shadow-sm">
                <TabsTrigger value="inbox" className="flex-1 rounded-md text-xs font-semibold tracking-wide">Inbox</TabsTrigger>
                <TabsTrigger value="broadcast" className="flex-1 rounded-md text-xs font-semibold tracking-wide">Broadcast</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="inbox" className="mt-0 outline-none">{InboxContent}</TabsContent>
            <TabsContent value="broadcast" className="mt-0 outline-none">{BroadcastContent}</TabsContent>
          </Tabs>
        )}
      </PopoverContent>
    </Popover>
  )
}
