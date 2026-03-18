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
  CommandShortcut,
} from "@/components/ui/command"
import { NAV_ACTIONS, NAV_SECTIONS } from "./nav-config"
import { useUIStore } from "@/stores/useUIStore"

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

  const runAction = (eventName?: string, route?: string) => {
    setCommandOpen(false)
    if (route) router.push(route)
    if (eventName) {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent(eventName))
      }, 120)
    }
  }

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Search pages and actions..." />
      <CommandList>
        <CommandEmpty>No matching command.</CommandEmpty>
        {NAV_SECTIONS.map((section) => (
          <CommandGroup key={section.id} heading={section.title}>
            {section.items.map((item) => (
              <CommandItem key={item.id} onSelect={() => navigate(item.href)}>
                <item.icon />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Quick actions">
          {NAV_ACTIONS.map((action) => (
            <CommandItem key={action.id} onSelect={() => runAction(action.event, action.href)}>
              <action.icon />
              {action.label}
              {action.shortcut ? <CommandShortcut>{action.shortcut}</CommandShortcut> : null}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
