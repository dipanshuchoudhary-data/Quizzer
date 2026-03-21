"use client";

import type { ExamQuestion } from "@/types/exam";
import { formatQuestionForDisplay, normalizeMathText } from "@/lib/question-format";

interface QuestionRendererProps {
  question: ExamQuestion | null;
  answer: string;
  onAnswerChange: (value: string) => void;
}

function normalizeQuestionType(rawType: string) {
  const t = rawType.toUpperCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (t === "BOOLEAN" || t === "TRUEFALSE") return "TRUE_FALSE";
  if (t === "SHORT_ANSWER" || t === "LONG_ANSWER") return "SHORT_ANSWER";
  if (t === "ONE_WORD") return "ONE_WORD";
  return "MCQ";
}

function toOptions(options: ExamQuestion["options"]): string[] {
  if (!options) return [];
  if (Array.isArray(options)) return options.map((x) => normalizeMathText(String(x)));
  return Object.values(options).map((x) => normalizeMathText(String(x)));
}

export function QuestionRenderer({ question, answer, onAnswerChange }: QuestionRendererProps) {
  if (!question) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">No question loaded for this attempt.</p>
      </section>
    );
  }

  const questionType = normalizeQuestionType(question.question_type);
  const options = toOptions(question.options);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
        <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">{questionType}</span>
        <span>{question.marks ?? 1} mark(s)</span>
      </div>

      <h2 className="mb-6 text-lg font-semibold text-slate-900">{formatQuestionForDisplay(question.question_text)}</h2>

      {questionType === "MCQ" && (
        <div className="space-y-3">
          {options.map((option, idx) => (
            <label key={`${question.id}-option-${idx}`} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <input
                type="radio"
                name={question.id}
                checked={answer === option}
                onChange={() => onAnswerChange(option)}
                className="h-4 w-4"
              />
              <span className="text-sm text-slate-800">{option}</span>
            </label>
          ))}
        </div>
      )}

      {questionType === "TRUE_FALSE" && (
        <div className="flex gap-3">
          {["True", "False"].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onAnswerChange(option)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                answer === option ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {questionType === "ONE_WORD" && (
        <input
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder="Type one word answer"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          autoComplete="off"
          spellCheck={false}
          maxLength={120}
        />
      )}

      {questionType === "SHORT_ANSWER" && (
        <textarea
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder="Write a concise answer"
          className="min-h-40 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 focus:outline-none"
          spellCheck={false}
          maxLength={2000}
        />
      )}
    </section>
  );
}
