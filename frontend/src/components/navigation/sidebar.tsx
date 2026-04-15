"use client"

import { useEffect } from "react"
import { CircleHelp, LayoutDashboard, MessageSquareMore, PanelLeftClose, PanelLeftOpen, Settings2, UserRound } from "lucide-react"
import { useUIStore } from "@/stores/useUIStore"
import { useAuthStore } from "@/stores/useAuthStore"
import { normalizeAppRole } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { NAV_SECTIONS } from "./nav-config"
import { NavItemRow } from "./nav-item"
import { Button } from "@/components/ui/button"
import { Brand } from "@/components/branding/brand"

export function Sidebar() {
  const user = useAuthStore((state) => state.user)
  const normalizedRole = normalizeAppRole(user?.role)
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore()

  const openFeedback = () => {
    window.dispatchEvent(new CustomEvent("quizzer:feedback-open"))
    setMobileSidebarOpen(false)
  }

  const sections =
    normalizedRole === "student"
      ? [
          {
            id: "student-workspace",
            title: "Workspace",
            items: [
              { id: "student-dashboard", label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
              { id: "profile", label: "Profile", href: "/account/profile", icon: UserRound },
              { id: "settings", label: "Settings", href: "/account/settings", icon: Settings2 },
              { id: "help", label: "Help", href: "/help", icon: CircleHelp },
            ],
          },
        ]
      : NAV_SECTIONS

  useEffect(() => {
    if (!mobileSidebarOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileSidebarOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [mobileSidebarOpen, setMobileSidebarOpen])

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-200 lg:hidden",
          mobileSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setMobileSidebarOpen(false)}
        role="presentation"
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-screen min-h-0 max-w-[88vw] flex-col border-r border-sidebar-border/80 bg-sidebar/92 text-sidebar-foreground backdrop-blur-xl transition-all duration-200 lg:sticky lg:top-0 lg:max-w-none",
          sidebarCollapsed ? "lg:w-[84px]" : "w-[272px]",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 lg:px-3">
          <div className={cn("min-w-0", sidebarCollapsed && "hidden lg:block")}>
            <Brand
              compact
              subtitle={normalizedRole === "student" ? "Student Workspace" : "Professor Workspace"}
              titleClassName="text-sidebar-foreground"
              subtitleClassName="text-sidebar-foreground/65"
            />
          </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
              className="hidden text-sidebar-foreground/80 transition hover:scale-[1.03] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:inline-flex"
            >
              {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close navigation"
            className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:hidden"
          >
            <PanelLeftClose size={16} />
          </Button>
        </div>

        <nav
          className="sidebar-scroll flex-1 min-h-0 space-y-6 overflow-y-auto bg-sidebar px-3 pb-6"
          aria-label="Primary"
        >
          {sections.map((section) => (
            <div key={section.id} className="ui-nav-enter space-y-2">
              {!sidebarCollapsed && (
                <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/50">
                  {section.title}
                </p>
              )}
              <div className="space-y-1.5">
                {section.items.map((item) => (
                  <NavItemRow
                    key={item.id}
                    item={item}
                    collapsed={sidebarCollapsed}
                    onNavigate={() => setMobileSidebarOpen(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border/80 px-3 py-3">
          <Button
            type="button"
            variant="ghost"
            onClick={openFeedback}
            className={cn(
              "h-11 w-full justify-start gap-3 rounded-2xl px-3 text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              sidebarCollapsed && "lg:justify-center lg:px-0"
            )}
            aria-label="Open feedback"
            title="Feedback"
          >
            <MessageSquareMore className="size-4 shrink-0" />
            <span className={cn("truncate", sidebarCollapsed && "lg:hidden")}>Feedback</span>
          </Button>
        </div>
      </aside>
    </>
  )
}
