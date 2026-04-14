"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"

interface BrandProps {
  className?: string
  logoClassName?: string
  titleClassName?: string
  subtitleClassName?: string
  subtitle?: string
  compact?: boolean
}

export function Brand({
  className,
  logoClassName,
  titleClassName,
  subtitleClassName,
  subtitle,
  compact = false,
}: BrandProps) {
  return (
    <div className={cn("brand-wrap flex min-w-0 items-center gap-2.5", className)}>
      <Image
        src="/logo.svg"
        alt="Quizzer logo"
        width={compact ? 26 : 34}
        height={compact ? 26 : 34}
        className={cn("brand-logo shrink-0 rounded-md", logoClassName)}
        priority
      />
      <div className="min-w-0">
        <p className={cn("brand-title truncate text-lg font-semibold tracking-tight", titleClassName)}>Quizzer</p>
        {subtitle ? <p className={cn("truncate text-xs", subtitleClassName)}>{subtitle}</p> : null}
      </div>
    </div>
  )
}

