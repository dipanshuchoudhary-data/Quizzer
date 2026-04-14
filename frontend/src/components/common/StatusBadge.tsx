import { Badge } from "@/components/ui/badge"

const badgeMap: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground" },
  NOT_STARTED: { label: "Draft", className: "bg-muted text-muted-foreground" },
  PROCESSING: { label: "Processing", className: "border border-border bg-background text-foreground" },
  GENERATED: { label: "Generated", className: "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200" },
  REVIEWING: { label: "Reviewing", className: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200" },
  APPROVED: { label: "Approved", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200" },
  PUBLISHED: { label: "Published", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200" },
  LIVE: { label: "Live", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200" },
  CLOSED: { label: "Closed", className: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200" },
  PENDING: { label: "Pending", className: "border border-border bg-background text-foreground" },
  FAILED: { label: "Failed", className: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200" },
  COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200" },
}

export function StatusBadge({ status }: { status: string }) {
  const key = status.toUpperCase()
  const mapped = badgeMap[key] ?? { label: status, className: "border border-border bg-background text-foreground" }
  return <Badge className={mapped.className}>{mapped.label}</Badge>
}
