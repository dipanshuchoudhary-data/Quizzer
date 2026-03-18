"use client"

import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function PageShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div key={pathname} className={cn("page-transition")}>
      {children}
    </div>
  )
}
