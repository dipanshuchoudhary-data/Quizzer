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
          "flex h-10 items-center gap-3 rounded-lg px-2 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
          active
            ? "bg-[var(--sidebar-accent)] text-[var(--brand-accent)] border-l-[3px] border-l-[var(--brand-accent)] rounded-l-none"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
        )}
      >
        <span
          className={cn(
            "inline-flex size-5 items-center justify-center transition-colors duration-150",
            active
              ? "text-[var(--brand-accent)]"
              : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
          )}
        >
          <Icon className="size-[18px]" />
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
