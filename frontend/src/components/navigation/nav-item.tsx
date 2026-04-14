"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { NavItem } from "./nav-config"
import { cn } from "@/lib/utils"

interface NavItemProps {
  item: NavItem
  collapsed: boolean
  onNavigate?: () => void
}

export function NavItemRow({ item, collapsed, onNavigate }: NavItemProps) {
  const pathname = usePathname()
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
  const Icon = item.icon

  return (
    <div className="group relative">
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_8px_20px_rgba(15,23,42,0.12)] ring-1 ring-sidebar-border"
            : "text-sidebar-foreground/80 hover:-translate-y-[1px] hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
        )}
      >
        <span
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent transition-all duration-200",
            active
              ? "bg-background/80 text-foreground"
              : "bg-sidebar/80 text-sidebar-foreground/70 group-hover:scale-[1.04] group-hover:bg-background/70"
          )}
        >
          <Icon className="size-4" />
        </span>
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
      {collapsed ? (
        <div className="pointer-events-none absolute left-full top-1/2 z-40 ml-2 -translate-y-1/2 opacity-0 transition-all duration-150 group-hover:opacity-100">
          <div className="rounded-lg border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md">
            {item.label}
          </div>
        </div>
      ) : null}
    </div>
  )
}
