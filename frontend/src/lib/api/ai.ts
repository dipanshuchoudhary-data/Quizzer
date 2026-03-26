import { api } from "@/lib/api/client"

export interface AIJob {
  id?: string
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | string
  metadata?: Record<string, unknown>
}

export interface AISourceResponse {
  source_id: string
  status: string
  detail?: string
}

export interface AIGenerationResponse {
  message: string
  job_id: string
}

// Longer timeout for AI operations (2 minutes)
const AI_TIMEOUT = 120000

export const aiApi = {
  async triggerGeneration(
    quizId: string,
    payload: { extracted_text: string; blueprint: Record<string, unknown>; professor_note?: string }
  ): Promise<{ message: string; job_id?: string }> {
    const { data } = await api.post<{ message: string; job_id?: string }>(`/quizzes/${quizId}/generate-ai`, payload, {
      timeout: AI_TIMEOUT,
    })
    return data
  },

  async getJobStatus(jobId: string): Promise<AIJob> {
    const { data } = await api.get<AIJob>(`/ai/jobs/${jobId}`)
    return data
  },

  async uploadSourceText(quizId: string, text: string): Promise<AISourceResponse> {
    const { data } = await api.post<AISourceResponse>("/ai/quiz/source/text", { quiz_id: quizId, text }, {
      timeout: AI_TIMEOUT,
    })
    return data
  },

  async uploadSourceUrls(quizId: string, urls: string[]): Promise<AISourceResponse> {
    const { data } = await api.post<AISourceResponse>("/ai/quiz/source/url", { quiz_id: quizId, urls }, {
      timeout: AI_TIMEOUT,
    })
    return data
  },

  async uploadSourceFiles(quizId: string, files: File[]): Promise<{ documents: Array<{ id: string; file_name: string }> }> {
    const form = new FormData()
    form.append("quiz_id", quizId)
    files.forEach((file) => form.append("files", file))
    const { data } = await api.post<{ documents: Array<{ id: string; file_name: string }> }>("/ai/quiz/source/files", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: AI_TIMEOUT,
    })
    return data
  },

  async getSourceDocuments(quizId: string): Promise<{ documents: Array<Record<string, unknown>> }> {
    const { data } = await api.get<{ documents: Array<Record<string, unknown>> }>(`/ai/quiz/source/files/${quizId}`)
    return data
  },

  async generateQuiz(quizId: string, payload: { blueprint: Record<string, unknown>; professor_note?: string; source_mode?: string }): Promise<AIGenerationResponse> {
    const { data } = await api.post<AIGenerationResponse>("/ai/quiz/generate", { quiz_id: quizId, ...payload }, {
      timeout: AI_TIMEOUT,
    })
    return data
  },
}

