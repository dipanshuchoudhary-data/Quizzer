import { api } from "@/lib/api/client"
import type { Attempt } from "@/types/attempt"

export const monitoringApi = {
  async getAttempts(quizId: string): Promise<Attempt[]> {
    const { data } = await api.get<Attempt[]>(`/monitoring/${quizId}/attempts`)
    return data
  },
}

