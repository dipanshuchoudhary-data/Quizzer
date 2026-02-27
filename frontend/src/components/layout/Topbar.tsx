"use client"

import { useRouter } from "next/navigation"
import { Moon, Plus, Search, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useAuthStore } from "@/stores/useAuthStore"
import { useUIStore } from "@/stores/useUIStore"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function Topbar() {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const { user, logout } = useAuthStore()
  const setCommandOpen = useUIStore((state) => state.setCommandOpen)

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "PR"

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-background/90 px-6 backdrop-blur">
      <div className="relative hidden w-full max-w-md md:block">
        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search quizzes, sections, attempts..." onFocus={() => setCommandOpen(true)} />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" onClick={() => setCommandOpen(true)}>
          Command
        </Button>

        <Button onClick={() => router.push("/quizzes?create=1")}>
          <Plus className="mr-2 size-4" />
          Create Quiz
        </Button>

        <Button
          size="icon"
          variant="ghost"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </Button>

        <Button variant="ghost" className="px-2" onClick={() => void logout().then(() => router.replace("/login"))}>
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </div>
    </header>
  )
}
