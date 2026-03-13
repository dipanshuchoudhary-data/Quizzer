import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden="true" className={cn("skeleton-shimmer rounded-lg bg-muted/70", className)} {...props} />
}

export { Skeleton }
