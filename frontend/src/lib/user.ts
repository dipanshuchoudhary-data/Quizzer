import type { User } from "@/types/user"

export function getDisplayName(user?: User | null) {
  if (!user) return "Professor"
  const full = user.full_name?.trim()
  if (full) return full
  const username = user.username?.trim()
  if (username) return username
  const email = user.email?.trim()
  if (email && email.includes("@")) return email.split("@")[0]
  return "Professor"
}

export function getInitials(name?: string) {
  if (!name) return "PR"
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const initials = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2)
  return initials.toUpperCase() || "PR"
}
