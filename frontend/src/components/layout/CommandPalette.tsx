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
  { label: "Go to Quizzes", href: "/quizzes" },
  { label: "Go to Monitoring", href: "/monitoring" },
  { label: "Go to Results", href: "/results" },
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

  const runAction = (eventName: string, route?: string) => {
    setCommandOpen(false)
    if (route) router.push(route)
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(eventName))
    }, 100)
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
          <CommandItem onSelect={() => navigate("/quizzes?create=1")}>Create quiz</CommandItem>
          <CommandItem onSelect={() => runAction("quizzer:search-focus", "/quizzes")}>Search quiz</CommandItem>
          <CommandItem onSelect={() => runAction("quizzer:bulk-publish", "/quizzes")}>Publish selected quiz</CommandItem>
          <CommandItem onSelect={() => runAction("quizzer:bulk-regenerate", "/quizzes")}>AI regenerate questions</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
