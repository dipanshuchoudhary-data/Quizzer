import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:brightness-105 active:scale-[0.96]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90 dark:bg-white dark:text-black dark:hover:bg-zinc-200",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground dark:border-[var(--border-color)] dark:bg-[var(--bg-secondary)] dark:text-[var(--text-primary)] dark:hover:bg-[var(--card-hover)] dark:hover:text-[var(--text-primary)]",
        secondary: "bg-secondary text-secondary-foreground hover:opacity-90 dark:bg-[var(--bg-secondary)] dark:text-[var(--text-primary)] dark:hover:bg-[var(--bg-tertiary)]",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-white hover:opacity-90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>

function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
