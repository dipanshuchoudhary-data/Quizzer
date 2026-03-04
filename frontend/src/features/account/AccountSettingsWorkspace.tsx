"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "next-themes"
import { useAuthStore } from "@/stores/useAuthStore"
import { useAccountSettingsStore } from "@/stores/useAccountSettingsStore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

const tabs = ["profile", "preferences", "workspace", "security", "notifications", "integrations"] as const
type SettingsTab = (typeof tabs)[number]

function isSettingsTab(value: string | null): value is SettingsTab {
  return Boolean(value) && tabs.includes(value as SettingsTab)
}

export function AccountSettingsWorkspace() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { setTheme } = useTheme()
  const { user, logout } = useAuthStore()

  const {
    hydrated,
    saveState,
    profile,
    preferences,
    notifications,
    workspace,
    security,
    hydrate,
    setSaveState,
    patchProfile,
    patchPreferences,
    patchNotifications,
    patchWorkspace,
    patchSecurity,
  } = useAccountSettingsStore()

  const saveTimer = useRef<number | null>(null)
  const routeTab = searchParams.get("tab")
  const initialTab: SettingsTab = isSettingsTab(routeTab) ? routeTab : "profile"
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)

  useEffect(() => {
    hydrate(user?.email)
  }, [hydrate, user?.email])

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [])

  const saveLabel = useMemo(() => {
    if (saveState === "saving") return "Saving..."
    if (saveState === "saved") return "Saved"
    return "All changes are local for now."
  }, [saveState])

  const updateTab = (tab: SettingsTab) => {
    const next = new URLSearchParams(searchParams.toString())
    next.set("tab", tab)
    router.replace(`${pathname}?${next.toString()}`)
    setActiveTab(tab)
  }

  const commit = (action: () => void) => {
    action()
    setSaveState("saving")
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      setSaveState("saved")
      saveTimer.current = window.setTimeout(() => setSaveState("idle"), 1200)
    }, 450)
  }

  const displayName = profile.name || (user?.email ? user.email.split("@")[0] : "Professor")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Account Settings</h1>
          <p className="text-sm text-muted-foreground">Manage profile, workspace behavior, security, and integrations.</p>
        </div>
        <div className="rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">{saveLabel}</div>
      </div>

      <Tabs key={activeTab} defaultValue={activeTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="profile" onClick={() => updateTab("profile")}>Profile</TabsTrigger>
          <TabsTrigger value="preferences" onClick={() => updateTab("preferences")}>Preferences</TabsTrigger>
          <TabsTrigger value="workspace" onClick={() => updateTab("workspace")}>Workspace</TabsTrigger>
          <TabsTrigger value="security" onClick={() => updateTab("security")}>Security</TabsTrigger>
          <TabsTrigger value="notifications" onClick={() => updateTab("notifications")}>Notifications</TabsTrigger>
          <TabsTrigger value="integrations" onClick={() => updateTab("integrations")}>Integrations</TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.16 }}
          >
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Profile Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!hydrated ? <p className="text-sm text-muted-foreground">Loading profile...</p> : null}
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input value={profile.name} placeholder="Name" onChange={(e) => commit(() => patchProfile({ name: e.target.value }))} />
                    <Input value={profile.email} placeholder="Email" onChange={(e) => commit(() => patchProfile({ email: e.target.value }))} />
                    <Input
                      value={profile.institution}
                      placeholder="Institution / Organization"
                      onChange={(e) => commit(() => patchProfile({ institution: e.target.value }))}
                    />
                    <Input value={profile.timezone} placeholder="Timezone" onChange={(e) => commit(() => patchProfile({ timezone: e.target.value }))} />
                    <Input
                      className="md:col-span-2"
                      value={profile.avatar_url}
                      placeholder="Profile picture URL"
                      onChange={(e) => commit(() => patchProfile({ avatar_url: e.target.value }))}
                    />
                  </div>
                  <Button onClick={() => commit(() => patchProfile({ name: displayName }))}>Update Profile</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preferences">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Appearance</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    <Select
                      value={preferences.theme}
                      onValueChange={(value) =>
                        commit(() => {
                          patchPreferences({ theme: value as "light" | "dark" | "system" })
                          setTheme(value)
                        })
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Theme mode" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={preferences.density}
                      onValueChange={(value) => commit(() => patchPreferences({ density: value as "comfortable" | "compact" }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Layout density" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comfortable">Comfortable</SelectItem>
                        <SelectItem value="compact">Compact</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={preferences.font_scale}
                      onValueChange={(value) => commit(() => patchPreferences({ font_scale: value as "small" | "normal" | "large" }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Font size" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="workspace">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Workspace Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="font-medium">Strict publishing checks</p>
                      <p className="text-sm text-muted-foreground">Require complete validation before publish.</p>
                    </div>
                    <Switch
                      checked={workspace.strict_publish_checks}
                      onCheckedChange={(checked) => commit(() => patchWorkspace({ strict_publish_checks: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="font-medium">AI generation safety mode</p>
                      <p className="text-sm text-muted-foreground">Keep stricter schema and guardrails enabled.</p>
                    </div>
                    <Switch checked={workspace.ai_safety_mode} onCheckedChange={(checked) => commit(() => patchWorkspace({ ai_safety_mode: checked }))} />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="font-medium">Auto-save review edits</p>
                      <p className="text-sm text-muted-foreground">Persist question edits automatically while reviewing.</p>
                    </div>
                    <Switch checked={workspace.autosave_review} onCheckedChange={(checked) => commit(() => patchWorkspace({ autosave_review: checked }))} />
                  </div>
                  <Separator />
                  <div className="grid gap-3 md:grid-cols-3">
                    <Input
                      type="number"
                      min={1}
                      value={workspace.default_marks}
                      onChange={(e) => commit(() => patchWorkspace({ default_marks: Math.max(1, Number(e.target.value || 1)) }))}
                      placeholder="Default question marks"
                    />
                    <Input
                      type="number"
                      min={5}
                      value={workspace.default_quiz_duration_minutes}
                      onChange={(e) =>
                        commit(() => patchWorkspace({ default_quiz_duration_minutes: Math.max(5, Number(e.target.value || 60)) }))
                      }
                      placeholder="Default quiz duration (min)"
                    />
                    <Input
                      type="number"
                      min={1}
                      value={workspace.default_warning_threshold_minutes}
                      onChange={(e) =>
                        commit(() => patchWorkspace({ default_warning_threshold_minutes: Math.max(1, Number(e.target.value || 5)) }))
                      }
                      placeholder="Warning threshold (min)"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Security Controls</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline">Change Password</Button>
                      <Button variant="outline">View Active Sessions</Button>
                      <Button variant="outline" onClick={() => void logout().then(() => router.replace("/login"))}>
                        Logout from All Sessions
                      </Button>
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="font-medium">Two-factor authentication</p>
                        <p className="text-sm text-muted-foreground">Future-ready placeholder for MFA enablement.</p>
                      </div>
                      <Switch
                        checked={security.two_factor_enabled}
                        onCheckedChange={(checked) => commit(() => patchSecurity({ two_factor_enabled: checked }))}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notifications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { key: "attempts_email", label: "Email notifications for new attempts" },
                    { key: "integrity_alerts", label: "Alerts for integrity violations" },
                    { key: "generation_complete", label: "Quiz generation completed notifications" },
                    { key: "export_complete", label: "Result export notifications" },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between rounded-md border p-3">
                      <p className="font-medium">{item.label}</p>
                      <Switch
                        checked={Boolean(notifications[item.key as keyof typeof notifications])}
                        onCheckedChange={(checked) =>
                          commit(() => patchNotifications({ [item.key]: checked } as Partial<typeof notifications>))
                        }
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="integrations">
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  "Google Classroom",
                  "Slack notifications",
                  "Webhook integrations",
                  "API keys",
                ].map((name) => (
                  <Card key={name}>
                    <CardHeader>
                      <CardTitle className="text-base">{name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">Coming soon</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </div>
  )
}
