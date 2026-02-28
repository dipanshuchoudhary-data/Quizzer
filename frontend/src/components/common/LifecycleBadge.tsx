import { StatusBadge } from "./StatusBadge"

export function LifecycleBadge({ lifecycle }: { lifecycle: string }) {
  return <StatusBadge status={lifecycle} />
}
