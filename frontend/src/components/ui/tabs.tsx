"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type TabsContextValue = {
  value: string
  setValue: (next: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabsContext() {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error("Tabs components must be used within <Tabs />")
  }
  return context
}

type TabsProps = React.ComponentProps<"div"> & {
  defaultValue?: string
  value?: string
  onValueChange?: (next: string) => void
}

function Tabs({ defaultValue = "", value: controlledValue, onValueChange, className, ...props }: TabsProps) {
  const [value, setValue] = React.useState(defaultValue)
  const isControlled = typeof controlledValue === "string"
  const currentValue = isControlled ? controlledValue : value

  const setNextValue = (next: string) => {
    if (!isControlled) setValue(next)
    onValueChange?.(next)
  }

  return (
    <TabsContext.Provider value={{ value: currentValue, setValue: setNextValue }}>
      <div className={cn("w-full", className)} {...props} />
    </TabsContext.Provider>
  )
}

function TabsList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex h-10 max-w-full items-center gap-1 rounded-xl border border-border/70 bg-muted/70 p-1 shadow-sm",
        className
      )}
      {...props}
    />
  )
}

type TabsTriggerProps = React.ComponentProps<"button"> & {
  value: string
}

function TabsTrigger({ value, className, onClick, ...props }: TabsTriggerProps) {
  const context = useTabsContext()
  const active = context.value === value

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={(event) => {
        context.setValue(value)
        onClick?.(event)
      }}
      className={cn(
        "inline-flex h-8 items-center rounded-lg px-3 text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "bg-background text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
          : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

type TabsContentProps = React.ComponentProps<"div"> & {
  value: string
}

function TabsContent({ value, className, ...props }: TabsContentProps) {
  const context = useTabsContext()
  if (context.value !== value) {
    return null
  }

  return <div role="tabpanel" className={cn("mt-4", className)} {...props} />
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
