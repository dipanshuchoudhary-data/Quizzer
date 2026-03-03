import { api } from "@/lib/api/client"

export const questionBulkApi = {
  async approveMany(questionIds: string[]): Promise<void> {
    await api.post("/review/bulk/approve", { question_ids: questionIds })
  },

  async moveMany(questionIds: string[], sectionId: string): Promise<void> {
    await api.post("/review/bulk/move", { question_ids: questionIds, section_id: sectionId })
  },

  async marksMany(questionIds: string[], marks: number): Promise<void> {
    await api.post("/review/bulk/marks", { question_ids: questionIds, marks })
  },
}

