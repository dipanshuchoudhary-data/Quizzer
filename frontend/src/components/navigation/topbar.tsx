"use client"

import { useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, BookOpen, ChevronRight, FolderPlus, LifeBuoy, LogOut, Menu, Moon, Plus, Settings2, ShieldCheck, Sun, UserRound } from "lucide-react"
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
    <header className="sticky top-0 z-20 border-b border-[var(--border-color)] bg-[var(--bg-primary)] px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          className="lg:hidden text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          aria-label="Open navigation"
          onClick={toggleMobileSidebar}
        >
          <Menu className="size-4" />
        </Button>

        <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-sm">
          {breadcrumbs.map((crumb, index) => (
            <div key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-2">
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className={cn(
                    "truncate font-medium transition-colors",
                    index === breadcrumbs.length - 1 ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="truncate font-medium text-[var(--text-primary)]">{crumb.label}</span>
              )}
              {index < breadcrumbs.length - 1 ? <ChevronRight className="size-3 text-[var(--border-color)]" /> : null}
            </div>
          ))}
        </nav>

        <div className="order-3 hidden w-full lg:order-none lg:block lg:flex-1 lg:px-4">
          <GlobalSearch className="max-w-xl" />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {!isStudent ? (
            <>
              <Button onClick={() => navigateTo("/quizzes/create?new=1")} className="h-[44px] rounded-[10px] bg-[var(--brand-accent)] px-[18px] font-semibold text-[var(--text-on-green)] shadow-[0_2px_8px_rgba(74,222,128,0.25)] transition hover:bg-[var(--brand-accent-strong)]">
                <Plus className="size-4" />
                <span className="hidden sm:inline">Create</span>
              </Button>
              <NotificationInbox />
            </>
          ) : null}

          <Button
            size="icon"
            variant="ghost"
            aria-label="Toggle theme"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="rounded-full text-[var(--text-muted)] transition hover:text-[var(--brand-accent)]"
          >
            {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </Button>

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              aria-label="Open account menu"
              className="inline-flex items-center justify-center rounded-full border-2 border-[var(--border-color)] bg-[var(--bg-secondary)] p-0.5 transition-all hover:border-[var(--brand-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar className="h-9 w-9">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={10} className="w-80 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-2 shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
              <DropdownMenuLabel className="px-2 pb-3 pt-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11">
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{displayName}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">{displayEmail}</p>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[var(--border-color)]" />
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => navigateTo("/account/profile")}>
                  <UserRound className="size-4 text-[var(--text-muted)]" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigateTo("/account/settings")}>
                  <Settings2 className="size-4 text-[var(--text-muted)]" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigateTo("/account/settings?tab=security")}>
                  <ShieldCheck className="size-4 text-[var(--text-muted)]" />
                  Login Sessions / Security
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={openFeedback}>
                  <Bell className="size-4 text-[var(--text-muted)]" />
                  Feedback
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="bg-[var(--border-color)]" />
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => navigateTo("/help")}>
                  <LifeBuoy className="size-4 text-[var(--text-muted)]" />
                  Help / Support
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="bg-[var(--border-color)]" />
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
