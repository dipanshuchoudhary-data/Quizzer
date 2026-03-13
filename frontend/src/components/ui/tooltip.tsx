"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

function Tooltip({
  content,
  children,
  className,
}: {
  content: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn("group/tooltip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+0.45rem)] left-1/2 z-30 w-max max-w-56 -translate-x-1/2 scale-95 rounded-md border border-border/80 bg-popover px-2.5 py-1.5 text-xs text-popover-foreground opacity-0 shadow-lg transition-[opacity,transform] duration-120 ease-out group-hover/tooltip:scale-100 group-hover/tooltip:opacity-100 group-focus-within/tooltip:scale-100 group-focus-within/tooltip:opacity-100"
      >
        {content}
      </span>
    </span>
  )
}

export { Tooltip }
