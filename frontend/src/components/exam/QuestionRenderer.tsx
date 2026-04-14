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
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:rounded-2xl sm:p-6">
        <p className="text-sm text-slate-600">No question loaded for this attempt.</p>
      </section>
    );
  }

  const questionType = normalizeQuestionType(question.question_type);
  const options = toOptions(question.options);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-6">
      <h2 className="text-base font-semibold leading-relaxed text-slate-900 sm:text-lg">
        {formatQuestionForDisplay(question.question_text)}
      </h2>

      <div className="mt-4 sm:mt-6">
        {questionType === "MCQ" && (
          <div className="space-y-2 sm:space-y-3">
            {options.map((option, idx) => (
              <label
                key={`${question.id}-option-${idx}`}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 px-3 py-3 transition-all sm:rounded-xl sm:px-4 sm:py-3 ${
                  answer === option
                    ? "border-amber-500 bg-amber-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name={question.id}
                  checked={answer === option}
                  onChange={() => onAnswerChange(option)}
                  className="h-5 w-5 accent-amber-600"
                />
                <span className="text-sm text-slate-800 sm:text-base">{option}</span>
              </label>
            ))}
          </div>
        )}

        {questionType === "TRUE_FALSE" && (
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            {["True", "False"].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onAnswerChange(option)}
                className={`flex-1 rounded-lg border-2 px-4 py-3 text-base font-semibold transition-all sm:rounded-xl sm:px-6 sm:py-3 ${
                  answer === option
                    ? "border-amber-500 bg-amber-600 text-white shadow-md"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
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
            className="w-full rounded-lg border-2 border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 transition-colors focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            autoComplete="off"
            spellCheck={false}
            maxLength={120}
          />
        )}

        {questionType === "SHORT_ANSWER" && (
          <textarea
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Write your answer here..."
            className="min-h-36 w-full rounded-lg border-2 border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 transition-colors focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 sm:min-h-40"
            spellCheck={false}
            maxLength={2000}
          />
        )}
      </div>
    </section>
  );
}
