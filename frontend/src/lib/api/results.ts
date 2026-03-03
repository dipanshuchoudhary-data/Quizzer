import { api } from "@/lib/api/client"
import type { Result } from "@/types/result"

export const resultsApi = {
  async getResults(quizId: string): Promise<Result[]> {
    const { data } = await api.get<Result[]>(`/results/${quizId}`)
    return data
  },

  async exportResults(quizId: string, format: "csv" | "excel"): Promise<{ message: string; task_id: string }> {
    const { data } = await api.post<{ message: string; task_id: string }>(`/results/${quizId}/export`, {
      format,
    })
    return data
  },
}

