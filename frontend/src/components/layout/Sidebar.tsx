"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { BarChart3, GraduationCap, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Settings, Users } from "lucide-react"
import { useUIStore } from "@/stores/useUIStore"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Brand } from "@/components/branding/brand"

const items = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Exams", href: "/exams", icon: GraduationCap },
  { name: "Students", href: "/students", icon: Users },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  const isActive = (href: string) => {
    if (href === "/exams" && pathname.startsWith("/quiz/")) return true
    return pathname === href || pathname.startsWith(`${href}/`)
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
            <Brand
              compact
              subtitle="Professor Workspace"
              titleClassName="text-sidebar-foreground"
              subtitleClassName="text-sidebar-foreground/65"
            />
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

        <nav className="space-y-1.5 px-2">
          {items.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <motion.div key={item.name} whileHover={{ y: -1 }} transition={{ duration: 0.15 }}>
                <Link
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
                  <Icon size={17} className="shrink-0 transition-transform group-hover:scale-105" />
                  {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
                </Link>
              </motion.div>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
