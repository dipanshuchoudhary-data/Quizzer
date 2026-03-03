import { api } from "@/lib/api/client"
import type { Section } from "@/types/section"

export type CreateSectionPayload = Pick<Section, "title" | "total_marks">

export const sectionApi = {
  async getByQuiz(quizId: string): Promise<Section[]> {
    const { data } = await api.get<Section[]>(`/quizzes/${quizId}/sections`)
    return data
  },

  async create(quizId: string, payload: CreateSectionPayload): Promise<Section> {
    const { data } = await api.post<Section>(`/quizzes/${quizId}/sections`, payload)
    return data
  },

  async update(sectionId: string, payload: Partial<CreateSectionPayload>): Promise<Section> {
    const { data } = await api.patch<Section>(`/sections/${sectionId}`, payload)
    return data
  },

  async reorder(quizId: string, sectionIds: string[]): Promise<void> {
    await api.post(`/quizzes/${quizId}/sections/reorder`, { section_ids: sectionIds })
  },
}

