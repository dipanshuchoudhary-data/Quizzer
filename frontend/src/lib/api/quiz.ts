import { api } from "@/lib/api/client"
import { env } from "@/lib/env"
import type { Quiz } from "@/types/quiz"

export interface CreateQuizPayload {
  title: string
  description: string
  academic_type?: "college" | "school"
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
  if (quiz.is_published) {
    return { ...quiz, ai_generation_status: "PUBLISHED" }
  }

  if (quiz.ai_generation_status === "APPROVED") {
    return { ...quiz, ai_generation_status: "APPROVED" }
  }

  if (quiz.ai_generation_status === "GENERATED") {
    return { ...quiz, ai_generation_status: "REVIEWING" }
  }

  if (quiz.ai_generation_status === "NOT_STARTED") {
    return { ...quiz, ai_generation_status: "DRAFT" }
  }

  return quiz
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
    })
    return normalizeLifecycle(data)
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
