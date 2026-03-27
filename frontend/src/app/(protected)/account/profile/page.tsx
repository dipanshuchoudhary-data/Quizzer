"use client"

import Link from "next/link"
import { useEffect } from "react"
import { useAuthStore } from "@/stores/useAuthStore"
import { useAccountSettingsStore } from "@/stores/useAccountSettingsStore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { getDisplayName, getInitials } from "@/lib/user"

export default function AccountProfilePage() {
  const { user } = useAuthStore()
  const { hydrated, profile, hydrate } = useAccountSettingsStore()

  useEffect(() => {
    hydrate(user)
  }, [hydrate, user])

  const name = getDisplayName(user)
  const initials = getInitials(name)
  const avatarUrl = user?.avatar_thumbnail_url || user?.avatar_url || profile.avatar_thumbnail_url || profile.avatar_url || ""

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="text-sm text-muted-foreground">View your profile and jump to account settings.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hydrated ? <p className="text-sm text-muted-foreground">Loading profile...</p> : null}
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{name}</p>
              <p className="text-sm text-muted-foreground">{profile.email || user?.email || "-"}</p>
            </div>
          </div>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <p><span className="text-muted-foreground">Institution:</span> {profile.institution || "-"}</p>
            <p><span className="text-muted-foreground">Timezone:</span> {profile.timezone || "-"}</p>
          </div>
          <Link href="/account/settings">
            <Button>Open Account Settings</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
