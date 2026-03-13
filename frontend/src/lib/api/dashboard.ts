import { api } from "@/lib/api/client"

export interface DashboardSummary {
  stats: {
    total_quizzes: number
    published_exams: number
    active_exams: number
    ai_jobs_running: number
  }
  recent_quizzes: Array<{
    id: string
    title: string
    description: string | null
    ai_generation_status: string
    is_published: boolean
    is_archived: boolean
    duration_minutes: number
    question_count: number
    updated_at?: string
  }>
  active_exams: Array<{
    id: string
    title: string
    active_students: number
    violations_count: number
    submissions_count: number
    time_remaining_seconds: number | null
  }>
  recent_activity: Array<{
    id: string
    title: string
    event: string
    updated_at?: string
  }>
  running_jobs: Array<{
    id: string
    quiz_id: string
    quiz_title: string
    created_at?: string
    progress: number
    stage: string
    estimated_seconds: number
  }>
}

export interface LiveExamsResponse {
  items: Array<{
    quiz_id: string
    quiz_name: string
    active_students: number
    violations_count: number
    submissions_count: number
    time_remaining_seconds: number | null
    students: Array<{
      attempt_id: string
      student_name: string
      current_question: number
      violations: number
      status: string
      time_remaining_seconds: number
    }>
  }>
  alerts: Array<{
    quiz_id: string
    quiz_name: string
    message: string
    severity: "warning" | "critical" | string
  }>
}

export interface AnalyticsResponse {
  metrics: {
    total_attempts: number
    completion_rate: number
    average_score: number
    total_violations: number
    highest_score: number
    lowest_score: number
  }
  score_distribution: Array<{
    quiz_name: string
    average_score: number
    highest_score: number
    lowest_score: number
  }>
  table: Array<{
    quiz_id: string
    quiz_name: string
    attempts: number
    average_score: number
    completion_rate: number
    violations: number
  }>
}

export const dashboardApi = {
  async getSummary(): Promise<DashboardSummary> {
    const { data } = await api.get<DashboardSummary>("/dashboard/summary")
    return data
  },

  async getLiveExams(): Promise<LiveExamsResponse> {
    const { data } = await api.get<LiveExamsResponse>("/dashboard/live-exams")
    return data
  },

  async getAnalytics(): Promise<AnalyticsResponse> {
    const { data } = await api.get<AnalyticsResponse>("/dashboard/analytics")
    return data
  },
}
