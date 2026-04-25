"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ReviewPage } from "@/features/quiz/review/ReviewPage"
import { LinksPage } from "@/features/quiz/links/LinksPage"
import { MonitoringPage } from "@/features/quiz/monitor/MonitoringPage"
import { ResultsPage } from "@/features/quiz/results/ResultsPage"
import { SettingsPage } from "@/features/quiz/settings/SettingsPage"

const tabValues = ["questions", "monitoring", "results", "links", "settings"] as const

type QuizTab = (typeof tabValues)[number]

function isQuizTab(value: string | null): value is QuizTab {
  return Boolean(value) && tabValues.includes(value as QuizTab)
}

export function QuizTabs({ quizId }: { quizId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeFromQuery = useMemo(() => {
    const value = searchParams.get("tab")
    return isQuizTab(value) ? value : "questions"
  }, [searchParams])

  const [activeTab, setActiveTab] = useState<QuizTab>(activeFromQuery)

  useEffect(() => {
    setActiveTab(activeFromQuery)
  }, [activeFromQuery])

  const updateTab = (next: string) => {
    if (!isQuizTab(next)) return
    setActiveTab(next)
    const params = new URLSearchParams(searchParams.toString())
    if (next === "questions") params.delete("tab")
    else params.set("tab", next)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <Tabs value={activeTab} onValueChange={updateTab} className="w-full accent-divider-bar pt-3">
      <TabsList className="surface-gradient-muted flex h-auto w-full flex-wrap gap-2 overflow-x-auto whitespace-nowrap rounded-xl border-border/70">
        <TabsTrigger value="questions">Questions</TabsTrigger>
        <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        <TabsTrigger value="results">Results</TabsTrigger>
        <TabsTrigger value="links">Links</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="questions">
        <ReviewPage quizId={quizId} />
      </TabsContent>
      <TabsContent value="monitoring">
        <MonitoringPage quizId={quizId} />
      </TabsContent>
      <TabsContent value="results">
        <ResultsPage quizId={quizId} />
      </TabsContent>
      <TabsContent value="links">
        <LinksPage quizId={quizId} />
      </TabsContent>
      <TabsContent value="settings">
        <SettingsPage quizId={quizId} />
      </TabsContent>
    </Tabs>
  )
}
