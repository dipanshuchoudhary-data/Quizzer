"use client"

import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function PageShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div key={pathname} className={cn("page-transition mx-auto max-w-[1400px] space-y-6 px-4 py-4 sm:px-6 sm:py-6")}>
      {children}
    </div>
  )
}
