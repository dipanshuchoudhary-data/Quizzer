"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, ChevronRight, LifeBuoy, LogOut, Menu, Moon, Plus, Settings2, ShieldCheck, Sun, UserRound } from "lucide-react"
import { useTheme } from "next-themes"
import { GlobalSearch } from "./global-search"
import { NotificationInbox } from "./notification-inbox"
import { NAV_SECTIONS } from "./nav-config"
import { useUIStore } from "@/stores/useUIStore"
import { useAuthStore } from "@/stores/useAuthStore"
import { useAccountSettingsStore } from "@/stores/useAccountSettingsStore"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getDisplayName, getInitials } from "@/lib/user"

type Breadcrumb = { label: string; href?: string }

function useBreadcrumbs() {
  const pathname = usePathname()

  return useMemo<Breadcrumb[]>(() => {
    if (!pathname) return []
    const matched = NAV_SECTIONS.flatMap((section) =>
      section.items.map((item) => ({ section, item }))
    ).filter((entry) => pathname === entry.item.href || pathname.startsWith(`${entry.item.href}/`))

    if (matched.length === 0) {
      return [{ label: "Dashboard", href: "/dashboard" }]
    }

    const active = matched.sort((a, b) => b.item.href.length - a.item.href.length)[0]
    const crumbs: Breadcrumb[] = [{ label: "Dashboard", href: "/dashboard" }]
    if (active.section.title !== "Dashboard" && NAV_SECTIONS.length > 1) {
      crumbs.push({ label: active.section.title })
    }
    crumbs.push({ label: active.item.label, href: active.item.href })
    return crumbs
  }, [pathname])
}

export function Topbar() {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const { user, logout } = useAuthStore()
  const { profile, hydrate } = useAccountSettingsStore()
  const { toggleMobileSidebar } = useUIStore()
  const breadcrumbs = useBreadcrumbs()
  const [accountOpen, setAccountOpen] = useState(false)

  useEffect(() => {
    hydrate(user)
  }, [hydrate, user])

  const displayName = getDisplayName(user)
  const displayEmail = profile.email || user?.email || "-"
  const initials = getInitials(displayName)
  const avatarUrl = user?.avatar_thumbnail_url || user?.avatar_url || profile.avatar_thumbnail_url || profile.avatar_url || ""

  const navigateTo = (href: string) => {
    setAccountOpen(false)
    router.push(href)
  }

  const openFeedback = () => {
    setAccountOpen(false)
    window.dispatchEvent(new CustomEvent("quizzer:feedback-open"))
  }

  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          className="lg:hidden"
          aria-label="Open navigation"
          onClick={toggleMobileSidebar}
        >
          <Menu className="size-4" />
        </Button>

        <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <div key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-2">
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className={cn(
                    "truncate font-medium transition-colors hover:text-foreground",
                    index === breadcrumbs.length - 1 && "text-foreground"
                  )}
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="truncate font-medium text-foreground">{crumb.label}</span>
              )}
              {index < breadcrumbs.length - 1 ? <ChevronRight className="size-3 text-muted-foreground" /> : null}
            </div>
          ))}
        </nav>

        <div className="order-3 hidden w-full lg:order-none lg:block lg:flex-1 lg:px-4">
          <GlobalSearch className="max-w-xl" />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button className="hidden h-11 sm:inline-flex" onClick={() => router.push("/quizzes/create")}>
            <Plus className="size-4" />
            Create Quiz
          </Button>
          <Button
            size="icon"
            className="h-11 w-11 sm:hidden"
            aria-label="Create quiz"
            onClick={() => router.push("/quizzes/create")}
          >
            <Plus className="size-4" />
          </Button>

          <NotificationInbox />

          <Button
            size="icon"
            variant="ghost"
            aria-label="Toggle theme"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="rounded-full border"
          >
            {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </Button>

          <DropdownMenu open={accountOpen} onOpenChange={setAccountOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="rounded-full border px-2" aria-label="Open account menu">
                <Avatar className="h-9 w-9">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={10} className="w-80 rounded-2xl border p-2 shadow-xl">
              <DropdownMenuLabel className="px-2 pb-3 pt-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11">
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold">{displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{displayEmail}</p>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => navigateTo("/account/profile")}>
                  <UserRound className="size-4 text-muted-foreground" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigateTo("/account/settings")}>
                  <Settings2 className="size-4 text-muted-foreground" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigateTo("/account/settings?tab=security")}>
                  <ShieldCheck className="size-4 text-muted-foreground" />
                  Login Sessions / Security
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={openFeedback}>
                  <Bell className="size-4 text-muted-foreground" />
                  Feedback
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => navigateTo("/help")}>
                  <LifeBuoy className="size-4 text-muted-foreground" />
                  Help / Support
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  setAccountOpen(false)
                  void logout().then(() => router.replace("/login"))
                }}
                className="rounded-xl px-3 py-2 text-destructive focus:text-destructive"
              >
                <LogOut className="size-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="mt-3 lg:hidden">
        <GlobalSearch />
      </div>
    </header>
  )
}
