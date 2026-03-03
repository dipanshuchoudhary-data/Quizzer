import { api } from "@/lib/api/client"
import { env } from "@/lib/env"
import type { Document } from "@/types/document"

export const documentApi = {
  async upload(quizId: string, file: File): Promise<{ message: string; document_id: string }> {
    const form = new FormData()
    form.append("file", file)
    const { data } = await api.post<{ message: string; document_id: string }>(`/documents/${quizId}/upload`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    return data
  },

  async list(quizId: string): Promise<Document[]> {
    const { data } = await api.get<Document[]>(`/documents/${quizId}`)
    return data
  },

  async getById(documentId: string): Promise<Document> {
    const { data } = await api.get<Document>(`/documents/detail/${documentId}`)
    return data
  },

  async remove(documentId: string): Promise<void> {
    await api.delete(`/documents/${documentId}`)
  },

  getDetailUrl(documentId: string): string {
    return `${env.apiUrl}/documents/detail/${documentId}`
  },
}
