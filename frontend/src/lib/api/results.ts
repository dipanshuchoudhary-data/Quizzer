import { api } from "@/lib/api/client"
import type { Result } from "@/types/result"

export interface ExportStartResponse {
  message: string
  task_id: string
}

export interface ExportStatusResponse {
  status: string
  download_url: string | null
  file_id: string | null
  file_name: string | null
  detail?: string
}

export const resultsApi = {
  async getResults(quizId: string): Promise<Result[]> {
    const { data } = await api.get<Result[]>(`/results/${quizId}`)
    return data
  },

  async exportResults(quizId: string, format: "csv" | "excel"): Promise<ExportStartResponse> {
    const { data } = await api.post<ExportStartResponse>(`/results/${quizId}/export`, {
      format,
    })
    return data
  },

  async getExportStatus(taskId: string): Promise<ExportStatusResponse> {
    const { data } = await api.get<ExportStatusResponse>(`/exports/status/${taskId}`)
    return data
  },

  async downloadExport(downloadUrl: string, fileName: string): Promise<void> {
    const { data } = await api.get<Blob>(downloadUrl, {
      responseType: "blob",
    })
    const blobUrl = window.URL.createObjectURL(data)
    const anchor = document.createElement("a")
    anchor.href = blobUrl
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.URL.revokeObjectURL(blobUrl)
  },
}
