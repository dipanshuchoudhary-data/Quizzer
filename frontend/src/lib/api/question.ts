import { api } from "@/lib/api/client"
import type { Question } from "@/types/question"

export type QuestionUpdatePayload = Partial<
  Pick<Question, "question_text" | "question_type" | "difficulty" | "marks" | "correct_answer" | "options" | "section_id" | "status" | "order_index">
>

export const questionApi = {
  async getByQuiz(quizId: string): Promise<Question[]> {
    const { data } = await api.get<Question[]>(`/quizzes/${quizId}/questions`)
    return data
  },

  async update(id: string, payload: QuestionUpdatePayload): Promise<Question> {
    const { data } = await api.patch<Question>(`/questions/${id}`, payload)
    return data
  },

  async approve(id: string): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>(`/review/approve/${id}`)
    return data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/questions/${id}`)
  },

  async duplicate(id: string): Promise<Question> {
    const { data } = await api.post<Question>(`/questions/${id}/duplicate`)
    return data
  },

  async regenerate(id: string): Promise<Question> {
    const { data } = await api.post<Question>(`/questions/${id}/regenerate`)
    return data
  },

  async create(payload: {
    section_id: string
    question_text: string
    question_type: string
    difficulty?: "Easy" | "Medium" | "Hard" | string
    marks: number
    options?: string[]
    correct_answer?: string
  }): Promise<Question> {
    const { data } = await api.post<Question>("/questions", payload)
    return data
  },
}
