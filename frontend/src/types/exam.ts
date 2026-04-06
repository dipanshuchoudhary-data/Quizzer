import type { QuizVerificationSchema } from "@/types/quiz"

export type ExamMode = "college" | "school" | "coaching" | "custom";

export type ViolationType =
  | "TAB_SWITCH"
  | "FULLSCREEN_EXIT"
  | "WINDOW_BLUR"
  | "PASTE_ATTEMPT"
  | "LARGE_TEXT_INSERT"
  | "CONTEXT_MENU"
  | "COPY_ATTEMPT"
  | "DEVTOOLS_SHORTCUT";

export type QuestionType = "MCQ" | "TRUE_FALSE" | "ONE_WORD" | "SHORT_ANSWER";

export interface ExamQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options?: string[] | Record<string, string> | null;
  marks?: number;
}

export interface StartExamPayload {
  verification_context?: ExamMode | string;
  verification_data: Record<string, string>;
}

export interface StartAttemptResponse {
  attempt_id: string;
  attempt_token: string;
  duration_seconds?: number;
  duration?: number;
  questions?: ExamQuestion[];
  academic_type?: ExamMode;
  quiz_title?: string;
  start_time?: string;
  end_time?: string;
  violation_limit?: number;
  mark_deduction_per_violation?: number;
}

export interface ExamEntryConfigResponse {
  quiz_id: string
  quiz_title: string
  academic_type: ExamMode | string
  require_fullscreen: boolean
  violation_limit: number
  verification: QuizVerificationSchema
}

export interface SaveAnswerPayload {
  attemptId: string;
  questionId: string;
  answerText: string;
  attemptToken?: string;
}

export interface AttemptStatusResponse {
  attempt_id?: string;
  remaining_time?: number;
  remaining_seconds?: number;
  status?: string;
  submitted_at?: string | null;
}

export interface StudentAnswerState {
  [questionId: string]: string;
}

export interface ViolationWarning {
  type: ViolationType;
  count: number;
  lastAt: number;
}
