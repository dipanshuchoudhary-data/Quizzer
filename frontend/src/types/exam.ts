export type ExamMode = "college" | "school";

export type ViolationType =
  | "TAB_SWITCH"
  | "FULLSCREEN_EXIT"
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
  student_name: string;
  enrollment_number: string;
  course?: string;
  section?: string;
  batch?: string;
  semester?: string;
  class_name?: string;
  class_section?: string;
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
