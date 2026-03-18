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
      className={cn("inline-flex items-center gap-1 rounded-md border bg-muted p-1", className)}
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
        "rounded px-3 py-1.5 text-sm transition",
        active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
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
