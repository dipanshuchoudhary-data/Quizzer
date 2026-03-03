import { api } from "@/lib/api/client"

export interface AIJob {
  id?: string
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | string
  metadata?: Record<string, unknown>
}

export const aiApi = {
  async triggerGeneration(
    quizId: string,
    payload: { extracted_text: string; blueprint: Record<string, unknown>; professor_note?: string }
  ): Promise<{ message: string; job_id?: string }> {
    const { data } = await api.post<{ message: string; job_id?: string }>(`/quizzes/${quizId}/generate-ai`, payload)
    return data
  },

  async getJobStatus(jobId: string): Promise<AIJob> {
    const { data } = await api.get<AIJob>(`/ai/jobs/${jobId}`)
    return data
  },
}

