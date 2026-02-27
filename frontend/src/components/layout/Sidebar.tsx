"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Bot, ClipboardCheck, ClipboardList, LayoutDashboard, Link2, PanelLeftClose, PanelLeftOpen, Sparkles } from "lucide-react"
import { useUIStore } from "@/stores/useUIStore"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const items = [
  { id: "dashboard", name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { id: "all", name: "All Quizzes", href: "/quizzes", icon: ClipboardList },
  { id: "reviewing", name: "Review Queue", href: "/quizzes?status=REVIEWING&sort=modified", icon: ClipboardCheck },
  { id: "processing", name: "AI Processing", href: "/quizzes?status=PROCESSING&sort=modified", icon: Bot },
  { id: "ready", name: "Ready to Publish", href: "/quizzes?status=APPROVED&sort=modified", icon: Sparkles },
  { id: "published", name: "Published Links", href: "/quizzes?status=PUBLISHED&sort=modified", icon: Link2 },
]

export function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  const status = searchParams.get("status")?.toUpperCase()

  const isActive = (id: string) => {
    if (id === "dashboard") return pathname.startsWith("/dashboard")
    if (id === "reviewing") return pathname === "/quizzes" && status === "REVIEWING"
    if (id === "processing") return pathname === "/quizzes" && status === "PROCESSING"
    if (id === "ready") return pathname === "/quizzes" && status === "APPROVED"
    if (id === "published") return pathname === "/quizzes" && status === "PUBLISHED"
    if (id === "all") {
      if (pathname.startsWith("/quiz/")) return true
      return pathname === "/quizzes" && !status
    }
    return false
  }

  return (
    <aside
      className={cn(
        "sticky top-0 h-screen border-r border-sidebar-border/80 bg-sidebar/95 text-sidebar-foreground backdrop-blur transition-[width] duration-200",
        sidebarCollapsed ? "w-[84px]" : "w-[272px]"
      )}
    >
      <div className="flex h-full flex-col">
        <div className={cn("flex h-16 items-center px-3", sidebarCollapsed ? "justify-center" : "justify-between")}>
          <div className={cn("min-w-0", sidebarCollapsed && "hidden")}>
            <p className="truncate text-lg font-semibold tracking-tight text-sidebar-foreground">Quizzer</p>
            <p className="truncate text-xs text-sidebar-foreground/65">Workspace</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
            className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </Button>
        </div>

        {!sidebarCollapsed && (
          <div className="px-3 pb-2">
            <p className="text-[11px] font-medium tracking-[0.08em] text-sidebar-foreground/55 uppercase">Navigation</p>
          </div>
        )}

        <nav className="space-y-1.5 px-2">
          {items.map((item) => {
            const Icon = item.icon
            const active = isActive(item.id)

            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={sidebarCollapsed ? item.name : undefined}
                className={cn(
                  "group flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border shadow-sm"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon size={17} className={cn("shrink-0 transition-transform group-hover:scale-105", active && "text-sidebar-accent-foreground")} />
                {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
