import axios from "axios"
import { api } from "@/lib/api/client"
import { env } from "@/lib/env"
import { defaultQuizExamSettings, type Quiz, type QuizExamSettings } from "@/types/quiz"

export interface CreateQuizPayload {
  title: string
  description: string
  academic_type?: "college" | "school"
  duration_minutes?: number
}

export interface GenerateQuizPayload {
  extracted_text: string
  blueprint: Record<string, unknown>
  professor_note?: string
}

export interface InitStreamQuizResponse {
  message: string
  job_id: string
}

export interface SourceReference {
  type: string
  label: string
  url?: string
  content?: string
  note?: string
}

interface QuizSettingsEnvelope {
  success?: boolean
  message?: string
  settings?: Partial<QuizExamSettings>
}

function normalizeQuizSettingsPayload(payload: Partial<QuizExamSettings>): QuizExamSettings {
  return {
    duration: Number(payload.duration ?? defaultQuizExamSettings.duration),
    default_marks: Number(payload.default_marks ?? defaultQuizExamSettings.default_marks),
    shuffle_questions: Boolean(payload.shuffle_questions ?? defaultQuizExamSettings.shuffle_questions),
    shuffle_options: Boolean(payload.shuffle_options ?? defaultQuizExamSettings.shuffle_options),
    require_fullscreen: Boolean(payload.require_fullscreen ?? defaultQuizExamSettings.require_fullscreen),
    block_tab_switch: Boolean(payload.block_tab_switch ?? defaultQuizExamSettings.block_tab_switch),
    block_copy_paste: Boolean(payload.block_copy_paste ?? defaultQuizExamSettings.block_copy_paste),
    violation_limit: Number(payload.violation_limit ?? defaultQuizExamSettings.violation_limit),
    negative_marking: Boolean(payload.negative_marking ?? defaultQuizExamSettings.negative_marking),
    penalty_wrong: Number(payload.penalty_wrong ?? defaultQuizExamSettings.penalty_wrong),
    violation_penalty: Number(payload.violation_penalty ?? defaultQuizExamSettings.violation_penalty),
    attempts_allowed: Number(payload.attempts_allowed ?? defaultQuizExamSettings.attempts_allowed),
    allow_resume: Boolean(payload.allow_resume ?? defaultQuizExamSettings.allow_resume),
    prevent_duplicate: Boolean(payload.prevent_duplicate ?? defaultQuizExamSettings.prevent_duplicate),
  }
}

function normalizeQuizSettingsResponse(data: QuizExamSettings | QuizSettingsEnvelope): {
  settings: QuizExamSettings
  message: string
  success: boolean
} {
  if (data && typeof data === "object" && "settings" in data) {
    return {
      settings: { ...defaultQuizExamSettings, ...(data.settings ?? {}) },
      message: data.message ?? "Settings saved",
      success: data.success ?? true,
    }
  }

  return {
    settings: { ...defaultQuizExamSettings, ...((data ?? {}) as QuizExamSettings) },
    message: "Settings saved",
    success: true,
  }
}

async function fetchQuizSettings(id: string): Promise<{ settings: QuizExamSettings; message: string; success: boolean }> {
  const { data } = await axios.get<QuizExamSettings | QuizSettingsEnvelope>(`/api/quizzes/${id}/settings`, {
    withCredentials: true,
  })
  return normalizeQuizSettingsResponse(data)
}

