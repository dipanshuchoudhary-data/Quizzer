import { api } from "@/lib/api/client"

export async function publishQuiz(quizId: string) {
  const response = await api.post(`/quizzes/${quizId}/publish`)
  return response.data
}
