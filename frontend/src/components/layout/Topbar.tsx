"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Moon, Plus, Search, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useAuthStore } from "@/stores/useAuthStore"
import { useUIStore } from "@/stores/useUIStore"
import { useAccountSettingsStore } from "@/stores/useAccountSettingsStore"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getDisplayName, getInitials } from "@/lib/user"

export function Topbar() {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const setCommandOpen = useUIStore((state) => state.setCommandOpen)
  const profile = useAccountSettingsStore((s) => s.profile)
  const hydrate = useAccountSettingsStore((s) => s.hydrate)
  const hydratedUserId = useRef<string | null>(null)

  useEffect(() => {
    const id = user?.id ?? null
    if (id === hydratedUserId.current) return
    hydratedUserId.current = id
    hydrate(user)
  }, [hydrate, user])

  const displayName = getDisplayName(user)
  const displayEmail = profile.email || user?.email || "-"
  const initials = getInitials(displayName)
  const avatarUrl = user?.avatar_thumbnail_url || user?.avatar_url || profile.avatar_thumbnail_url || profile.avatar_url || ""
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)

  const goto = (href: string) => {
    setAccountMenuOpen(false)
    router.push(href)
  }

  useEffect(() => {
    if (!accountMenuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      const root = target.closest('[data-account-menu-root="true"]')
      if (!root) setAccountMenuOpen(false)
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountMenuOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onEscape)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onEscape)
    }
  }, [accountMenuOpen])

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-background/90 px-6 backdrop-blur">
      <div className="relative hidden w-full max-w-md md:block">
        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search quizzes, pages, actions..." onFocus={() => setCommandOpen(true)} />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" onClick={() => setCommandOpen(true)}>
          Command
          <span className="ml-2 hidden rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">Ctrl K</span>
        </Button>

        <Button onClick={() => router.push("/quizzes/create")}>
          <Plus className="mr-2 size-4" />
          Create Quiz
        </Button>

        <Button
          size="icon"
          variant="ghost"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </Button>

        <div className="relative z-30" data-account-menu-root="true">
          <Button
            variant="ghost"
            className="px-2"
            aria-label="Open account menu"
            onClick={(event) => {
              event.stopPropagation()
              setAccountMenuOpen((current) => !current)
            }}
          >
            <Avatar className="h-8 w-8">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
          {accountMenuOpen ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.14 }}
              className="absolute right-0 mt-2 w-72 rounded-md border bg-popover p-2 text-popover-foreground shadow-md"
            >
              <p className="px-2 py-1.5 text-sm font-medium">Account</p>
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{displayEmail}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => goto("/account/profile")}>
                    View profile
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => goto("/account/settings")}>
                    Settings
                  </Button>
                </div>
              </div>
              <div className="my-2 h-px bg-border" />
              <div className="space-y-1">
                <button type="button" className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground" onClick={() => goto("/account/profile")}>Account</button>
                <button type="button" className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground" onClick={() => goto("/account/settings?tab=profile")}>Profile</button>
                <button type="button" className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground" onClick={() => goto("/account/settings?tab=workspace")}>Workspace Settings</button>
                <button type="button" className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground" onClick={() => goto("/account/settings?tab=preferences")}>Preferences</button>
                <button type="button" className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground" onClick={() => goto("/account/settings?tab=notifications")}>Notifications</button>
                <button type="button" className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground" onClick={() => goto("/account/settings?tab=preferences")}>Appearance</button>
                <button type="button" className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground" onClick={() => goto("/account/settings?tab=security")}>Security</button>
                <button type="button" className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground" onClick={() => goto("/account/settings?tab=integrations")}>API Keys (future-ready)</button>
                <Link href="/help" className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground" onClick={() => setAccountMenuOpen(false)}>
                  Help / Documentation
                </Link>
              </div>
              <div className="my-2 h-px bg-border" />
              <button
                type="button"
                className="block w-full rounded-sm px-2 py-1.5 text-left text-sm text-destructive hover:bg-accent hover:text-destructive"
                onClick={() => {
                  setAccountMenuOpen(false)
                  void logout().then(() => router.replace("/login"))
                }}
              >
                Logout
              </button>
            </motion.div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
