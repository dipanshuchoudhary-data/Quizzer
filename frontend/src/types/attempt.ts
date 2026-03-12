export interface Attempt {
  id?: string
  quiz_id?: string
  attempt_token: string
  submitted_at: string | null
  integrity_flag?: boolean
  status?: string
  violation_count?: number
  student_name?: string
  enrollment_number?: string
  institution_type?: string
  final_score?: number
}
