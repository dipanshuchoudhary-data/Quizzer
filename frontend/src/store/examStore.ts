"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ExamMode, ExamQuestion, StudentAnswerState, ViolationWarning } from "@/types/exam";

interface AttemptIdentity {
  quizId: string | null;
  attemptId: string | null;
  attemptToken: string | null;
  durationSeconds: number;
  quizTitle: string | null;
}

interface StudentProfileState {
  student_name: string;
  enrollment_number: string;
  course?: string;
  section?: string;
  batch?: string;
  semester?: string;
  class_name?: string;
  class_section?: string;
}

interface PersistedExamState {
  mode: ExamMode;
  identity: AttemptIdentity;
  profile: StudentProfileState | null;
  questions: ExamQuestion[];
  answers: StudentAnswerState;
  visitedIds: string[];
  flaggedIds: string[];
  currentQuestionId: string | null;
  remainingTime: number;
  isSubmitted: boolean;
}

interface ExamStoreState extends PersistedExamState {
  hydrated: boolean;
  dirtyQuestionIds: Set<string>;
  visited: Set<string>;
  flagged: Set<string>;
  violationWarning: ViolationWarning | null;
  connectionLost: boolean;
  setHydrated: (hydrated: boolean) => void;
  setMode: (mode: ExamMode) => void;
  setConnectionLost: (lost: boolean) => void;
  initializeAttempt: (payload: {
    quizId: string;
    attemptId: string;
    attemptToken: string;
    durationSeconds: number;
    quizTitle?: string | null;
    questions: ExamQuestion[];
    profile: StudentProfileState;
    mode: ExamMode;
  }) => void;
  setQuestions: (questions: ExamQuestion[]) => void;
  setCurrentQuestion: (questionId: string) => void;
  setAnswer: (questionId: string, answer: string) => void;
  markSaved: (questionId: string) => void;
  toggleFlag: (questionId: string) => void;
  setRemainingTime: (seconds: number) => void;
  markSubmitted: () => void;
  clearViolationWarning: () => void;
  registerViolation: (type: ViolationWarning["type"]) => void;
  resetExamStore: () => void;
}

const initialIdentity: AttemptIdentity = {
  quizId: null,
  attemptId: null,
  attemptToken: null,
  durationSeconds: 0,
  quizTitle: null,
};

const initialPersistedState: PersistedExamState = {
  mode: "college",
  identity: initialIdentity,
  profile: null,
  questions: [],
  answers: {},
  visitedIds: [],
  flaggedIds: [],
  currentQuestionId: null,
  remainingTime: 0,
  isSubmitted: false,
};

const initialVolatileState = {
  dirtyQuestionIds: new Set<string>(),
  visited: new Set<string>(),
  flagged: new Set<string>(),
  violationWarning: null as ViolationWarning | null,
  connectionLost: false,
};

function createRuntimeState(state: PersistedExamState) {
  return {
    visited: new Set(state.visitedIds),
    flagged: new Set(state.flaggedIds),
  };
}

export const useExamStore = create<ExamStoreState>()(
  persist(
    (set) => ({
      ...initialPersistedState,
      hydrated: false,
      ...initialVolatileState,
      setHydrated: (hydrated) => set({ hydrated }),
      setMode: (mode) => set({ mode }),
      setConnectionLost: (lost) => set({ connectionLost: lost }),
      initializeAttempt: (payload) => {
        const firstQuestionId = payload.questions[0]?.id ?? null;
        const visitedIds = firstQuestionId ? [firstQuestionId] : [];
        set({
          mode: payload.mode,
          identity: {
            quizId: payload.quizId,
            attemptId: payload.attemptId,
            attemptToken: payload.attemptToken,
            durationSeconds: payload.durationSeconds,
            quizTitle: payload.quizTitle ?? null,
          },
          profile: payload.profile,
          questions: payload.questions,
          currentQuestionId: firstQuestionId,
          visitedIds,
          flaggedIds: [],
          visited: new Set(visitedIds),
          flagged: new Set(),
          remainingTime: payload.durationSeconds,
          isSubmitted: false,
          answers: {},
          dirtyQuestionIds: new Set(),
          violationWarning: null,
          connectionLost: false,
        });
      },
      setQuestions: (questions) =>
        set((state) => {
          const fallbackCurrent = state.currentQuestionId ?? questions[0]?.id ?? null;
          const nextVisited = new Set(state.visited);
          if (fallbackCurrent) {
            nextVisited.add(fallbackCurrent);
          }
          return {
            questions,
            currentQuestionId: fallbackCurrent,
            visited: nextVisited,
            visitedIds: Array.from(nextVisited),
          };
        }),
      setCurrentQuestion: (questionId) =>
        set((state) => {
          const nextVisited = new Set(state.visited);
          nextVisited.add(questionId);
          return {
            currentQuestionId: questionId,
            visited: nextVisited,
            visitedIds: Array.from(nextVisited),
          };
        }),
      setAnswer: (questionId, answer) =>
        set((state) => {
          const dirty = new Set(state.dirtyQuestionIds);
          dirty.add(questionId);
          return {
            answers: { ...state.answers, [questionId]: answer },
            dirtyQuestionIds: dirty,
          };
        }),
      markSaved: (questionId) =>
        set((state) => {
          const dirty = new Set(state.dirtyQuestionIds);
          dirty.delete(questionId);
          return { dirtyQuestionIds: dirty };
        }),
      toggleFlag: (questionId) =>
        set((state) => {
          const next = new Set(state.flagged);
          if (next.has(questionId)) {
            next.delete(questionId);
          } else {
            next.add(questionId);
          }
          return {
            flagged: next,
            flaggedIds: Array.from(next),
          };
        }),
      setRemainingTime: (seconds) => set({ remainingTime: Math.max(0, seconds) }),
      markSubmitted: () => set({ isSubmitted: true }),
      clearViolationWarning: () => set({ violationWarning: null }),
      registerViolation: (type) =>
        set((state) => {
          const now = Date.now();
          const current = state.violationWarning;
          const nextCount = current?.type === type ? current.count + 1 : 1;
          return { violationWarning: { type, count: nextCount, lastAt: now } };
        }),
      resetExamStore: () =>
        set({
          ...initialPersistedState,
          identity: { ...initialIdentity },
          hydrated: true,
          ...initialVolatileState,
        }),
    }),
    {
      name: "quizzer-exam-session",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        mode: state.mode,
        identity: state.identity,
        profile: state.profile,
        questions: state.questions,
        answers: state.answers,
        visitedIds: state.visitedIds,
        flaggedIds: state.flaggedIds,
        currentQuestionId: state.currentQuestionId,
        remainingTime: state.remainingTime,
        isSubmitted: state.isSubmitted,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as PersistedExamState | undefined) ?? initialPersistedState;
        const runtime = createRuntimeState(persisted);
        return {
          ...currentState,
          ...persisted,
          ...runtime,
          dirtyQuestionIds: new Set<string>(),
          violationWarning: null,
          connectionLost: false,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
