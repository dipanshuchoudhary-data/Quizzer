"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useUIStore } from "@/stores/useUIStore"

const quickNav = [
  { label: "Go to Dashboard", href: "/dashboard" },
  { label: "Go to Exams", href: "/exams" },
  { label: "Go to Students", href: "/students" },
  { label: "Go to Analytics", href: "/analytics" },
  { label: "Go to Settings", href: "/settings" },
]

export function CommandPalette() {
  const router = useRouter()
  const { commandOpen, setCommandOpen } = useUIStore()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setCommandOpen(!commandOpen)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [commandOpen, setCommandOpen])

  const navigate = (href: string) => {
    setCommandOpen(false)
    router.push(href)
  }

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Search pages and actions..." />
      <CommandList>
        <CommandEmpty>No matching command.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {quickNav.map((item) => (
            <CommandItem key={item.href} onSelect={() => navigate(item.href)}>
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => navigate("/quizzes/create")}>Create quiz</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