function areQuizSettingsEqual(left: QuizExamSettings, right: QuizExamSettings) {
  return (
    left.duration === right.duration &&
    left.default_marks === right.default_marks &&
    left.shuffle_questions === right.shuffle_questions &&
    left.shuffle_options === right.shuffle_options &&
    left.require_fullscreen === right.require_fullscreen &&
    left.block_tab_switch === right.block_tab_switch &&
    left.block_copy_paste === right.block_copy_paste &&
    left.violation_limit === right.violation_limit &&
    left.negative_marking === right.negative_marking &&
    left.penalty_wrong === right.penalty_wrong &&
    left.violation_penalty === right.violation_penalty &&
    left.attempts_allowed === right.attempts_allowed &&
    left.allow_resume === right.allow_resume &&
    left.prevent_duplicate === right.prevent_duplicate
  )
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function verifySavedQuizSettings(id: string, expected: QuizExamSettings): Promise<QuizExamSettings | null> {
  const retryDelaysMs = [150, 400, 900]

  for (const retryDelayMs of retryDelaysMs) {
    await delay(retryDelayMs)

    try {
      const reloaded = await fetchQuizSettings(id)
      if (reloaded.success && areQuizSettingsEqual(reloaded.settings, expected)) {
        return reloaded.settings
      }
    } catch {
      // Ignore verification failures and continue retrying the persisted read.
    }
  }

  return null
}

function normalizeLifecycle(quiz: Quiz): Quiz {
  const normalizedQuiz = {
    ...quiz,
    duration_minutes: quiz.duration_minutes ?? defaultQuizExamSettings.duration,
    question_count: quiz.question_count ?? 0,
    is_archived: quiz.is_archived ?? false,
  }

  if (quiz.is_published) {
    return { ...normalizedQuiz, ai_generation_status: "PUBLISHED" }
  }

  if (quiz.ai_generation_status === "APPROVED") {
    return { ...normalizedQuiz, ai_generation_status: "APPROVED" }
  }

  if (quiz.ai_generation_status === "GENERATED") {
    return { ...normalizedQuiz, ai_generation_status: "REVIEWING" }
  }

  if (quiz.ai_generation_status === "NOT_STARTED") {
    return { ...normalizedQuiz, ai_generation_status: "DRAFT" }
  }

  return normalizedQuiz
}

export const quizApi = {
  async getAll(): Promise<Quiz[]> {
    const { data } = await api.get<Quiz[]>("/quizzes")
    return data.map(normalizeLifecycle)
  },

  async getById(id: string): Promise<Quiz> {
    const { data } = await api.get<Quiz>(`/quizzes/${id}`)
    return normalizeLifecycle(data)
  },

  async create(payload: CreateQuizPayload): Promise<Quiz> {
    const { data } = await api.post<Quiz>("/quizzes", {
      ...payload,
      academic_type: payload.academic_type ?? "college",
      duration_minutes: payload.duration_minutes ?? 60,
    })
    return normalizeLifecycle(data)
  },

  async update(id: string, payload: Partial<Pick<Quiz, "title" | "description" | "duration_minutes" | "is_archived">>): Promise<Quiz> {
    const { data } = await api.patch<Quiz>(`/quizzes/${id}`, payload)
    return normalizeLifecycle(data)
  },

  async getSettings(id: string): Promise<QuizExamSettings> {
    const normalized = await fetchQuizSettings(id)
    if (!normalized.success) {
      throw new Error(normalized.message || "Failed to load settings")
    }
    return normalized.settings
  },

  async updateSettings(id: string, payload: Partial<QuizExamSettings>): Promise<{ settings: QuizExamSettings; message: string; success: boolean }> {
    const normalizedPayload = normalizeQuizSettingsPayload(payload)
    try {
      const { data } = await axios.patch<QuizExamSettings | QuizSettingsEnvelope>(`/api/quizzes/${id}/settings`, normalizedPayload, {
        withCredentials: true,
      })
      const normalized = normalizeQuizSettingsResponse(data)
      if (!normalized.success) {
        throw new Error(normalized.message || "Settings update failed")
      }
      return normalized
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response) {
        throw error
      }

      const verifiedSettings = await verifySavedQuizSettings(id, normalizedPayload)
      if (verifiedSettings) {
        return {
          settings: verifiedSettings,
          message: "Settings saved successfully",
          success: true,
        }
      }

      throw error
    }
  },

  async deleteById(id: string): Promise<{ message: string }> {
    const { data } = await api.delete<{ message: string }>(`/quizzes/${id}`)
    return data
  },

  async publish(id: string): Promise<{ message: string; public_id?: string; public_url?: string }> {
    const { data } = await api.post<{ message: string; public_id?: string; public_url?: string }>(`/quizzes/${id}/publish`)
    return data
  },

  async unpublish(id: string): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>(`/quizzes/${id}/unpublish`)
    return data
  },

  async archive(id: string): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>(`/quizzes/${id}/archive`)
    return data
  },

  async unarchive(id: string): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>(`/quizzes/${id}/unarchive`)
    return data
  },

  async generate(id: string, payload: GenerateQuizPayload): Promise<{ message: string; job_id?: string }> {
    const { data } = await api.post<{ message: string; job_id?: string }>(`/quizzes/${id}/generate`, payload)
    return data
  },

  async initStream(id: string, payload: GenerateQuizPayload): Promise<InitStreamQuizResponse> {
    const { data } = await api.post<InitStreamQuizResponse>(`/quizzes/${id}/generate-stream/init`, payload)
    return data
  },

  streamUrl(id: string, jobId: string): string {
    const params = new URLSearchParams({ job_id: jobId })
    return `${env.apiUrl}/quizzes/${id}/generate-stream?${params.toString()}`
  },

  async getSourceReferences(id: string): Promise<SourceReference[]> {
    const { data } = await api.get<{ items: SourceReference[] }>(`/quizzes/${id}/source-references`)
    return data.items ?? []
  },
}
