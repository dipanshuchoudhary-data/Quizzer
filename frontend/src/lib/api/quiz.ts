import { api } from "@/lib/api/client"
import { env } from "@/lib/env"
import { defaultQuizExamSettings, type Quiz, type QuizExamSettings } from "@/types/quiz"

export interface CreateQuizPayload {
  title: string
  description: string
  academic_type?: "college" | "school"
  duration_minutes?: number
}

export interface GenerateQuizPayload {
  extracted_text: string
  blueprint: Record<string, unknown>
  professor_note?: string
}

export interface InitStreamQuizResponse {
  message: string
  job_id: string
}

export interface SourceReference {
  type: string
  label: string
  url?: string
  content?: string
  note?: string
}

function normalizeLifecycle(quiz: Quiz): Quiz {
  const normalizedQuiz = {
    ...quiz,
    duration_minutes: quiz.duration_minutes ?? defaultQuizExamSettings.duration,
    question_count: quiz.question_count ?? 0,
    is_archived: quiz.is_archived ?? false,
  }

  if (quiz.is_published) {
    return { ...normalizedQuiz, ai_generation_status: "PUBLISHED" }
  }

  if (quiz.ai_generation_status === "APPROVED") {
    return { ...normalizedQuiz, ai_generation_status: "APPROVED" }
  }

  if (quiz.ai_generation_status === "GENERATED") {
    return { ...normalizedQuiz, ai_generation_status: "REVIEWING" }
  }

  if (quiz.ai_generation_status === "NOT_STARTED") {
    return { ...normalizedQuiz, ai_generation_status: "DRAFT" }
  }

  return normalizedQuiz
}

export const quizApi = {
  async getAll(): Promise<Quiz[]> {
    const { data } = await api.get<Quiz[]>("/quizzes")
    return data.map(normalizeLifecycle)
  },

  async getById(id: string): Promise<Quiz> {
    const { data } = await api.get<Quiz>(`/quizzes/${id}`)
    return normalizeLifecycle(data)
  },

  async create(payload: CreateQuizPayload): Promise<Quiz> {
    const { data } = await api.post<Quiz>("/quizzes", {
      ...payload,
      academic_type: payload.academic_type ?? "college",
      duration_minutes: payload.duration_minutes ?? 60,
    })
    return normalizeLifecycle(data)
  },

  async update(id: string, payload: Partial<Pick<Quiz, "title" | "description" | "duration_minutes" | "is_archived">>): Promise<Quiz> {
    const { data } = await api.patch<Quiz>(`/quizzes/${id}`, payload)
    return normalizeLifecycle(data)
  },

  async getSettings(id: string): Promise<QuizExamSettings> {
    const { data } = await api.get<QuizExamSettings>(`/quizzes/${id}/settings`)
    return { ...defaultQuizExamSettings, ...data }
  },

  async updateSettings(id: string, payload: Partial<QuizExamSettings>): Promise<QuizExamSettings> {
    const { data } = await api.patch<QuizExamSettings>(`/quizzes/${id}/settings`, payload)
    return { ...defaultQuizExamSettings, ...data }
  },

  async deleteById(id: string): Promise<{ message: string }> {
    const { data } = await api.delete<{ message: string }>(`/quizzes/${id}`)
    return data
  },

  async publish(id: string): Promise<{ message: string; public_slug?: string; public_url?: string }> {
    const { data } = await api.post<{ message: string; public_slug?: string; public_url?: string }>(`/quizzes/${id}/publish`)
    return data
  },

  async unpublish(id: string): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>(`/quizzes/${id}/unpublish`)
    return data
  },

  async archive(id: string): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>(`/quizzes/${id}/archive`)
    return data
  },

  async unarchive(id: string): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>(`/quizzes/${id}/unarchive`)
    return data
  },

  async generate(id: string, payload: GenerateQuizPayload): Promise<{ message: string; job_id?: string }> {
    const { data } = await api.post<{ message: string; job_id?: string }>(`/quizzes/${id}/generate`, payload)
    return data
  },

  async initStream(id: string, payload: GenerateQuizPayload): Promise<InitStreamQuizResponse> {
    const { data } = await api.post<InitStreamQuizResponse>(`/quizzes/${id}/generate-stream/init`, payload)
    return data
  },

  streamUrl(id: string, jobId: string): string {
    const params = new URLSearchParams({ job_id: jobId })
    return `${env.apiUrl}/quizzes/${id}/generate-stream?${params.toString()}`
  },

  async getSourceReferences(id: string): Promise<SourceReference[]> {
    const { data } = await api.get<{ items: SourceReference[] }>(`/quizzes/${id}/source-references`)
    return data.items ?? []
  },
}
