import { Badge } from "@/components/ui/badge"

const badgeMap: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground" },
  NOT_STARTED: { label: "Draft", className: "bg-muted text-muted-foreground" },
  PROCESSING: { label: "Processing", className: "border border-border bg-background text-foreground" },
  GENERATED: { label: "Generated", className: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200" },
  REVIEWING: { label: "Reviewing", className: "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200" },
  APPROVED: { label: "Approved", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200" },
  PUBLISHED: { label: "Published", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200" },
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
