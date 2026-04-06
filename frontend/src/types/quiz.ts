export type QuizLifecycle =
  | "DRAFT"
  | "PROCESSING"
  | "GENERATED"
  | "REVIEWING"
  | "APPROVED"
  | "PUBLISHED"
  | "CLOSED"
  | "NOT_STARTED"

export type VerificationFieldType = "text" | "select" | "number"

export interface VerificationFieldOption {
  value: string
  label: string
}

export interface QuizVerificationField {
  key: string
  label: string
  type: VerificationFieldType
  required: boolean
  placeholder?: string | null
  help_text?: string | null
  options: VerificationFieldOption[]
  min_length?: number | null
  max_length?: number | null
  pattern?: string | null
  lowercase?: boolean
  uppercase?: boolean
}

export interface QuizVerificationSchema {
  context: "college" | "school" | "coaching" | "custom" | string
  title: string
  description?: string | null
  identity_fields: string[]
  fields: QuizVerificationField[]
}

export function createDefaultVerificationSchema(context: QuizVerificationSchema["context"] = "college"): QuizVerificationSchema {
  if (context === "school") {
    return {
      context: "school",
      title: "School Verification",
      description: "Collect class and roll details relevant to school students.",
      identity_fields: ["class_name", "class_section", "roll_number"],
      fields: [
        { key: "student_name", label: "Student Name", type: "text", required: true, placeholder: "Enter your full name", options: [], min_length: 2, max_length: 120 },
        { key: "class_name", label: "Class", type: "select", required: true, options: Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: `Class ${index + 1}` })) },
        { key: "class_section", label: "Section", type: "text", required: false, placeholder: "e.g. B", options: [], max_length: 10, pattern: "^[A-Za-z0-9 -]{1,10}$", uppercase: true },
        { key: "roll_number", label: "Roll Number", type: "number", required: true, placeholder: "e.g. 17", options: [] },
      ],
    }
  }

  if (context === "coaching") {
    return {
      context: "coaching",
      title: "Coaching Verification",
      description: "Capture the minimum reliable identifiers needed for coached or tutor-led exams.",
      identity_fields: ["batch", "student_code", "student_name"],
      fields: [
        { key: "student_name", label: "Student Name", type: "text", required: true, placeholder: "Enter your full name", options: [], min_length: 2, max_length: 120 },
        { key: "batch", label: "Batch", type: "text", required: true, placeholder: "e.g. JEE-Weekend-A", options: [], min_length: 2, max_length: 40, pattern: "^[A-Za-z0-9/_ -]+$", uppercase: true },
        { key: "student_code", label: "Student Code", type: "text", required: false, placeholder: "Optional internal student code", options: [], max_length: 40, pattern: "^[A-Za-z0-9/_-]+$", uppercase: true },
      ],
    }
  }

  return {
    context: "college",
    title: "College Verification",
    description: "Collect structured academic identifiers before the exam begins.",
    identity_fields: ["enrollment_number"],
    fields: [
      { key: "student_name", label: "Student Name", type: "text", required: true, placeholder: "Enter your full name", options: [], min_length: 2, max_length: 120 },
      { key: "enrollment_number", label: "Enrollment Number", type: "text", required: true, placeholder: "e.g. 22CS104", options: [], min_length: 4, max_length: 40, pattern: "^[A-Za-z0-9/_-]+$", uppercase: true },
      { key: "course", label: "Course", type: "text", required: true, placeholder: "e.g. B.Tech CSE", options: [], min_length: 2, max_length: 120 },
      { key: "semester", label: "Semester", type: "select", required: true, options: Array.from({ length: 8 }, (_, index) => ({ value: String(index + 1), label: `Semester ${index + 1}` })) },
      { key: "section", label: "Section", type: "text", required: false, placeholder: "e.g. A", options: [], max_length: 20, pattern: "^[A-Za-z0-9 -]{1,20}$", uppercase: true },
      { key: "batch", label: "Batch", type: "text", required: false, placeholder: "e.g. 2022-26", options: [], max_length: 20, pattern: "^[A-Za-z0-9/_ -]{1,20}$", uppercase: true },
    ],
  }
}

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
  verification: QuizVerificationSchema
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
  verification: createDefaultVerificationSchema("college"),
}

export interface Quiz {
  id: string
  title: string
  description: string | null
  public_id?: string | null
  public_url?: string | null
  duration_minutes?: number
  question_count?: number | null
  academic_type: "college" | "school" | "coaching"
  ai_generation_status: QuizLifecycle | string
  is_published: boolean
  is_archived?: boolean
  created_by: string
  created_at?: string
  updated_at?: string
}
