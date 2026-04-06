import { examAxiosClient } from "@/api/axiosClient";
import type {
  AttemptStatusResponse,
  ExamEntryConfigResponse,
  ExamQuestion,
  SaveAnswerPayload,
  StartAttemptResponse,
  StartExamPayload,
  ViolationType,
} from "@/types/exam";

function attemptHeaders(attemptToken?: string) {
  return attemptToken ? { "X-Attempt-Token": attemptToken } : undefined;
}

export async function startExamAttempt(quizId: string, payload: StartExamPayload) {
  const { data } = await examAxiosClient.post<StartAttemptResponse>(`/attempts/${quizId}/start`, payload);
  return data;
}

export async function fetchExamEntryConfig(quizId: string, isPublicExam = false) {
  const path = isPublicExam ? `/attempts/public/${quizId}/entry-config` : `/attempts/${quizId}/entry-config`
  const { data } = await examAxiosClient.get<ExamEntryConfigResponse>(path)
  return data
}

export async function startPublishedExamAttempt(publicExamId: string) {
  const { data } = await examAxiosClient.post<StartAttemptResponse>("/attempts/start", {
    public_exam_id: publicExamId,
  });
  return data;
}

export async function startPublishedVerifiedExamAttempt(publicExamId: string, payload: StartExamPayload) {
  const { data } = await examAxiosClient.post<StartAttemptResponse>("/attempts/start", {
    public_exam_id: publicExamId,
    ...payload,
  });
  return data;
}

export async function fetchExamQuestions(quizId: string) {
  const { data } = await examAxiosClient.get<ExamQuestion[]>(`/quizzes/${quizId}/questions`);
  return data;
}

export async function saveStudentAnswer(payload: SaveAnswerPayload) {
  const { data } = await examAxiosClient.post(
    `/answers/${payload.attemptId}`,
    {
      question_id: payload.questionId,
      answer_text: payload.answerText,
    },
    { headers: attemptHeaders(payload.attemptToken) }
  );
  return data;
}

export async function reportViolation(attemptId: string, violationType: ViolationType, attemptToken?: string) {
  const { data } = await examAxiosClient.post(
    `/violations/${attemptId}`,
    { violation_type: violationType },
    { headers: attemptHeaders(attemptToken) }
  );
  return data;
}

export async function heartbeatAttempt(attemptId: string, attemptToken?: string) {
  const { data } = await examAxiosClient.post(
    `/attempts/${attemptId}/heartbeat`,
    {},
    { headers: attemptHeaders(attemptToken) }
  );
  return data;
}

export async function getAttemptStatus(attemptId: string, attemptToken?: string) {
  const { data } = await examAxiosClient.get<AttemptStatusResponse>(`/attempts/${attemptId}/status`, {
    headers: attemptHeaders(attemptToken),
  });
  return data;
}

export async function submitAttempt(attemptId: string, attemptToken?: string) {
  const { data } = await examAxiosClient.post(
    `/attempts/${attemptId}/submit`,
    {},
    { headers: attemptHeaders(attemptToken) }
  );
  return data;
}
