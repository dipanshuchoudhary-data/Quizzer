"use client";

function formatSeconds(seconds: number) {
  const s = Math.max(0, seconds);
  const hh = Math.floor(s / 3600)
    .toString()
    .padStart(2, "0");
  const mm = Math.floor((s % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

interface ExamTimerProps {
  remainingTime: number;
  onSubmit: () => void;
  onFlag: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onClearAnswer: () => void;
  flagged: boolean;
  savedCount: number;
  totalQuestions: number;
  pendingSyncCount: number;
  violationCount: number;
  disableActions?: boolean;
}

export function ExamTimer({
  remainingTime,
  onSubmit,
  onFlag,
  onNext,
  onPrevious,
  onSkip,
  onClearAnswer,
  flagged,
  savedCount,
  totalQuestions,
  pendingSyncCount,
  violationCount,
  disableActions,
}: ExamTimerProps) {
  const danger = remainingTime <= 300;

  return (
    <aside className="h-full rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Time Remaining</h3>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${danger ? "text-rose-600" : "text-slate-900"}`}>
        {formatSeconds(remainingTime)}
      </p>
      <p className="mt-2 text-xs text-slate-500">Timer display syncs with the backend every few seconds. Local time is visual only.</p>

      <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-slate-600">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="font-semibold text-slate-800">Saved {savedCount} / {totalQuestions}</p>
          <p className="mt-1">Pending Sync: {pendingSyncCount}</p>
          <p className="mt-1">Violations: {violationCount}</p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onPrevious}
            disabled={disableActions}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition duration-150 hover:brightness-105 hover:scale-[1.03] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={disableActions}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition duration-150 hover:brightness-105 hover:scale-[1.03] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Next
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onSkip}
            disabled={disableActions}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition duration-150 hover:brightness-105 hover:scale-[1.03] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Skip Question
          </button>
          <button
            type="button"
            onClick={onClearAnswer}
            disabled={disableActions}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition duration-150 hover:brightness-105 hover:scale-[1.03] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Clear Answer
          </button>
        </div>
        <button
          type="button"
          onClick={onFlag}
          disabled={disableActions}
          className={`w-full rounded-lg border px-3 py-2 text-sm font-semibold transition duration-150 hover:brightness-105 hover:scale-[1.03] active:scale-[0.96] ${
            flagged ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-300 bg-white text-slate-700"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {flagged ? "Flagged" : "Flag Question"}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disableActions}
          className="w-full rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-rose-700 hover:brightness-105 hover:scale-[1.03] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Submit Exam
        </button>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        Leaving fullscreen, switching tabs, blurring the window, or attempting copy/paste is recorded as an integrity violation.
      </div>
    </aside>
  );
}
