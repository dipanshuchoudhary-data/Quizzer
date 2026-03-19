import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-[color,box-shadow,background-color,border-color] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[var(--bg-secondary)] dark:text-[var(--text-primary)] dark:placeholder:text-[var(--text-muted)] dark:focus-visible:ring-[color:var(--brand-accent)]/35",
          className
        )}
        {...props}
      />
    )
  }
)

Input.displayName = "Input"

export { Input }
