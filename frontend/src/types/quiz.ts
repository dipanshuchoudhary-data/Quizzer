export type QuizLifecycle =
  | "DRAFT"
  | "PROCESSING"
  | "GENERATED"
  | "REVIEWING"
  | "APPROVED"
  | "PUBLISHED"
  | "CLOSED"
  | "NOT_STARTED"

export interface QuizExamSettings {
  duration: number
  default_marks: number
  shuffle_questions: boolean
  shuffle_options: boolean
  require_fullscreen: boolean
  block_tab_switch: boolean
  block_copy_paste: boolean
  violation_limit: number
  negative_marking: boolean
  penalty_wrong: number
  violation_penalty: number
  attempts_allowed: number
  allow_resume: boolean
  prevent_duplicate: boolean
}

export const defaultQuizExamSettings: QuizExamSettings = {
  duration: 60,
  default_marks: 1,
  shuffle_questions: false,
  shuffle_options: false,
  require_fullscreen: true,
  block_tab_switch: true,
  block_copy_paste: true,
  violation_limit: 3,
  negative_marking: false,
  penalty_wrong: 0,
  violation_penalty: 0,
  attempts_allowed: 1,
  allow_resume: false,
  prevent_duplicate: true,
}

export interface Quiz {
  id: string
  title: string
  description: string | null
  public_id?: string | null
  public_url?: string | null
  duration_minutes?: number
  question_count?: number | null
  academic_type: "college" | "school"
  ai_generation_status: QuizLifecycle | string
  is_published: boolean
  is_archived?: boolean
  created_by: string
  created_at?: string
  updated_at?: string
}
