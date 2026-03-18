export interface Question {
  id: string
  section_id: string
  question_text: string
  question_type: string
  difficulty?: "Easy" | "Medium" | "Hard" | string
  options: string[] | Record<string, string> | null
  correct_answer: string | null
  marks: number
  status: string
  order_index?: number
  created_at?: string
  updated_at?: string
}
