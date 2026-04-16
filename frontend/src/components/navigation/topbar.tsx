"use client"

import { useEffect, useMemo, useRef } from "react"
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
import { normalizeAppRole } from "@/lib/auth"
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
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const profile = useAccountSettingsStore((s) => s.profile)
  const hydrate = useAccountSettingsStore((s) => s.hydrate)
  const toggleMobileSidebar = useUIStore((s) => s.toggleMobileSidebar)
  const breadcrumbs = useBreadcrumbs()
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
  const isStudent = normalizeAppRole(user?.role) === "student"

  const navigateTo = (href: string) => {
    router.push(href)
  }

  const openFeedback = () => {
    window.dispatchEvent(new CustomEvent("quizzer:feedback-open"))
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/88 px-4 py-3 backdrop-blur-xl sm:px-6">
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
          {!isStudent ? (
            <>
              <Button
                className="hidden h-11 rounded-2xl bg-[var(--brand-accent)] px-5 font-semibold text-white shadow-[0_12px_28px_rgba(34,197,94,0.24)] transition hover:-translate-y-0.5 hover:bg-green-600 dark:text-black dark:hover:bg-green-300 sm:inline-flex"
                onClick={() => router.push("/quizzes/create?new=1")}
              >
                <Plus className="size-4" />
                Create Quiz
              </Button>
              <Button
                size="icon"
                className="h-11 w-11 rounded-2xl bg-[var(--brand-accent)] text-white shadow-[0_10px_22px_rgba(34,197,94,0.24)] transition hover:bg-green-600 dark:text-black dark:hover:bg-green-300 sm:hidden"
                aria-label="Create quiz"
                onClick={() => router.push("/quizzes/create?new=1")}
              >
                <Plus className="size-4" />
              </Button>
              <NotificationInbox />
            </>
          ) : null}

          <Button
            size="icon"
            variant="ghost"
            aria-label="Toggle theme"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="rounded-full border border-border/70 bg-card/90 transition hover:scale-[1.03] hover:bg-muted"
          >
            {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </Button>

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              aria-label="Open account menu"
              className="inline-flex items-center justify-center rounded-full border border-border/70 bg-background/90 p-1 transition-all hover:scale-[1.03] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar className="h-9 w-9">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
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
