export interface Result {
  id?: string
  student_name?: string
  enrollment_number?: string
  institution_type?: string
  course?: string
  section?: string
  semester?: string
  batch?: string
  attempt_token?: string
  final_score: number
  violation_count: number
  integrity_flag: boolean
  status: string
  submitted_at?: string | null
}
