export type QuizLifecycle =
  | "DRAFT"
  | "PROCESSING"
  | "GENERATED"
  | "REVIEWING"
  | "APPROVED"
  | "PUBLISHED"
  | "CLOSED"
  | "NOT_STARTED"

export interface Quiz {
  id: string
  title: string
  description: string | null
  public_slug?: string | null
  academic_type: "college" | "school"
  ai_generation_status: QuizLifecycle | string
  is_published: boolean
  created_by: string
  created_at?: string
  updated_at?: string
}
