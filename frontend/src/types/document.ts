export interface Document {
  id: string
  quiz_id: string
  file_name: string
  file_type: string
  extraction_status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | string
  extracted_metadata?: {
    summary?: string
    extracted_text?: string
    key_topics?: string[]
    difficulty_level?: string
    text_length?: number
    error?: string
  } | null
  created_at?: string
  updated_at?: string
}
