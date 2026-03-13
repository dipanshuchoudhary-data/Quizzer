"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ReviewPage } from "@/features/quiz/review/ReviewPage"
import { MonitoringPage } from "@/features/quiz/monitor/MonitoringPage"
import { ResultsPage } from "@/features/quiz/results/ResultsPage"
import { LinksPage } from "@/features/quiz/links/LinksPage"
import { SettingsPage } from "@/features/quiz/settings/SettingsPage"

export function QuizTabs({ quizId }: { quizId: string }) {
  return (
    <Tabs defaultValue="questions" className="w-full">
      <TabsList className="flex h-auto flex-wrap gap-2">
        <TabsTrigger value="questions">Questions</TabsTrigger>
        <TabsTrigger value="links">Links</TabsTrigger>
        <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        <TabsTrigger value="results">Results</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="questions">
        <ReviewPage quizId={quizId} />
      </TabsContent>
      <TabsContent value="links">
        <LinksPage quizId={quizId} />
      </TabsContent>
      <TabsContent value="monitoring">
        <MonitoringPage quizId={quizId} />
      </TabsContent>
      <TabsContent value="results">
        <ResultsPage quizId={quizId} />
      </TabsContent>
      <TabsContent value="settings">
        <SettingsPage quizId={quizId} />
      </TabsContent>
    </Tabs>
  )
}

