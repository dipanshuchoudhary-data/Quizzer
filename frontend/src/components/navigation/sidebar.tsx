"use client"

import { useEffect } from "react"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useUIStore } from "@/stores/useUIStore"
import { cn } from "@/lib/utils"
import { NAV_SECTIONS } from "./nav-config"
import { NavItemRow } from "./nav-item"
import { Button } from "@/components/ui/button"

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore()

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
          "fixed inset-0 z-30 bg-black/30 backdrop-blur-sm transition-opacity duration-200 md:hidden",
          mobileSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setMobileSidebarOpen(false)}
        role="presentation"
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-screen min-h-0 flex-col border-r border-sidebar-border/80 bg-sidebar text-sidebar-foreground transition-all duration-200 md:sticky md:top-0",
          sidebarCollapsed ? "w-[84px]" : "w-[272px]",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between px-3">
          <div className={cn("min-w-0", sidebarCollapsed && "hidden")}>
            <p className="truncate text-lg font-semibold tracking-tight text-sidebar-foreground">Quizzer</p>
            <p className="truncate text-xs text-sidebar-foreground/65">Professor Workspace</p>
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

        <nav
          className="sidebar-scroll flex-1 min-h-0 space-y-6 overflow-y-auto bg-sidebar px-2 pb-6"
          aria-label="Primary"
        >
          {NAV_SECTIONS.map((section) => (
            <div key={section.id} className="space-y-2">
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
      </aside>
    </>
  )
}
